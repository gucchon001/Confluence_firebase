/**
 * キャッシュ統合型検索サービス
 * キャッシュを活用してパフォーマンスを大幅に向上
 */

import 'dotenv/config';
import { searchLanceDB } from './lancedb-search-client';
import { searchCacheManager } from './search-cache-manager';
import { getEmbeddings } from './embeddings';
import { unifiedKeywordExtractionService } from './unified-keyword-extraction-service';

export interface CachedSearchParams {
  query: string;
  limit?: number;
  labelFilters?: any;
  excludeLabels?: string[];
  excludeTitlePatterns?: string[];
  distanceThreshold?: number;
  qualityThreshold?: number;
  cacheTtl?: number; // Cache TTL in milliseconds
}

export class CachedSearchService {
  private static instance: CachedSearchService;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): CachedSearchService {
    if (!CachedSearchService.instance) {
      CachedSearchService.instance = new CachedSearchService();
    }
    return CachedSearchService.instance;
  }

  /**
   * 初期化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    await this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    console.log('[CachedSearchService] Initializing...');
    const startTime = performance.now();

    try {
      // キャッシュマネージャーを初期化
      // 定期的なクリーンアップを開始
      setInterval(() => {
        searchCacheManager.cleanup();
      }, 60000); // 1分ごと

      this.isInitialized = true;
      const endTime = performance.now();
      console.log(`[CachedSearchService] Initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('[CachedSearchService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * キャッシュを活用した検索実行
   */
  async search(params: CachedSearchParams): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      query,
      limit = 10,
      labelFilters = { includeMeetingNotes: false, includeArchived: false },
      excludeLabels = ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'],
      excludeTitlePatterns = ['xxx_*'],
      distanceThreshold = 2,
      qualityThreshold = 0,
      cacheTtl = 5 * 60 * 1000 // 5 minutes
    } = params;

    console.log('[CachedSearchService] Starting cached search with query:', query);
    const startTime = performance.now();

    try {
      // 1. キャッシュから検索結果を取得
      const cacheKey = { query, limit, labelFilters, excludeLabels, excludeTitlePatterns, distanceThreshold, qualityThreshold };
      const cachedResults = searchCacheManager.getSearchResults(query, cacheKey);
      
      if (cachedResults) {
        const endTime = performance.now();
        console.log(`[CachedSearchService] Cache hit! Search completed in ${(endTime - startTime).toFixed(2)}ms`);
        return cachedResults;
      }

      console.log('[CachedSearchService] Cache miss, performing fresh search...');

      // 2. キャッシュから埋め込みベクトルを取得
      let embedding: number[];
      const cachedEmbedding = searchCacheManager.getEmbedding(query);
      
      if (cachedEmbedding) {
        console.log('[CachedSearchService] Using cached embedding');
        embedding = cachedEmbedding;
      } else {
        console.log('[CachedSearchService] Generating new embedding...');
        const embeddingStartTime = performance.now();
        embedding = await getEmbeddings(query);
        const embeddingEndTime = performance.now();
        console.log(`[CachedSearchService] Embedding generated in ${(embeddingEndTime - embeddingStartTime).toFixed(2)}ms`);
        
        // 埋め込みベクトルをキャッシュ（長期間有効）
        searchCacheManager.cacheEmbedding(query, embedding, 30 * 60 * 1000); // 30 minutes
      }

      // 3. キャッシュからキーワード抽出結果を取得
      let keywords: string[];
      const cachedKeywords = searchCacheManager.getKeywords(query);
      
      if (cachedKeywords) {
        console.log('[CachedSearchService] Using cached keywords');
        keywords = cachedKeywords;
      } else {
        console.log('[CachedSearchService] Extracting keywords...');
        const keywordStartTime = performance.now();
        keywords = unifiedKeywordExtractionService.extractKeywordsConfigured(query);
        const keywordEndTime = performance.now();
        console.log(`[CachedSearchService] Keywords extracted in ${(keywordEndTime - keywordStartTime).toFixed(2)}ms`);
        
        // キーワード抽出結果をキャッシュ（長期間有効）
        searchCacheManager.cacheKeywords(query, keywords, 30 * 60 * 1000); // 30 minutes
      }

      // 4. 既存の検索ロジックを実行
      const searchStartTime = performance.now();
      const results = await searchLanceDB({
        query,
        limit,
        labelFilters,
        excludeLabels,
        excludeTitlePatterns,
        distanceThreshold,
        qualityThreshold
      });
      const searchEndTime = performance.now();
      console.log(`[CachedSearchService] Search executed in ${(searchEndTime - searchStartTime).toFixed(2)}ms`);

      // 5. 検索結果をキャッシュ
      searchCacheManager.cacheSearchResults(query, cacheKey, results, cacheTtl);

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      console.log(`[CachedSearchService] Search completed in ${totalTime.toFixed(2)}ms`);
      console.log(`[CachedSearchService] Results: ${results.length} items`);

      return results;

    } catch (error) {
      console.error('[CachedSearchService] Search failed:', error);
      throw error;
    }
  }

  /**
   * バッチ検索（複数クエリを並列実行）
   */
  async batchSearch(queries: string[], limit: number = 10, cacheTtl?: number): Promise<{ query: string; results: any[]; time: number; fromCache: boolean }[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`[CachedSearchService] Starting batch search for ${queries.length} queries`);

    const startTime = performance.now();

    try {
      // 並列で複数のクエリを実行
      const searchPromises = queries.map(async (query) => {
        const queryStartTime = performance.now();
        const results = await this.search({ query, limit, cacheTtl });
        const queryEndTime = performance.now();
        
        // キャッシュヒットかどうかを判定
        const fromCache = queryEndTime - queryStartTime < 100; // 100ms未満ならキャッシュヒットと判定
        
        return {
          query,
          results,
          time: queryEndTime - queryStartTime,
          fromCache
        };
      });

      const results = await Promise.all(searchPromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`[CachedSearchService] Batch search completed in ${totalTime.toFixed(2)}ms`);
      console.log(`[CachedSearchService] Average time per query: ${(totalTime / queries.length).toFixed(2)}ms`);

      // キャッシュヒット率を計算
      const cacheHits = results.filter(r => r.fromCache).length;
      const cacheHitRate = (cacheHits / queries.length) * 100;
      console.log(`[CachedSearchService] Cache hit rate: ${cacheHitRate.toFixed(1)}%`);

      return results;

    } catch (error) {
      console.error('[CachedSearchService] Batch search failed:', error);
      throw error;
    }
  }

  /**
   * キャッシュ統計を取得
   */
  getCacheStats(): any {
    return searchCacheManager.getStats();
  }

  /**
   * キャッシュをクリア
   */
  clearCache(): void {
    searchCacheManager.clear();
    console.log('[CachedSearchService] Cache cleared');
  }

  /**
   * 初期化状況を取得
   */
  getStatus(): { initialized: boolean } {
    return {
      initialized: this.isInitialized
    };
  }
}

// シングルトンインスタンス
export const cachedSearchService = CachedSearchService.getInstance();
