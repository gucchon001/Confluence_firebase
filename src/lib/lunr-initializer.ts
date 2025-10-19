/**
 * Lunr.js index initialization manager
 * Handles asynchronous initialization of Lunr search index
 */

import { LunrSearchClient, LunrDocument } from './lunr-search-client';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { lancedbClient } from './lancedb-client';
import { getLabelsAsArray } from './label-utils';

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
      
      // Phase 6修正: kuromojiを確実に初期化（品質維持のため）
      console.log('[LunrInitializer] Pre-initializing kuromoji tokenizer...');
      const { preInitializeTokenizer } = await import('./japanese-tokenizer');
      await preInitializeTokenizer();
      console.log('[LunrInitializer] ✅ Kuromoji tokenizer initialized successfully');

      // まずはキャッシュからロードを試みる（再インデックス回避）
      const lunrSearchClient = LunrSearchClient.getInstance();
      const loaded = await lunrSearchClient.loadFromCache();
      if (loaded) {
        this.status.isInitialized = true;
        this.status.documentCount = await lunrSearchClient.getDocumentCount();
        this.status.lastUpdated = new Date();
        console.log('[LunrInitializer] Loaded Lunr from cache. Skipping reindex.');
        return;
      }

      // LanceDBからドキュメントを取得
      const connection = await lancedbClient.getConnection();
      const tbl = connection.table;
      
      // 全ドキュメントを取得
      const docs = await tbl.query().limit(10000).toArray();
      console.log(`[LunrInitializer] Retrieved ${docs.length} documents from LanceDB`);

      // ドキュメントをLunr形式に変換（日本語トークン化を含む）
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

          lunrDocs.push({
            id: doc.id || '',
            title: cleanTitle,
            content: cleanContent,
            labels,
            pageId: doc.pageId || 0,
            tokenizedTitle,
            tokenizedContent,
            originalTitle: doc.title || '',
            originalContent: doc.content || '',
            url: doc.url || '',
            space_key: doc.space_key || '',
            lastUpdated: doc.lastUpdated || '',
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
