/**
 * Lunr.js-based inverted index for BM25 candidate retrieval
 * Lightweight full-text search engine with good Japanese support
 */

import lunr from 'lunr';
import path from 'path';
import { promises as fs } from 'fs';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { hasIncludedLabel } from './label-utils';
import { labelManager } from './label-manager';

export interface LunrDocument {
  id: string;
  title: string;
  content: string;
  labels: string[];
  pageId: number;
  // 日本語分かち書き用フィールド
  tokenizedTitle: string;
  tokenizedContent: string;
  // 表示用の元のテキスト
  originalTitle: string;
  originalContent: string;
  // URLとメタデータ
  url: string;
  space_key: string;
  lastUpdated: string;
}

export interface LunrSearchResult {
  id: string;
  title: string;
  content: string;
  labels: string[];
  pageId: number;
  score: number;
  // URLとメタデータ
  url: string;
  space_key: string;
  lastUpdated: string;
}

export class LunrSearchClient {
  private static instance: LunrSearchClient | null = null;
  private index: lunr.Index | null = null;
  private documents: Map<string, LunrDocument> = new Map();
  private isInitialized = false;
  private defaultCachePath = path.join('.cache', 'lunr-index.json');

  // シングルトンパターン
  public static getInstance(): LunrSearchClient {
    if (!LunrSearchClient.instance) {
      LunrSearchClient.instance = new LunrSearchClient();
    }
    return LunrSearchClient.instance;
  }

  private constructor() {
    // プライベートコンストラクタ
  }

  async initialize(documents: LunrDocument[]): Promise<void> {
    try {
      console.log(`[LunrSearchClient] Initializing with ${documents.length} documents`);
      
      // ドキュメントをMapに保存
      this.documents.clear();
      for (const doc of documents) {
        this.documents.set(doc.id, doc);
      }

      // Lunrインデックスを日本語用に正しく構築
      this.index = lunr(function() {
        // =================== 日本語対応の重要な修正点 ===================
        
        // 1. 英語用のパイプラインを削除（日本語検索の邪魔になる）
        this.pipeline.remove(lunr.trimmer);
        this.pipeline.remove(lunr.stemmer);
        
        // 2. トークナイザーはデフォルトのスペース区切りを使用
        // （事前にkuromojiで分かち書きしたテキストを処理）
        this.tokenizer = lunr.tokenizer;
        
        // =================== フィールド定義 ===================
        
        // 分かち書き済みのフィールドのみをインデックス対象とする
        this.field('tokenizedTitle', { boost: 2.0 });
        this.field('tokenizedContent', { boost: 1.0 });
        this.field('labels', { boost: 1.5 });
        
        // リファレンス設定
        this.ref('id');
        
        // ドキュメントを追加
        documents.forEach(doc => {
          this.add({
            id: doc.id,
            // インデックスには分かち書き済みテキストのみを追加
            tokenizedTitle: doc.tokenizedTitle,
            tokenizedContent: doc.tokenizedContent,
            labels: doc.labels.join(' '), // 配列をスペース区切りの文字列に変換
          });
        });
      });

      this.isInitialized = true;
      console.log(`[LunrSearchClient] Initialization complete with ${documents.length} documents`);
      console.log(`[LunrSearchClient] Index ready: ${this.index !== null}`);
    } catch (error) {
      console.error('[LunrSearchClient] Initialization failed:', error);
      throw error;
    }
  }

  async loadFromDisk(cachePath: string = this.defaultCachePath): Promise<boolean> {
    try {
      const filePath = path.resolve(cachePath);
      const json = JSON.parse(await fs.readFile(filePath, 'utf-8')) as {
        index: any;
        documents: LunrDocument[];
      };

      this.index = lunr.Index.load(json.index);
      this.documents.clear();
      for (const doc of json.documents) {
        this.documents.set(doc.id, doc);
      }
      this.isInitialized = true;
      console.log(`[LunrSearchClient] Loaded index from cache: ${filePath} (docs=${this.documents.size})`);
      return true;
    } catch (error) {
      console.log('[LunrSearchClient] No cache found or failed to load. Will rebuild.');
      return false;
    }
  }

  async saveToDisk(documents: LunrDocument[], cachePath: string = this.defaultCachePath): Promise<void> {
    if (!this.index) return;
    const filePath = path.resolve(cachePath);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const payload = JSON.stringify({ index: this.index.toJSON(), documents }, null, 0);
    await fs.writeFile(filePath, payload, 'utf-8');
    console.log(`[LunrSearchClient] Saved index cache: ${filePath}`);
  }

  async searchCandidates(
    query: string,
    limit: number = 50
  ): Promise<LunrSearchResult[]> {
    if (!this.index || !this.isInitialized) {
      throw new Error('LunrSearchClient not initialized');
    }

    try {
      // 日本語クエリをトークン化
      const tokenizedQuery = await tokenizeJapaneseText(query);
      console.log(`[LunrSearchClient] Searching with tokenized query: '${tokenizedQuery}'`);

      // 検索実行（トークン化されたクエリを使用）
      // 分かち書き済みフィールドのみを検索対象とする
      const searchResults = this.index.search(tokenizedQuery, {
        fields: {
          tokenizedTitle: { boost: 2.0 },
          tokenizedContent: { boost: 1.0 },
          labels: { boost: 1.5 }
        }
      });

      // 結果を制限して返す
      return searchResults
        .slice(0, limit)
        .map(result => {
          const doc = this.documents.get(result.ref);
          if (!doc) {
            console.warn(`[LunrSearchClient] Document ${result.ref} not found in documents map`);
            return null;
          }

          return {
            id: doc.id,
            title: doc.originalTitle,
            content: doc.originalContent,
            labels: doc.labels,
            pageId: doc.pageId,
            score: result.score,
            url: doc.url,
            space_key: doc.space_key,
            lastUpdated: doc.lastUpdated,
          };
        })
        .filter((result): result is LunrSearchResult => result !== null);
    } catch (error) {
      console.error('[LunrSearchClient] Search failed:', error);
      return [];
    }
  }

  async searchWithFilters(
    query: string,
    filters: {
      labels?: string[];
      excludeLabels?: string[];
    } = {},
    limit: number = 50
  ): Promise<LunrSearchResult[]> {
    if (!this.index || !this.isInitialized) {
      throw new Error('LunrSearchClient not initialized');
    }

    try {
      const tokenizedQuery = await tokenizeJapaneseText(query);
      const searchResults = this.index.search(tokenizedQuery, {
        fields: {
          tokenizedTitle: { boost: 2.0 },
          tokenizedContent: { boost: 1.0 },
          labels: { boost: 1.5 }
        }
      });

      // フィルタリングを適用
      let filteredResults = searchResults;

      if (filters.labels && filters.labels.length > 0) {
        filteredResults = filteredResults.filter(result => {
          const doc = this.documents.get(result.ref);
          if (!doc) return false;
          
          return hasIncludedLabel(doc.labels, filters.labels!);
        });
      }

      if (filters.excludeLabels && filters.excludeLabels.length > 0) {
        filteredResults = filteredResults.filter(result => {
          const doc = this.documents.get(result.ref);
          if (!doc) return false;
          
          return !labelManager.isExcluded(doc.labels, filters.excludeLabels!);
        });
      }

      // 結果を制限して返す
      return filteredResults
        .slice(0, limit)
        .map(result => {
          const doc = this.documents.get(result.ref);
          if (!doc) return null;

          return {
            id: doc.id,
            title: doc.originalTitle,
            content: doc.originalContent,
            labels: doc.labels,
            pageId: doc.pageId,
            score: result.score,
            url: doc.url,
            space_key: doc.space_key,
            lastUpdated: doc.lastUpdated,
          };
        })
        .filter((result): result is LunrSearchResult => result !== null);
    } catch (error) {
      console.error('[LunrSearchClient] Filtered search failed:', error);
      return [];
    }
  }

  async getDocumentCount(): Promise<number> {
    return this.documents.size;
  }

  async getAverageTitleLength(): Promise<number> {
    if (this.documents.size === 0) return 0;

    const totalLength = Array.from(this.documents.values()).reduce((sum, doc) => {
      return sum + (doc.originalTitle?.length || 0);
    }, 0);

    return totalLength / this.documents.size;
  }

  isReady(): boolean {
    return this.isInitialized && this.index !== null;
  }

  getStatus(): { isInitialized: boolean; documentCount: number; hasIndex: boolean } {
    return {
      isInitialized: this.isInitialized,
      documentCount: this.documents.size,
      hasIndex: this.index !== null
    };
  }

  async destroy(): Promise<void> {
    this.index = null;
    this.documents.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
export const lunrSearchClient = LunrSearchClient.getInstance();
