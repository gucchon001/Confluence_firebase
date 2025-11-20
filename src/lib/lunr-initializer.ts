/**
 * Lunr.js index initialization manager
 * Handles asynchronous initialization of Lunr search index
 * 
 * Phase 5最適化:
 * - インスタンスIDによる初期化追跡
 * - Promise保持による競合状態防止
 * - 詳細なログ出力でパフォーマンス監視
 */

import { LunrSearchClient, LunrDocument } from './lunr-search-client';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { lancedbClient } from './lancedb-client';
import { getLabelsAsArray } from './label-utils';
import * as path from 'path';
import crypto from 'crypto';

// インスタンスIDを生成（サーバー起動時に1回のみ）
const INSTANCE_ID = crypto.randomUUID().substring(0, 8);
console.log(`[LUNR_INIT] 🆔 Instance started with ID: ${INSTANCE_ID}`);

/**
 * HTMLタグを除去してテキストのみを抽出
 */
function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  // HTMLタグを除去
  let text = html.replace(/<[^>]*>/g, '');
  
  // HTMLエンティティをデコード
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // 連続する空白を単一の空白に置換
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

interface LunrInitializerStatus {
  isInitialized: boolean;
  isInitializing: boolean;
  documentCount: number;
  lastUpdated: Date | null;
  error: string | null;
  initializationCount: number; // 初期化回数を追跡
}

export class LunrInitializer {
  private status: LunrInitializerStatus = {
    isInitialized: false,
    isInitializing: false,
    documentCount: 0,
    lastUpdated: null,
    error: null,
    initializationCount: 0,
  };
  
  // Phase 5最適化: Promise保持による競合状態防止（テーブルごとに管理）
  private initializationPromises: Map<string, Promise<void>> = new Map();
  private initializedTables: Set<string> = new Set(); // 初期化済みテーブル

  async initializeAsync(tableName: string = 'confluence'): Promise<void> {
    // Phase 5最適化: 既に初期化済みの場合は即座にreturn
    if (this.initializedTables.has(tableName)) {
      console.log(`[LUNR_CACHE_HIT] ✅ Instance ${INSTANCE_ID}: Reusing existing Lunr index for ${tableName} (count: ${this.status.initializationCount})`);
      return;
    }
    
    // Phase 5最適化: 初期化中の場合は同じPromiseを返す（競合防止）
    const existingPromise = this.initializationPromises.get(tableName);
    if (existingPromise) {
      console.log(`[LUNR_WAITING] ⏳ Instance ${INSTANCE_ID}: Waiting for ongoing ${tableName} initialization...`);
      return existingPromise;
    }

    // Phase 5最適化: 新しい初期化を開始
    console.log(`[LUNR_CACHE_MISS] 🚀 Instance ${INSTANCE_ID}: Starting new Lunr initialization for ${tableName}...`);
    this.status.isInitializing = true;
    this.status.error = null;
    
    // Promiseを保持して、同時リクエストが待機できるようにする
    const promise = this._performInitialization(tableName);
    this.initializationPromises.set(tableName, promise);
    
    try {
      await promise;
      this.initializedTables.add(tableName);
    } finally {
      this.status.isInitializing = false;
      this.initializationPromises.delete(tableName);
    }
  }
  
  private async _performInitialization(tableName: string = 'confluence'): Promise<void> {
    try {
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Starting Lunr index initialization for ${tableName}...`);
      const startTime = Date.now();
      
      // ⚡ 最適化: まずキャッシュからロードを試みる（kuromoji初期化の前に実行）
      // キャッシュがあれば、kuromoji初期化をスキップして高速化
      const lunrSearchClient = LunrSearchClient.getInstance();
      
      // キャッシュパスを環境に応じて決定（Cloud Runでは.next/standalone/.cacheを使用）
      const { appConfig } = await import('../config/app-config');
      const isCloudRun = appConfig.deployment.isCloudRun;
      const cacheDir = isCloudRun 
        ? path.join(process.cwd(), '.next', 'standalone', '.cache')
        : path.join(process.cwd(), '.cache');
      
      const cachePath = tableName === 'confluence' 
        ? path.join(cacheDir, 'lunr-index.json')
        : path.join(cacheDir, `lunr-index-${tableName}.json`);
      
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Checking cache at: ${cachePath}`);
      const loaded = await lunrSearchClient.loadFromCache(cachePath, tableName);
      if (loaded) {
        // キャッシュからロード成功時は、LunrSearchClientの状態を信頼
        // LunrSearchClientがinitializedTablesに追加しているため、ここでも同期
        this.initializedTables.add(tableName);
        this.status.isInitialized = true;
        this.status.initializationCount++;
        this.status.documentCount = await lunrSearchClient.getDocumentCount(tableName);
        this.status.lastUpdated = new Date();
        const duration = Date.now() - startTime;
        console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Loaded ${tableName} Lunr from cache in ${duration}ms (count: ${this.status.initializationCount})`);
        return;
      }
      
      // キャッシュが見つからない場合のみ、kuromojiを初期化して再構築
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Cache not found or failed to load, will rebuild from LanceDB`);
      
      // ⚡ 最適化: トークナイザーの初期化はlunrSearchClient.initialize()で行われるため、ここでは不要
      // 重複初期化を防ぐため、ここでは初期化しない

      // LanceDBからドキュメントを取得（指定されたテーブルから）
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Fetching documents from LanceDB table: ${tableName}...`);
      const dbStartTime = Date.now();
      const dbPath = path.resolve(process.cwd(), '.lancedb');
      const db = await import('@lancedb/lancedb').then(m => m.connect(dbPath));
      
      // テーブル存在確認（存在しない場合は早期リターン）
      const tableNames = await db.tableNames();
      if (!tableNames.includes(tableName)) {
        console.warn(`[LunrInitializer] Instance ${INSTANCE_ID}: ⚠️ Table '${tableName}' not found in LanceDB. Skipping initialization.`);
        console.warn(`[LunrInitializer] Instance ${INSTANCE_ID}: Available tables: ${tableNames.join(', ')}`);
        // テーブルが存在しない場合はエラーをスローせず、初期化をスキップ
        return;
      }
      
      const tbl = await db.openTable(tableName);
      
      // 全ドキュメントを取得
      const docs = await tbl.query().limit(10000).toArray();
      const dbDuration = Date.now() - dbStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Retrieved ${docs.length} documents in ${dbDuration}ms`);

      // ドキュメントをLunr形式に変換（日本語トークン化を含む）
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Tokenizing documents...`);
      const tokenizeStartTime = Date.now();
      const lunrDocs: LunrDocument[] = [];
      
      // ⚡ 最適化: トークン化処理を並列化（バッチ処理でメモリ使用量を制限）
      // バッチサイズを100に増やして並列度を向上（初期化時間の短縮）
      const BATCH_SIZE = 100; // 並列処理するドキュメント数（50 → 100に増加）
      const batches: typeof docs[] = [];
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        batches.push(docs.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Processing ${docs.length} documents in ${batches.length} batches (${BATCH_SIZE} per batch)`);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchStartTime = Date.now();
        
        // バッチ内のドキュメントを並列処理
        const batchPromises = batch.map(async (doc) => {
          try {
            // HTMLタグを除去してからトークン化
            const cleanTitle = stripHtmlTags(doc.title || '');
            const cleanContent = stripHtmlTags(doc.content || '');
            
              // タイトルとコンテンツを並列でトークン化
            const [tokenizedTitle, tokenizedContent] = await Promise.all([
              tokenizeJapaneseText(cleanTitle),
              tokenizeJapaneseText(cleanContent)
            ]);
            
            // ラベルを配列として処理
            let labels: string[] = [];
            if (doc.labels) {
              labels = getLabelsAsArray(doc.labels);
            }

            // Jiraテーブルの場合はissue_keyを使用、Confluenceテーブルの場合はpageIdを使用
            let pageId = 0;
            let docId = doc.id || '';
            let spaceKey = doc.space_key || '';
            
            if (tableName === 'jira_issues') {
              // Jiraの場合はissue_keyをidとして使用
              docId = doc.issue_key || doc.id || '';
              // pageIdは0に設定（Jiraでは使用しない）
              pageId = 0;
              // space_keyは存在しないため空文字列
              spaceKey = '';
            } else {
              // Confluenceの場合はpageIdを使用
              const { getPageIdFromRecord } = await import('./pageid-migration-helper');
              pageId = getPageIdFromRecord(doc) || doc.pageId || 0;
              spaceKey = doc.space_key || '';
            }
            
            const lunrDoc: any = {
              id: docId,
              title: cleanTitle,
              content: cleanContent,
              labels,
              pageId: pageId,
              tokenizedTitle,
              tokenizedContent,
              originalTitle: doc.title || '',
              originalContent: doc.content || '',
              url: doc.url || '',
              space_key: spaceKey,
              lastUpdated: doc.lastUpdated || doc.updated_at || '',
            };
            
            // Jira特有のフィールドを追加
            if (tableName === 'jira_issues') {
              lunrDoc.issue_key = doc.issue_key || doc.id || '';
              lunrDoc.status = doc.status || '';
              lunrDoc.status_category = doc.status_category || '';
              lunrDoc.priority = doc.priority || '';
              lunrDoc.assignee = doc.assignee || '';
              lunrDoc.issue_type = doc.issue_type || '';
            }
            
            return lunrDoc;
          } catch (error) {
            console.warn(`[LunrInitializer] Instance ${INSTANCE_ID}: Failed to process document ${doc.id}:`, error);
            // エラーが発生したドキュメントはnullを返す（後でフィルタリング）
            return null;
          }
        });
        
        // バッチ内のすべてのドキュメントを並列処理
        const batchResults = await Promise.all(batchPromises);
        
        // null（エラー）を除外してlunrDocsに追加
        for (const result of batchResults) {
          if (result !== null) {
            lunrDocs.push(result);
          }
        }
        
        const batchDuration = Date.now() - batchStartTime;
        const processedCount = batchResults.filter(r => r !== null).length;
        console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Batch ${batchIndex + 1}/${batches.length} completed: ${processedCount}/${batch.length} documents in ${batchDuration}ms`);
      }

      const tokenizeDuration = Date.now() - tokenizeStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Tokenized ${lunrDocs.length} documents in ${tokenizeDuration}ms`);

      // Lunrインデックスを初期化
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Building Lunr index for ${tableName}...`);
      const indexStartTime = Date.now();
      await lunrSearchClient.initialize(lunrDocs, tableName);
      const indexDuration = Date.now() - indexStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ ${tableName} index built in ${indexDuration}ms`);
      
      // キャッシュに保存
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Saving ${tableName} to disk cache...`);
      const cacheStartTime = Date.now();
      await lunrSearchClient.saveToDisk(lunrDocs, cachePath, tableName);
      const cacheDuration = Date.now() - cacheStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ ${tableName} saved to cache in ${cacheDuration}ms`);
      
      // 初期化完了を確認
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ${tableName} Lunr client ready: ${lunrSearchClient.isReady(tableName)}`);

      const duration = Date.now() - startTime;
      this.status.isInitialized = true;
      this.status.initializationCount++;
      this.status.documentCount = lunrDocs.length;
      this.status.lastUpdated = new Date();

      const totalDocs = await lunrSearchClient.getDocumentCount(tableName);
      const avgdl = await lunrSearchClient.getAverageTitleLength(tableName);
      
      console.log(`[LUNR_INITIALIZED] ✅ Instance ${INSTANCE_ID}: ${tableName} Lunr index initialized successfully`);
      console.log(`   - Table: ${tableName}`);
      console.log(`   - Total time: ${duration}ms`);
      console.log(`   - DB fetch: ${dbDuration}ms`);
      console.log(`   - Tokenization: ${tokenizeDuration}ms`);
      console.log(`   - Index build: ${indexDuration}ms`);
      console.log(`   - Cache save: ${cacheDuration}ms`);
      console.log(`   - Indexed documents: ${totalDocs}`);
      console.log(`   - Average title length: ${Number(avgdl).toFixed(1)} characters`);
      console.log(`   - Initialization count: ${this.status.initializationCount}`);

    } catch (error) {
      console.error(`[LunrInitializer] Instance ${INSTANCE_ID}: ❌ Initialization failed:`, error);
      this.status.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  isReady(tableName: string = 'confluence'): boolean {
    try {
      // LunrSearchClientの状態を信頼する（単一の情報源）
      // LunrSearchClientが初期化済みであれば、LunrInitializerも初期化済みとみなす
      const { lunrSearchClient } = require('./lunr-search-client');
      const clientReady = lunrSearchClient.isReady(tableName);
      
      // 状態の整合性チェック（デバッグ用）
      if (clientReady && !this.initializedTables.has(tableName)) {
        console.warn(`[LunrInitializer] State mismatch: LunrSearchClient is ready but initializedTables doesn't have ${tableName} - syncing state`);
        this.initializedTables.add(tableName);
      }
      
      return clientReady;
    } catch (error) {
      console.warn(`[LunrInitializer] Failed to check ${tableName} Lunr readiness:`, error);
      return false;
    }
  }

  getStatus(): LunrInitializerStatus {
    return { ...this.status };
  }

  getProgress(): { isInitialized: boolean; isInitializing: boolean; documentCount: number } {
    return {
      isInitialized: this.status.isInitialized,
      isInitializing: this.status.isInitializing,
      documentCount: this.status.documentCount,
    };
  }

  /**
   * 初期化状態をリセット（キャッシュクリア時などに使用）
   * 注意: このメソッドはメモリ状態のみをリセットします
   * キャッシュファイルが存在する場合、次回の初期化時に自動的にロードされます
   */
  reset(): void {
    this.initializedTables.clear();
    this.initializationPromises.clear();
    this.status = {
      isInitialized: false,
      isInitializing: false,
      documentCount: 0,
      lastUpdated: null,
      error: null,
      initializationCount: 0,
    };
    console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Reset initialization state (cache files preserved)`);
  }
}

// Singleton instance
export const lunrInitializer = new LunrInitializer();

// アプリケーション起動時にLunrを初期化
export async function initializeLunrOnStartup(): Promise<void> {
  try {
    await lunrInitializer.initializeAsync();
    console.log('✅ Lunr initialization completed on startup');
  } catch (error) {
    console.error('❌ Lunr initialization failed on startup:', error);
    // エラーが発生してもアプリケーションは継続
  }
}
