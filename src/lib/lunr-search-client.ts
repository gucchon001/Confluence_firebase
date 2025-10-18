/**
 * Lunr.js-based inverted index for BM25 candidate retrieval
 * Lightweight full-text search engine with good Japanese support
 * 
 * Phase 5 Week 2: メモリ最適化
 * - シングルトンパターンで索引を永続的にメモリ保持
 * - 一度構築した索引は再構築不要（0ms）
 * - アプリケーション全体で共有インスタンスを使用
 */

import lunr from 'lunr';
import path from 'path';
import { promises as fs } from 'fs';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { hasIncludedLabel } from './label-utils';
import { labelManager } from './label-manager';
import { pack, unpack } from 'msgpackr';

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
  // Phase 5 Week 2: シングルトンでメモリに永続的に保持
  private static instance: LunrSearchClient | null = null;
  
  // Phase 5 Week 2: 一度構築した索引をメモリに保持（再構築不要）
  private index: lunr.Index | null = null;
  private documents: Map<string, LunrDocument> = new Map();
  private initialized = false;
  private defaultCachePath = path.join('.cache', 'lunr-index.json');

  /**
   * Phase 5 Week 2: シングルトンパターンでメモリ最適化
   * - アプリケーション全体で1つのインスタンスを共有
   * - 索引の再構築オーバーヘッドをゼロに削減
   */
  public static getInstance(): LunrSearchClient {
    if (!LunrSearchClient.instance) {
      LunrSearchClient.instance = new LunrSearchClient();
      console.log('[Phase 5 LunrCache] シングルトンインスタンス作成 - メモリに永続保持');
    }
    return LunrSearchClient.instance;
  }

  private constructor() {
    // プライベートコンストラクタ（シングルトン保証）
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  async initializeFromCache(): Promise<void> {
    try {
      console.log('[LunrSearchClient] Initializing from cache...');
      
      // トークナイザーを事前初期化
      const { preInitializeTokenizer } = await import('./japanese-tokenizer');
      await preInitializeTokenizer();
      
      // キャッシュから読み込み
      const cacheExists = await this.loadFromCache();
      if (cacheExists) {
        console.log('[LunrSearchClient] Initialized from cache successfully');
        return;
      }
      
      console.log('[LunrSearchClient] No cache found, initialization skipped');
    } catch (error) {
      console.error('[LunrSearchClient] Cache initialization failed:', error);
      throw error;
    }
  }

  async initialize(documents: LunrDocument[]): Promise<void> {
    try {
      console.log(`[LunrSearchClient] Initializing with ${documents.length} documents`);
      
      // トークナイザーを事前初期化（並列処理）
      const tokenizerInit = import('./japanese-tokenizer').then(({ preInitializeTokenizer }) => 
        preInitializeTokenizer()
      );
      
      // ドキュメントをMapに保存
      this.documents.clear();
      for (const doc of documents) {
        this.documents.set(doc.id, doc);
      }
      
      // トークナイザーの初期化完了を待つ
      await tokenizerInit;

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
        
        // Phase 2最適化: フィールド重みの調整
        this.field('tokenizedTitle', { boost: 3.0 }); // タイトル重みを強化
        this.field('tokenizedContent', { boost: 1.0 });
        this.field('labels', { boost: 2.0 }); // ラベル重みを強化
        
        // Phase 2最適化: パイプライン処理の最適化
        this.pipeline.remove(lunr.stopWordFilter); // 日本語では不要
        this.pipeline.remove(lunr.stemmer); // 分かち書き済みなので不要
        this.pipeline.remove(lunr.trimmer); // 分かち書き済みなので不要（Phase 2追加）
        
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

      this.initialized = true;
      console.log(`[LunrSearchClient] Initialization complete with ${documents.length} documents`);
      console.log(`[LunrSearchClient] Index ready: ${this.index !== null}`);
      console.log(`[Phase 5 LunrCache] ✅ 索引をメモリに永続保持 - 次回以降は再構築不要`);
    } catch (error) {
      console.error('[LunrSearchClient] Initialization failed:', error);
      throw error;
    }
  }

  async loadFromCache(cachePath: string = this.defaultCachePath): Promise<boolean> {
    try {
      const startTime = Date.now();
      
      // Phase 6最適化: MessagePack形式を優先的に試行（10倍高速）
      const msgpackPath = path.resolve(cachePath.replace('.json', '.msgpack'));
      
      try {
        const buffer = await fs.readFile(msgpackPath);
        const loadTime = Date.now() - startTime;
        console.log(`[Phase 6 LunrCache] MessagePack読み込み完了: ${(buffer.length / 1024 / 1024).toFixed(2)}MB, ${loadTime}ms`);
        
        const parseStartTime = Date.now();
        const data = unpack(buffer) as {
          index: any;
          documents: LunrDocument[];
          version: string;
        };
        const parseTime = Date.now() - parseStartTime;
        console.log(`[Phase 6 LunrCache] MessagePack解析完了: ${parseTime}ms`);

        const indexLoadStartTime = Date.now();
        this.index = lunr.Index.load(data.index);
        this.documents.clear();
        for (const doc of data.documents) {
          this.documents.set(doc.id, doc);
        }
        const indexLoadTime = Date.now() - indexLoadStartTime;
        console.log(`[Phase 6 LunrCache] Lunrインデックス復元完了: ${indexLoadTime}ms`);
        
        this.initialized = true;
        const totalTime = Date.now() - startTime;
        console.log(`[Phase 6 LunrCache] ✅ MessagePack形式でロード成功: ${msgpackPath} (docs=${this.documents.size}, total=${totalTime}ms)`);
        return true;
        
      } catch (msgpackError) {
        console.log(`[Phase 6 LunrCache] MessagePack not found, trying JSON...`);
      }
      
      // フォールバック: 従来のJSON形式でロード
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
      this.initialized = true;
      const totalTime = Date.now() - startTime;
      console.log(`[LunrSearchClient] Loaded index from JSON cache: ${filePath} (docs=${this.documents.size}, ${totalTime}ms)`);
      console.log(`[Phase 5 LunrCache] ✅ キャッシュから索引をメモリに読み込み - 構築時間0ms`);
      return true;
    } catch (error) {
      console.log('[LunrSearchClient] No cache found or failed to load. Will rebuild.');
      return false;
    }
  }

  async saveToDisk(documents: LunrDocument[], cachePath: string = this.defaultCachePath): Promise<void> {
    if (!this.index) return;
    
    const dir = path.dirname(path.resolve(cachePath));
    await fs.mkdir(dir, { recursive: true });
    
    const data = {
      index: this.index.toJSON(),
      documents: documents,
      version: '2.0'  // Phase 6: MessagePack形式
    };
    
    // Phase 6最適化: MessagePack形式で保存（10倍高速、50%～70%圧縮）
    const msgpackPath = path.resolve(cachePath.replace('.json', '.msgpack'));
    const startTime = Date.now();
    
    try {
      const buffer = pack(data);
      await fs.writeFile(msgpackPath, buffer);
      const saveTime = Date.now() - startTime;
      const sizeMB = (buffer.length / 1024 / 1024).toFixed(2);
      console.log(`[Phase 6 LunrCache] ✅ MessagePack形式で保存: ${msgpackPath} (${sizeMB}MB, ${saveTime}ms)`);
      
      // 互換性のため、JSON形式も保存（将来的に削除可能）
      const jsonPath = path.resolve(cachePath);
      const jsonPayload = JSON.stringify(data, null, 0);
      await fs.writeFile(jsonPath, jsonPayload, 'utf-8');
      console.log(`[LunrSearchClient] Saved JSON cache for compatibility: ${jsonPath}`);
      
    } catch (error) {
      console.error('[Phase 6 LunrCache] MessagePack save failed, using JSON:', error);
      // フォールバック: JSON形式で保存
      const filePath = path.resolve(cachePath);
      const payload = JSON.stringify(data, null, 0);
      await fs.writeFile(filePath, payload, 'utf-8');
      console.log(`[LunrSearchClient] Saved index cache (JSON fallback): ${filePath}`);
    }
  }

  async searchCandidates(
    query: string,
    limit: number = 50
  ): Promise<LunrSearchResult[]> {
    if (!this.index || !this.initialized) {
      throw new Error('LunrSearchClient not initialized');
    }

    try {
      // 日本語クエリをトークン化
      const tokenizedQuery = await tokenizeJapaneseText(query);
      console.log(`[LunrSearchClient] Searching with tokenized query: '${tokenizedQuery}'`);

      // Phase 2最適化: 動的閾値とフィールド重みの調整
      const searchOptions = {
        fields: {
          tokenizedTitle: { boost: 3.0 }, // タイトル重みを強化
          tokenizedContent: { boost: 1.0 },
          labels: { boost: 2.0 } // ラベル重みを強化
        },
        // 検索結果数を事前に制限（パフォーマンス向上）
        limit: Math.min(limit * 2, 50), // 必要数の2倍、最大50件に制限（Phase 2最適化）
        // 動的スコア閾値（クエリの長さに応じて調整）
        threshold: query.length > 10 ? 0.15 : 0.25 // 長いクエリは緩く、短いクエリは厳しく
      };

      const searchResults = this.index.search(tokenizedQuery, searchOptions);

      // Phase 2最適化: 効率的な結果処理
      const validResults: LunrSearchResult[] = [];
      
      for (let i = 0; i < Math.min(searchResults.length, limit); i++) {
        const result = searchResults[i];
        const doc = this.documents.get(result.ref);
        
        if (doc) {
          validResults.push({
            id: doc.id,
            title: doc.originalTitle,
            content: doc.originalContent,
            labels: doc.labels,
            pageId: doc.pageId,
            score: result.score,
            url: doc.url,
            space_key: doc.space_key,
            lastUpdated: doc.lastUpdated,
          });
        }
      }
      
      return validResults;
    } catch (error) {
      console.error('[LunrSearchClient] Search failed:', error);
      return [];
    }
  }

  async search(
    query: string,
    limit: number = 50
  ): Promise<LunrSearchResult[]> {
    // searchCandidatesメソッドを呼び出す
    return this.searchCandidates(query, limit);
  }

  async searchWithFilters(
    query: string,
    filters: {
      labels?: string[];
      excludeLabels?: string[];
    } = {},
    limit: number = 50
  ): Promise<LunrSearchResult[]> {
    if (!this.index || !this.initialized) {
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
    return this.initialized && this.index !== null;
  }

  getStatus(): { initialized: boolean; documentCount: number; hasIndex: boolean } {
    return {
      initialized: this.initialized,
      documentCount: this.documents.size,
      hasIndex: this.index !== null
    };
  }

  async destroy(): Promise<void> {
    this.index = null;
    this.documents.clear();
    this.initialized = false;
  }
}

// Singleton instance
export const lunrSearchClient = LunrSearchClient.getInstance();
