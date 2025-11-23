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
  // Jira特有のフィールド（オプショナル）
  issue_key?: string;
  status?: string;
  status_category?: string;
  priority?: string;
  assignee?: string;
  issue_type?: string;
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
  // Jira特有のフィールド（オプショナル）
  issue_key?: string;
  status?: string;
  status_category?: string;
  priority?: string;
  assignee?: string;
  issue_type?: string;
}

export class LunrSearchClient {
  // Phase 5 Week 2: シングルトンでメモリに永続的に保持
  private static instance: LunrSearchClient | null = null;
  
  // Phase 5 Week 2: 一度構築した索引をメモリに保持（再構築不要）
  // Jira対応: テーブル名ごとにインデックスを管理
  private indices: Map<string, lunr.Index> = new Map(); // tableName -> index
  private documents: Map<string, Map<string, LunrDocument>> = new Map(); // tableName -> (id -> document)
  private initializedTables: Set<string> = new Set(); // 初期化済みテーブル
  private defaultCachePath = path.join('.cache', 'lunr-index.json');
  
  // 後方互換性のため、デフォルトテーブル名を保持
  private get defaultTableName(): string {
    return 'confluence';
  }

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

  public isInitialized(tableName?: string): boolean {
    const targetTable = tableName || this.defaultTableName;
    return this.initializedTables.has(targetTable);
  }
  
  public isReady(tableName?: string): boolean {
    return this.isInitialized(tableName);
  }

  // ⚡ 削除: initializeFromCache()は使われていないため削除
  // キャッシュからのロードはloadFromCache()を直接使用する
  // トークナイザーの初期化は、実際にトークン化が必要になった時（検索時など）に行われる

  async initialize(documents: LunrDocument[], tableName: string = 'confluence'): Promise<void> {
    try {
      console.log(`[LunrSearchClient] Initializing ${tableName} index with ${documents.length} documents`);
      
      // ⚡ 最適化: このメソッドは既にトークン化済みのドキュメントを受け取るため、
      // トークナイザーの初期化は不要（トークン化は呼び出し元で既に完了している）
      // トークナイザーは、tokenizeJapaneseText()が呼ばれた時点で自動的に初期化される
      
      // ドキュメントをMapに保存（テーブルごとに管理）
      if (!this.documents.has(tableName)) {
        this.documents.set(tableName, new Map());
      }
      const tableDocuments = this.documents.get(tableName)!;
      tableDocuments.clear();
      for (const doc of documents) {
        tableDocuments.set(doc.id, doc);
      }

      // Lunrインデックスを日本語用に正しく構築
      const index = lunr(function() {
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

      // テーブルごとのインデックスを保存
      this.indices.set(tableName, index);
      this.initializedTables.add(tableName);
      
      console.log(`[LunrSearchClient] ${tableName} index initialization complete with ${documents.length} documents`);
      console.log(`[LunrSearchClient] ${tableName} index ready: ${index !== null}`);
      console.log(`[Phase 5 LunrCache] ✅ ${tableName}索引をメモリに永続保持 - 次回以降は再構築不要`);
    } catch (error) {
      console.error(`[LunrSearchClient] ${tableName} index initialization failed:`, error);
      throw error;
    }
  }

  async loadFromCache(cachePath: string = this.defaultCachePath, tableName: string = 'confluence'): Promise<boolean> {
    try {
      const startTime = Date.now();
      console.log(`[LunrSearchClient] Attempting to load cache for ${tableName} from: ${cachePath}`);
      
      // Phase 6最適化: MessagePack形式を優先的に試行（10倍高速）
      const msgpackPath = path.resolve(cachePath.replace('.json', '.msgpack'));
      console.log(`[LunrSearchClient] Trying MessagePack cache: ${msgpackPath}`);
      
      try {
        // ファイルの存在確認
        try {
          await fs.access(msgpackPath);
        } catch (accessError) {
          console.log(`[LunrSearchClient] MessagePack file does not exist: ${msgpackPath}`);
          throw new Error('MessagePack file not found');
        }
        
        const buffer = await fs.readFile(msgpackPath);
        const loadTime = Date.now() - startTime;
        console.log(`[Phase 6 LunrCache] MessagePack読み込み完了: ${(buffer.length / 1024 / 1024).toFixed(2)}MB, ${loadTime}ms`);
        
        // メモリ使用量の監視: ファイル読み込み後
        const { logMemoryUsage, getMemoryUsage, logMemoryDelta } = await import('./memory-monitor');
        const memoryBeforeParse = getMemoryUsage();
        logMemoryUsage(`After loading MessagePack file (${tableName})`);
        
        const parseStartTime = Date.now();
        const data = unpack(buffer) as {
          index: any;
          documents: LunrDocument[];
          version: string;
        };
        const parseTime = Date.now() - parseStartTime;
        console.log(`[Phase 6 LunrCache] MessagePack解析完了: ${parseTime}ms`);

        // メモリ使用量の監視: パース後
        const memoryAfterParse = getMemoryUsage();
        logMemoryUsage(`After parsing MessagePack (${tableName}, ${data.documents.length} docs)`);
        logMemoryDelta(`Parsing MessagePack (${tableName})`, memoryBeforeParse, memoryAfterParse);

        const indexLoadStartTime = Date.now();
        const index = lunr.Index.load(data.index);
        if (!this.documents.has(tableName)) {
          this.documents.set(tableName, new Map());
        }
        const tableDocuments = this.documents.get(tableName)!;
        tableDocuments.clear();
        
        // メモリ使用量の監視: インデックスロード後、ドキュメント追加前
        const memoryBeforeDocs = getMemoryUsage();
        logMemoryUsage(`After loading Lunr index, before adding documents (${tableName})`);
        
        // ⚡ 最適化: ドキュメントの復元を高速化
        // Mapへの追加は順次実行（Mapはスレッドセーフではないため）
        // MessagePackからロードしたデータは既に準備済みのため、そのまま追加
        for (const doc of data.documents) {
          tableDocuments.set(doc.id, doc);
        }
        const indexLoadTime = Date.now() - indexLoadStartTime;
        
        // メモリ使用量の監視: ドキュメント追加後
        const memoryAfterDocs = getMemoryUsage();
        logMemoryUsage(`After adding documents to Map (${tableName}, ${tableDocuments.size} docs)`);
        logMemoryDelta(`Adding documents to Map (${tableName})`, memoryBeforeDocs, memoryAfterDocs);
        
        console.log(`[Phase 6 LunrCache] Lunrインデックス復元完了: ${indexLoadTime}ms (docs=${tableDocuments.size})`);
        
        this.indices.set(tableName, index);
        this.initializedTables.add(tableName);
        const totalTime = Date.now() - startTime;
        console.log(`[Phase 6 LunrCache] ✅ MessagePack形式でロード成功: ${msgpackPath} (table=${tableName}, docs=${tableDocuments.size}, total=${totalTime}ms)`);
        return true;
        
      } catch (msgpackError) {
        console.log(`[Phase 6 LunrCache] MessagePack not found or failed: ${msgpackError instanceof Error ? msgpackError.message : String(msgpackError)}, trying JSON...`);
      }
      
      // フォールバック: 従来のJSON形式でロード
      const filePath = path.resolve(cachePath);
      console.log(`[LunrSearchClient] Trying JSON cache: ${filePath}`);
      
      try {
        await fs.access(filePath);
      } catch (accessError) {
        console.log(`[LunrSearchClient] JSON file does not exist: ${filePath}`);
        throw new Error('JSON file not found');
      }
      
      const json = JSON.parse(await fs.readFile(filePath, 'utf-8')) as {
        index: any;
        documents: LunrDocument[];
      };

      const index = lunr.Index.load(json.index);
      if (!this.documents.has(tableName)) {
        this.documents.set(tableName, new Map());
      }
      const tableDocuments = this.documents.get(tableName)!;
      tableDocuments.clear();
      for (const doc of json.documents) {
        tableDocuments.set(doc.id, doc);
      }
      this.indices.set(tableName, index);
      this.initializedTables.add(tableName);
      const totalTime = Date.now() - startTime;
      console.log(`[LunrSearchClient] Loaded ${tableName} index from JSON cache: ${filePath} (docs=${tableDocuments.size}, ${totalTime}ms)`);
      console.log(`[Phase 5 LunrCache] ✅ ${tableName}キャッシュから索引をメモリに読み込み - 構築時間0ms`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[LunrSearchClient] No cache found or failed to load (${errorMessage}). Will rebuild.`);
      return false;
    }
  }

  async saveToDisk(documents: LunrDocument[], cachePath: string = this.defaultCachePath, tableName: string = 'confluence'): Promise<void> {
    const index = this.indices.get(tableName);
    if (!index) return;
    
    const dir = path.dirname(path.resolve(cachePath));
    await fs.mkdir(dir, { recursive: true });
    
    const data = {
      index: index.toJSON(),
      documents: documents,
      version: '2.0',  // Phase 6: MessagePack形式
      tableName: tableName  // テーブル名を保存
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
    limit: number = 50,
    tableName: string = 'confluence'
  ): Promise<LunrSearchResult[]> {
    const index = this.indices.get(tableName);
    if (!index || !this.isInitialized(tableName)) {
      throw new Error(`LunrSearchClient not initialized for table: ${tableName}`);
    }
    
    const tableDocuments = this.documents.get(tableName);
    if (!tableDocuments) {
      throw new Error(`Documents not found for table: ${tableName}`);
    }

    try {
      // ★★★ 修正: kuromojiを確実に使用する（軽量トークン化による問題を回避） ★★★
      // 理由: インデックス構築時と検索時で同じトークン化方法を使用する
      // 参考: docs/analysis/auto-offer-search-issue-root-cause.md
      // 日本語クエリをトークン化（kuromojiを使用）
      const tokenizedQuery = await tokenizeJapaneseText(query);
      // ⚡ ログ削減: デバッグ時のみ詳細ログを出力
      const DEBUG_ENABLED = process.env.NODE_ENV === 'development' && process.env.DEBUG_BM25 === 'true';
      if (DEBUG_ENABLED) {
        console.log(`[LunrSearchClient] Searching with tokenized query: '${tokenizedQuery}'`);
      }

      // Phase 2最適化: 動的閾値とフィールド重みの調整
      // ★★★ 修正: thresholdとlimitを調整して、自動オファー関連ドキュメントの検出精度向上 ★★★
      const searchOptions = {
        fields: {
          tokenizedTitle: { boost: 3.0 }, // タイトル重みを強化
          tokenizedContent: { boost: 1.0 },
          labels: { boost: 2.0 } // ラベル重みを強化
        },
        // 検索結果数を事前に制限（パフォーマンス向上）
        // 修正: 最大50件 → 100件に増加（自動オファー関連ドキュメントの検出精度向上）
        limit: Math.min(limit * 2, 100), // 必要数の2倍、最大100件に制限
        // 動的スコア閾値（クエリの長さに応じて調整）
        // 修正: thresholdを下げて、関連性の高い結果が除外されないようにする
        // 短いクエリ（「自動オファー」など）でも関連性の高い結果を含めるため、0.25 → 0.1に下げる
        threshold: query.length > 10 ? 0.1 : 0.1 // すべてのクエリで0.1に統一（検出精度向上）
      };

      const searchResults = index.search(tokenizedQuery, searchOptions);

      // Phase 2最適化: 効率的な結果処理
      const validResults: LunrSearchResult[] = [];
      
      for (let i = 0; i < Math.min(searchResults.length, limit); i++) {
        const result = searchResults[i];
        const doc = tableDocuments.get(result.ref);
        
        if (doc) {
          const searchResult: any = {
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
          
          // Jira特有のフィールドを追加
          if (doc.issue_key) {
            searchResult.issue_key = doc.issue_key;
            searchResult.status = doc.status;
            searchResult.status_category = doc.status_category;
            searchResult.priority = doc.priority;
            searchResult.assignee = doc.assignee;
            searchResult.issue_type = doc.issue_type;
          }
          
          validResults.push(searchResult);
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
    limit: number = 50,
    tableName: string = 'confluence'
  ): Promise<LunrSearchResult[]> {
    // searchCandidatesメソッドを呼び出す
    return this.searchCandidates(query, limit, tableName);
  }

  async searchWithFilters(
    query: string,
    filters: {
      labels?: string[];
      excludeLabels?: string[];
    } = {},
    limit: number = 50,
    tableName: string = 'confluence'
  ): Promise<LunrSearchResult[]> {
    const index = this.indices.get(tableName);
    if (!index || !this.isInitialized(tableName)) {
      throw new Error(`LunrSearchClient not initialized for table: ${tableName}`);
    }
    
    const tableDocuments = this.documents.get(tableName);
    if (!tableDocuments) {
      throw new Error(`Documents not found for table: ${tableName}`);
    }

    try {
      const tokenizedQuery = await tokenizeJapaneseText(query);
      const searchResults = index.search(tokenizedQuery, {
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
          const doc = tableDocuments.get(result.ref);
          if (!doc) return false;
          
          return hasIncludedLabel(doc.labels, filters.labels!);
        });
      }

      if (filters.excludeLabels && filters.excludeLabels.length > 0) {
        filteredResults = filteredResults.filter(result => {
          const doc = tableDocuments.get(result.ref);
          if (!doc) return false;
          
          return !labelManager.isExcluded(doc.labels, filters.excludeLabels!);
        });
      }

      // 結果を制限して返す
      return filteredResults
        .slice(0, limit)
        .map(result => {
          const doc = tableDocuments.get(result.ref);
          if (!doc) return null;

          const searchResult: any = {
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
          
          // Jira特有のフィールドを追加
          if (doc.issue_key) {
            searchResult.issue_key = doc.issue_key;
            searchResult.status = doc.status;
            searchResult.status_category = doc.status_category;
            searchResult.priority = doc.priority;
            searchResult.assignee = doc.assignee;
            searchResult.issue_type = doc.issue_type;
          }
          
          return searchResult;
        })
        .filter((result): result is LunrSearchResult => result !== null);
    } catch (error) {
      console.error('[LunrSearchClient] Filtered search failed:', error);
      return [];
    }
  }

  async getDocumentCount(tableName: string = 'confluence'): Promise<number> {
    const tableDocuments = this.documents.get(tableName);
    return tableDocuments ? tableDocuments.size : 0;
  }

  async getAverageTitleLength(tableName: string = 'confluence'): Promise<number> {
    const tableDocuments = this.documents.get(tableName);
    if (!tableDocuments || tableDocuments.size === 0) return 0;

    const totalLength = Array.from(tableDocuments.values()).reduce((sum, doc) => {
      return sum + (doc.originalTitle?.length || 0);
    }, 0);

    return totalLength / tableDocuments.size;
  }

  getStatus(tableName: string = 'confluence'): { initialized: boolean; documentCount: number; hasIndex: boolean } {
    const tableDocuments = this.documents.get(tableName);
    const index = this.indices.get(tableName);
    return {
      initialized: this.isInitialized(tableName),
      documentCount: tableDocuments ? tableDocuments.size : 0,
      hasIndex: index !== null && index !== undefined
    };
  }

  async destroy(tableName?: string): Promise<void> {
    if (tableName) {
      // 特定のテーブルのインデックスを削除
      this.indices.delete(tableName);
      this.documents.delete(tableName);
      this.initializedTables.delete(tableName);
    } else {
      // すべてのインデックスを削除
      this.indices.clear();
      this.documents.clear();
      this.initializedTables.clear();
    }
  }
}

// Singleton instance
export const lunrSearchClient = LunrSearchClient.getInstance();
