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
  
  // Phase 5最適化: Promise保持による競合状態防止
  private initializationPromise: Promise<void> | null = null;

  async initializeAsync(): Promise<void> {
    // Phase 5最適化: 既に初期化済みの場合は即座にreturn
    if (this.status.isInitialized) {
      console.log(`[LUNR_CACHE_HIT] ✅ Instance ${INSTANCE_ID}: Reusing existing Lunr index (count: ${this.status.initializationCount})`);
      return;
    }
    
    // Phase 5最適化: 初期化中の場合は同じPromiseを返す（競合防止）
    if (this.status.isInitializing && this.initializationPromise) {
      console.log(`[LUNR_WAITING] ⏳ Instance ${INSTANCE_ID}: Waiting for ongoing initialization...`);
      return this.initializationPromise;
    }

    // Phase 5最適化: 新しい初期化を開始
    console.log(`[LUNR_CACHE_MISS] 🚀 Instance ${INSTANCE_ID}: Starting new Lunr initialization...`);
    this.status.isInitializing = true;
    this.status.error = null;
    
    // Promiseを保持して、同時リクエストが待機できるようにする
    this.initializationPromise = this._performInitialization();
    
    try {
      await this.initializationPromise;
    } finally {
      this.status.isInitializing = false;
      this.initializationPromise = null;
    }
  }
  
  private async _performInitialization(): Promise<void> {
    try {
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Starting Lunr index initialization...`);
      const startTime = Date.now();
      
      // Phase 6修正: kuromojiを確実に初期化（品質維持のため）
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Pre-initializing kuromoji tokenizer...`);
      const { preInitializeTokenizer } = await import('./japanese-tokenizer');
      await preInitializeTokenizer();
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Kuromoji tokenizer initialized successfully`);

      // まずはキャッシュからロードを試みる（再インデックス回避）
      const lunrSearchClient = LunrSearchClient.getInstance();
      const loaded = await lunrSearchClient.loadFromCache();
      if (loaded) {
        this.status.isInitialized = true;
        this.status.initializationCount++;
        this.status.documentCount = await lunrSearchClient.getDocumentCount();
        this.status.lastUpdated = new Date();
        const duration = Date.now() - startTime;
        console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Loaded Lunr from cache in ${duration}ms (count: ${this.status.initializationCount})`);
        return;
      }

      // LanceDBからドキュメントを取得
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Fetching documents from LanceDB...`);
      const dbStartTime = Date.now();
      const connection = await lancedbClient.getConnection();
      const tbl = connection.table;
      
      // 全ドキュメントを取得
      const docs = await tbl.query().limit(10000).toArray();
      const dbDuration = Date.now() - dbStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Retrieved ${docs.length} documents in ${dbDuration}ms`);

      // ドキュメントをLunr形式に変換（日本語トークン化を含む）
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Tokenizing documents...`);
      const tokenizeStartTime = Date.now();
      const lunrDocs: LunrDocument[] = [];
      
      for (const doc of docs) {
        try {
          // HTMLタグを除去してからトークン化
          const cleanTitle = stripHtmlTags(doc.title || '');
          const cleanContent = stripHtmlTags(doc.content || '');
          
          const tokenizedTitle = await tokenizeJapaneseText(cleanTitle);
          const tokenizedContent = await tokenizeJapaneseText(cleanContent);
          
          // ラベルを配列として処理
          let labels: string[] = [];
          if (doc.labels) {
            labels = getLabelsAsArray(doc.labels);
          }

          // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
          const { getPageIdFromRecord } = await import('./pageid-migration-helper');
          const pageId = getPageIdFromRecord(doc) || doc.pageId || 0;
          
          lunrDocs.push({
            id: doc.id || '',
            title: cleanTitle,
            content: cleanContent,
            labels,
            pageId: pageId,
            tokenizedTitle,
            tokenizedContent,
            originalTitle: doc.title || '',
            originalContent: doc.content || '',
            url: doc.url || '',
            space_key: doc.space_key || '',
            lastUpdated: doc.lastUpdated || '',
          });
        } catch (error) {
          console.warn(`[LunrInitializer] Instance ${INSTANCE_ID}: Failed to process document ${doc.id}:`, error);
          // エラーが発生したドキュメントはスキップして続行
        }
      }

      const tokenizeDuration = Date.now() - tokenizeStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Tokenized ${lunrDocs.length} documents in ${tokenizeDuration}ms`);

      // Lunrインデックスを初期化
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Building Lunr index...`);
      const indexStartTime = Date.now();
      await lunrSearchClient.initialize(lunrDocs);
      const indexDuration = Date.now() - indexStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Index built in ${indexDuration}ms`);
      
      // キャッシュに保存
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Saving to disk cache...`);
      const cacheStartTime = Date.now();
      await lunrSearchClient.saveToDisk(lunrDocs);
      const cacheDuration = Date.now() - cacheStartTime;
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: ✅ Saved to cache in ${cacheDuration}ms`);
      
      // 初期化完了を確認
      console.log(`[LunrInitializer] Instance ${INSTANCE_ID}: Lunr client ready: ${lunrSearchClient.isReady()}`);

      const duration = Date.now() - startTime;
      this.status.isInitialized = true;
      this.status.initializationCount++;
      this.status.documentCount = lunrDocs.length;
      this.status.lastUpdated = new Date();

      const totalDocs = await lunrSearchClient.getDocumentCount();
      const avgdl = await lunrSearchClient.getAverageTitleLength();
      
      console.log(`[LUNR_INITIALIZED] ✅ Instance ${INSTANCE_ID}: Lunr index initialized successfully`);
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

  isReady(): boolean {
    try {
      const { lunrSearchClient } = require('./lunr-search-client');
      return this.status.isInitialized && lunrSearchClient.isReady();
    } catch (error) {
      console.warn('[LunrInitializer] Failed to check Lunr readiness:', error);
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
