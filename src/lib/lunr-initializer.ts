/**
 * Lunr.js index initialization manager
 * Handles asynchronous initialization of Lunr search index
 */

import { LunrSearchClient, LunrDocument } from './lunr-search-client';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { getLabelsAsArray } from './label-utils';

interface LunrInitializerStatus {
  isInitialized: boolean;
  isInitializing: boolean;
  documentCount: number;
  lastUpdated: Date | null;
  error: string | null;
}

export class LunrInitializer {
  private status: LunrInitializerStatus = {
    isInitialized: false,
    isInitializing: false,
    documentCount: 0,
    lastUpdated: null,
    error: null,
  };

  async initializeAsync(): Promise<void> {
    if (this.status.isInitialized || this.status.isInitializing) {
      return;
    }

    this.status.isInitializing = true;
    this.status.error = null;

    try {
      console.log('[LunrInitializer] Starting Lunr index initialization...');
      const startTime = Date.now();

      // まずはキャッシュからロードを試みる（再インデックス回避）
      const lunrSearchClient = LunrSearchClient.getInstance();
      const loaded = await lunrSearchClient.loadFromDisk();
      if (loaded) {
        this.status.isInitialized = true;
        this.status.documentCount = await lunrSearchClient.getDocumentCount();
        this.status.lastUpdated = new Date();
        console.log('[LunrInitializer] Loaded Lunr from cache. Skipping reindex.');
        return;
      }

      // LanceDBからドキュメントを取得
      const lancedb = await import('@lancedb/lancedb');
      const db = await lancedb.connect('.lancedb');
      const tbl = await db.openTable('confluence');
      
      // 全ドキュメントを取得
      const docs = await tbl.query().limit(10000).toArray();
      console.log(`[LunrInitializer] Retrieved ${docs.length} documents from LanceDB`);

      // ドキュメントをLunr形式に変換（日本語トークン化を含む）
      const lunrDocs: LunrDocument[] = [];
      
      for (const doc of docs) {
        try {
          // 日本語テキストをトークン化
          const tokenizedTitle = await tokenizeJapaneseText(doc.title || '');
          const tokenizedContent = await tokenizeJapaneseText(doc.content || '');
          
          // ラベルを配列として処理
          let labels: string[] = [];
          if (doc.labels) {
            labels = getLabelsAsArray(doc.labels);
          }

          lunrDocs.push({
            id: doc.id || '',
            title: doc.title || '',
            content: doc.content || '',
            labels,
            pageId: doc.pageId || 0,
            tokenizedTitle,
            tokenizedContent,
            originalTitle: doc.title || '',
            originalContent: doc.content || '',
          });
        } catch (error) {
          console.warn(`[LunrInitializer] Failed to process document ${doc.id}:`, error);
          // エラーが発生したドキュメントはスキップして続行
        }
      }

      console.log(`[LunrInitializer] Processed ${lunrDocs.length} documents for Lunr indexing`);

      // Lunrインデックスを初期化
      await lunrSearchClient.initialize(lunrDocs);
      // キャッシュに保存
      await lunrSearchClient.saveToDisk(lunrDocs);
      
      // 初期化完了を確認
      console.log(`[LunrInitializer] Lunr client ready: ${lunrSearchClient.isReady()}`);
      console.log(`[LunrInitializer] Lunr status:`, lunrSearchClient.getStatus());

      const duration = Date.now() - startTime;
      this.status.isInitialized = true;
      this.status.documentCount = lunrDocs.length;
      this.status.lastUpdated = new Date();

      console.log(`[LunrInitializer] Lunr index initialized successfully in ${duration}ms`);
      console.log(`[LunrInitializer] Indexed ${lunrDocs.length} documents`);
      
      const totalDocs = await lunrSearchClient.getDocumentCount();
      const avgdl = await lunrSearchClient.getAverageTitleLength();
      console.log(`[LunrInitializer] Total documents in index: ${totalDocs}`);
      console.log(`[LunrInitializer] Average title length: ${Number(avgdl).toFixed(1)} characters`);

    } catch (error) {
      console.error('[LunrInitializer] Initialization failed:', error);
      this.status.error = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      this.status.isInitializing = false;
    }
  }

  isReady(): boolean {
    return this.status.isInitialized && lunrSearchClient.isReady();
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
