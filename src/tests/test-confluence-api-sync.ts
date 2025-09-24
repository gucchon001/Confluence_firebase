/**
 * 本物のConfluence APIを使用した正しい同期仕様のテスト
 * 
 * 仕様：
 * 1. ページIDが存在しない場合：追加
 * 2. ページIDが存在する場合：更新日時比較
 *    - Confluenceの方が新しい場合：削除して再作成
 *    - 更新がない場合：何もしない
 */

import { LanceDBClient } from '../lib/lancedb-client';
import { UnifiedEmbeddingService } from '../lib/unified-embedding-service';

interface ConfluencePage {
  id: string;
  title: string;
  body?: { storage?: { value: string; }; };
  space?: { key: string; name: string; };
  version?: { when: string; };
  metadata?: { labels?: { results: Array<{ name: string; }>; }; };
}

interface ConfluenceChunk {
  pageId: string;
  title: string;
  content: string;
  chunkIndex: number;
  lastModified: string;
  spaceKey: string;
  embedding: number[];
}

class ConfluenceAPISyncService {
  private lancedbClient: LanceDBClient;
  private embeddingService: UnifiedEmbeddingService;
  private baseUrl: string;
  private username: string;
  private apiToken: string;
  private spaceKey: string;

  constructor() {
    this.lancedbClient = LanceDBClient.getInstance();
    this.embeddingService = UnifiedEmbeddingService.getInstance();
    
    // 環境変数からConfluence設定を取得
    this.baseUrl = process.env.CONFLUENCE_BASE_URL || '';
    this.username = process.env.CONFLUENCE_USER_EMAIL || '';
    this.apiToken = process.env.CONFLUENCE_API_TOKEN || '';
    this.spaceKey = process.env.CONFLUENCE_SPACE_KEY || '';
  }

  /**
   * Confluence APIからページを取得
   */
  async getConfluencePages(limit: number = 10, start: number = 0): Promise<ConfluencePage[]> {
    const url = `${this.baseUrl}/wiki/rest/api/content`;
    const params = new URLSearchParams({
      spaceKey: this.spaceKey,
      expand: 'body.storage,space,version,metadata.labels',
      limit: limit.toString(),
      start: start.toString()
    });

    console.log(`🔍 Confluence API URL: ${url}?${params}`);

    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.username}:${this.apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Confluence API error: ${response.status} ${response.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`Confluence API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`📄 取得したページ数: ${data.results?.length || 0}`);
    return data.results || [];
  }

  /**
   * 正しい仕様に基づく同期処理
   */
  async syncPages(pages: ConfluencePage[]): Promise<{
    added: number;
    updated: number;
    unchanged: number;
    errors: string[];
  }> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const results = {
      added: 0,
      updated: 0,
      unchanged: 0,
      errors: [] as string[]
    };

    console.log(`🔄 ${pages.length}ページの同期を開始します...`);

    for (const page of pages) {
      try {
        // 1. 既存のページを検索
        const existingChunks = await this.findExistingChunks(table, page.id);
        
        if (existingChunks.length === 0) {
          // ページIDが存在しない場合：追加
          console.log(`➕ 新規追加: ${page.title} (${page.id})`);
          await this.addNewPage(table, page);
          results.added++;
        } else {
          // ページIDが存在する場合：更新日時を比較
          const existingLastModified = existingChunks[0].lastModified;
          const confluenceLastModified = page.version?.when || new Date().toISOString();
          
          console.log(`📅 更新日時比較:`);
          console.log(`  既存: ${existingLastModified}`);
          console.log(`  Confluence: ${confluenceLastModified}`);
          
          const existingDate = new Date(existingLastModified);
          const confluenceDate = new Date(confluenceLastModified);
          
          if (confluenceDate > existingDate) {
            // Confluenceの方が新しい場合：削除して再作成
            console.log(`🔄 更新: ${page.title} (${page.id}) - Confluenceが新しい`);
            await this.updateExistingPage(table, page, existingChunks);
            results.updated++;
          } else if (confluenceDate < existingDate) {
            // 既存の方が新しい場合：何もしない
            console.log(`⏭️ 変更なし: ${page.title} (${page.id}) - 既存が新しい`);
            results.unchanged++;
          } else {
            // 同じ日時の場合：何もしない
            console.log(`⏭️ 変更なし: ${page.title} (${page.id}) - 同じ日時`);
            results.unchanged++;
          }
        }
      } catch (error) {
        const errorMsg = `ページ ${page.id} の処理に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(`❌ ${errorMsg}`);
        results.errors.push(errorMsg);
      }
    }

    return results;
  }

  /**
   * 既存のチャンクを検索
   */
  private async findExistingChunks(table: any, pageId: string): Promise<ConfluenceChunk[]> {
    try {
      // ダミーベクトルで検索して、pageIdでフィルタリング
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      const existingChunks = allChunks.filter((chunk: any) => chunk.pageId === pageId);
      console.log(`🔍 ページID ${pageId} の既存チャンク数: ${existingChunks.length}`);
      
      return existingChunks;
    } catch (error) {
      console.error(`既存チャンクの検索に失敗: ${error}`);
      return [];
    }
  }

  /**
   * 新しいページを追加
   */
  private async addNewPage(table: any, page: ConfluencePage): Promise<void> {
    try {
      // ページを2-3チャンクに分割
      const chunks = this.splitPageIntoChunks(page);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // 埋め込みベクトルを生成
        const embedding = await this.embeddingService.generateSingleEmbedding(chunk.content);
        
        // チャンクデータを作成
        const chunkData = {
          pageId: chunk.pageId,
          title: chunk.title,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          lastModified: chunk.lastModified,
          spaceKey: chunk.spaceKey,
          embedding: embedding
        };

        // LanceDBに追加（埋め込み関数を指定）
        await table.add([chunkData], { mode: 'append' });
        console.log(`  ✅ チャンク ${i + 1}/${chunks.length} を追加: ${chunk.title}`);
      }
    } catch (error) {
      console.error(`ページ追加エラー: ${error}`);
      throw error;
    }
  }

  /**
   * 既存ページを更新（削除→再作成）
   */
  private async updateExistingPage(table: any, page: ConfluencePage, existingChunks: ConfluenceChunk[]): Promise<void> {
    try {
      console.log(`  🗑️ 既存チャンク ${existingChunks.length} 件を削除中...`);
      
      // 1. 既存のチャンクを削除
      for (const chunk of existingChunks) {
        await table.delete(`pageId = '${chunk.pageId}'`);
      }
      
      console.log(`  ✅ 既存チャンクの削除完了`);
      
      // 2. 新しいチャンクを追加
      await this.addNewPage(table, page);
      
      console.log(`  ✅ ページ更新完了: ${page.title}`);
    } catch (error) {
      console.error(`ページ更新エラー: ${error}`);
      throw error;
    }
  }

  /**
   * ページをチャンクに分割
   */
  private splitPageIntoChunks(page: ConfluencePage): ConfluenceChunk[] {
    const chunks: ConfluenceChunk[] = [];
    const content = this.extractTextFromHtml(page.body?.storage?.value || '');
    const chunkSize = Math.ceil(content.length / 3); // 3チャンクに分割
    
    for (let i = 0; i < 3; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, content.length);
      const chunkContent = content.substring(start, end);
      
      if (chunkContent.trim()) {
        chunks.push({
          pageId: page.id,
          title: page.title,
          content: chunkContent,
          chunkIndex: i,
          lastModified: page.version?.when || new Date().toISOString(),
          spaceKey: page.space?.key || 'TEST'
        });
      }
    }
    
    return chunks;
  }

  /**
   * HTMLからテキストを抽出
   */
  private extractTextFromHtml(html: string): string {
    // 簡単なHTMLタグ除去
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * データベースの状態を表示
   */
  async showDatabaseStatus(): Promise<void> {
    await this.lancedbClient.connect();
    const table = await this.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    // ページIDごとにグループ化
    const pageGroups = new Map<string, any[]>();
    allChunks.forEach((chunk: any) => {
      if (!pageGroups.has(chunk.pageId)) {
        pageGroups.set(chunk.pageId, []);
      }
      pageGroups.get(chunk.pageId)!.push(chunk);
    });
    
    console.log(`\n📊 データベースの状態:`);
    console.log(`  総チャンク数: ${allChunks.length}`);
    console.log(`  ユニークページ数: ${pageGroups.size}`);
    
    console.log(`\n📋 ページ一覧（最初の10件）:`);
    let count = 0;
    for (const [pageId, chunks] of pageGroups) {
      if (count >= 10) break;
      console.log(`  PageID: ${pageId}, タイトル: ${chunks[0].title}, チャンク数: ${chunks.length}`);
      count++;
    }
  }
}

export { ConfluenceAPISyncService, ConfluencePage, ConfluenceChunk };
