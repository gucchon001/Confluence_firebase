import { ConfluenceAPI } from '../lib/confluence-api';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface ConfluencePage {
  id: string;
  title: string;
  content: string;
  parentId?: string;
  parentTitle?: string;
  labels: string[];
  url: string;
  spaceKey: string;
  lastModified: string;
  author: string;
  excerpt?: string;
}

interface ConfluenceSpace {
  key: string;
  name: string;
  pages: ConfluencePage[];
  hierarchy: PageHierarchy;
}

interface PageHierarchy {
  [pageId: string]: {
    children: string[];
    parent?: string;
    level: number;
    path: string[];
  };
}

interface ExtractionConfig {
  spaceKey: string;
  outputDir: string;
  batchSize: number;
  includeArchived: boolean;
  maxPages?: number;
  specificPageId?: string;
}

export class ConfluenceDataExtractor {
  private confluenceAPI: ConfluenceAPI;
  private config: ExtractionConfig;

  constructor(config: ExtractionConfig) {
    this.confluenceAPI = new ConfluenceAPI();
    this.config = config;
  }

  async extractAllData(): Promise<ConfluenceSpace> {
    console.log(`[ConfluenceDataExtractor] Starting extraction for space: ${this.config.spaceKey}`);
    
    try {
      // 1. スペース情報の取得
      const spaceInfo = await this.confluenceAPI.getSpace(this.config.spaceKey);
      console.log(`[ConfluenceDataExtractor] Space found: ${spaceInfo.name}`);

      // 2. 全ページの取得
      const pages = await this.extractAllPages();
      console.log(`[ConfluenceDataExtractor] Extracted ${pages.length} pages`);

      // 3. 階層構造の構築
      const hierarchy = this.buildHierarchy(pages);

      // 4. 結果の構築
      const result: ConfluenceSpace = {
        key: this.config.spaceKey,
        name: spaceInfo.name,
        pages,
        hierarchy
      };

      // 5. ファイル保存
      await this.saveResults(result);

      console.log(`[ConfluenceDataExtractor] Extraction completed successfully`);
      return result;

    } catch (error) {
      console.error(`[ConfluenceDataExtractor] Extraction failed:`, error);
      throw error;
    }
  }

  private async extractAllPages(): Promise<ConfluencePage[]> {
    const allPages: ConfluencePage[] = [];
    
    // 特定のページIDが指定されている場合
    if (this.config.specificPageId) {
      console.log(`[ConfluenceDataExtractor] Fetching specific page: ${this.config.specificPageId}`);
      try {
        const pageDetails = await this.confluenceAPI.getPageDetails(this.config.specificPageId);
        const transformedPage = this.transformToConfluencePage(pageDetails);
        if (transformedPage) {
          allPages.push(transformedPage);
        }
        return allPages;
      } catch (error) {
        console.error(`[ConfluenceDataExtractor] Failed to get specific page ${this.config.specificPageId}:`, error);
        return [];
      }
    }
    
    let start = 0;
    const limit = this.config.batchSize;

    while (true) {
      console.log(`[ConfluenceDataExtractor] Fetching pages ${start}-${start + limit - 1}`);
      
      const pageBatch = await this.confluenceAPI.getPages({
        spaceKey: this.config.spaceKey,
        start,
        limit,
        includeArchived: this.config.includeArchived
      });

      if (pageBatch.length === 0) break;

      // 各ページの詳細情報を取得
      const detailedPages = await Promise.all(
        pageBatch.map(async (page) => {
          try {
            const pageDetails = await this.confluenceAPI.getPageDetails(page.id);
            return this.transformToConfluencePage(pageDetails);
          } catch (error) {
            console.warn(`[ConfluenceDataExtractor] Failed to get details for page ${page.id}:`, error);
            return null;
          }
        })
      );

      // nullを除外して追加
      const validPages = detailedPages.filter((page): page is ConfluencePage => page !== null);
      allPages.push(...validPages);

      // 最大ページ数制限
      if (this.config.maxPages && allPages.length >= this.config.maxPages) {
        allPages.length = this.config.maxPages;
        break;
      }

      start += limit;
    }

    return allPages;
  }

  private transformToConfluencePage(pageData: any): ConfluencePage {
    // 必須フィールドの型チェック
    if (!pageData || typeof pageData !== 'object') {
      throw new Error('Invalid pageData: must be an object');
    }
    
    if (!pageData.id || typeof pageData.id !== 'string') {
      throw new Error('Invalid pageData: id must be a string');
    }
    
    if (!pageData.title || typeof pageData.title !== 'string') {
      throw new Error('Invalid pageData: title must be a string');
    }

    return {
      id: pageData.id,
      title: pageData.title,
      content: this.extractTextContent(pageData.body),
      parentId: pageData.parentId || null,
      parentTitle: pageData.parentTitle || null,
      labels: Array.isArray(pageData.labels) ? pageData.labels : [],
      url: pageData._links?.webui || '',
      spaceKey: pageData.space?.key || '',
      lastModified: pageData.version?.when || '',
      author: pageData.version?.by?.displayName || '',
      excerpt: this.generateExcerpt(pageData.body)
    };
  }

  private extractTextContent(body: any): string {
    if (!body || !body.storage) return '';
    
    // body.storageの型チェック
    let storageContent: string;
    if (typeof body.storage === 'string') {
      storageContent = body.storage;
    } else if (typeof body.storage === 'object' && body.storage.value) {
      storageContent = body.storage.value;
    } else {
      console.warn(`[ConfluenceDataExtractor] Unexpected body.storage type: ${typeof body.storage}`, body.storage);
      return '';
    }
    
    // HTMLタグを除去してテキストのみ抽出
    const text = storageContent
      .replace(/<[^>]*>/g, ' ') // HTMLタグを除去
      .replace(/\s+/g, ' ') // 複数の空白を1つに
      .trim();
    
    return text;
  }

  private generateExcerpt(body: any, maxLength: number = 200): string {
    const content = this.extractTextContent(body);
    if (content.length <= maxLength) return content;
    
    return content.substring(0, maxLength) + '...';
  }

  private buildHierarchy(pages: ConfluencePage[]): PageHierarchy {
    const hierarchy: PageHierarchy = {};
    
    // 全ページを初期化
    pages.forEach(page => {
      hierarchy[page.id] = {
        children: [],
        level: 0,
        path: [page.title]
      };
    });

    // 親子関係を構築
    pages.forEach(page => {
      if (page.parentId && hierarchy[page.parentId]) {
        hierarchy[page.parentId].children.push(page.id);
        hierarchy[page.id].parent = page.parentId;
        hierarchy[page.id].level = hierarchy[page.parentId].level + 1;
        hierarchy[page.id].path = [...hierarchy[page.parentId].path, page.title];
      }
    });

    return hierarchy;
  }

  private async saveResults(data: ConfluenceSpace): Promise<void> {
    // 出力ディレクトリの作成
    mkdirSync(this.config.outputDir, { recursive: true });

    // メインデータファイルの保存
    const mainFile = join(this.config.outputDir, 'confluence-data.json');
    writeFileSync(mainFile, JSON.stringify(data, null, 2));
    console.log(`[ConfluenceDataExtractor] Main data saved to: ${mainFile}`);

    // 統計情報の保存
    const stats = {
      totalPages: data.pages.length,
      totalFunctions: this.countFunctions(data.pages),
      spaceKey: data.key,
      spaceName: data.name,
      extractedAt: new Date().toISOString(),
      hierarchy: {
        maxLevel: Math.max(...Object.values(data.hierarchy).map(h => h.level)),
        rootPages: Object.values(data.hierarchy).filter(h => !h.parent).length
      }
    };

    const statsFile = join(this.config.outputDir, 'extraction-stats.json');
    writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    console.log(`[ConfluenceDataExtractor] Statistics saved to: ${statsFile}`);

    // ページ別ファイルの保存（デバッグ用）
    const pagesDir = join(this.config.outputDir, 'pages');
    mkdirSync(pagesDir, { recursive: true });

    data.pages.forEach(page => {
      const pageFile = join(pagesDir, `${page.id}.json`);
      writeFileSync(pageFile, JSON.stringify(page, null, 2));
    });
    console.log(`[ConfluenceDataExtractor] Individual pages saved to: ${pagesDir}`);
  }

  private countFunctions(pages: ConfluencePage[]): number {
    // タイトルから機能数を推定（簡易実装）
    return pages.filter(page => 
      page.title.includes('機能') || 
      page.title.includes('管理') || 
      page.title.includes('システム')
    ).length;
  }
}

// 実行スクリプト
async function main() {
  const config: ExtractionConfig = {
    spaceKey: process.env.CONFLUENCE_SPACE_KEY || 'CLIENTTOMO',
    outputDir: './data/confluence-extraction',
    batchSize: 50,
    includeArchived: false,
    maxPages: 1000 // テスト用に制限
  };

  const extractor = new ConfluenceDataExtractor(config);
  
  try {
    const result = await extractor.extractAllData();
    console.log('Extraction completed successfully!');
    console.log(`Total pages: ${result.pages.length}`);
    console.log(`Space: ${result.name}`);
  } catch (error) {
    console.error('Extraction failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { type ConfluencePage, type ConfluenceSpace, type ExtractionConfig };
