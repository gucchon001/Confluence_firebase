/**
 * 品質保持型パフォーマンス最適化サービス
 * 既存の検索ロジックを完全に保持しながらパフォーマンスのみを向上
 */

import { searchLanceDB } from './lancedb-search-client';
import { labelManager } from './label-manager';

export interface QualityPreservingSearchParams {
  query: string;
  limit?: number;
  labelFilters?: any;
  excludeLabels?: string[];
  excludeTitlePatterns?: string[];
  distanceThreshold?: number;
  qualityThreshold?: number;
}

export class QualityPreservingOptimizer {
  private static instance: QualityPreservingOptimizer;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): QualityPreservingOptimizer {
    if (!QualityPreservingOptimizer.instance) {
      QualityPreservingOptimizer.instance = new QualityPreservingOptimizer();
    }
    return QualityPreservingOptimizer.instance;
  }

  /**
   * 初期化（既存のサービスを再利用）
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
    console.log('[QualityPreservingOptimizer] Initializing...');
    const startTime = performance.now();

    try {
      // 既存のサービスを事前に初期化
      // これにより初回検索時の初期化コストを削減
      await this.warmupServices();

      this.isInitialized = true;
      const endTime = performance.now();
      console.log(`[QualityPreservingOptimizer] Initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('[QualityPreservingOptimizer] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * サービスを事前にウォームアップ
   */
  private async warmupServices(): Promise<void> {
    console.log('[QualityPreservingOptimizer] Warming up services...');
    
    // 軽量なクエリで既存の検索サービスをウォームアップ
    try {
      await searchLanceDB({
        query: 'test',
        topK: 1,
        labelFilters: {
          excludeMeetingNotes: true,
          excludeArchived: true
        },
      });
      console.log('[QualityPreservingOptimizer] Services warmed up successfully');
    } catch (error) {
      console.warn('[QualityPreservingOptimizer] Warmup failed, but continuing:', error);
    }
  }

  /**
   * 品質を保持した最適化検索
   * 既存のsearchLanceDBをそのまま使用し、パフォーマンス測定のみ追加
   */
  async search(params: QualityPreservingSearchParams): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      query,
      limit = 10,
      labelFilters = { includeMeetingNotes: false },
      excludeLabels = labelManager.buildExcludeLabels(labelFilters),
      excludeTitlePatterns = ['xxx_*'],
      distanceThreshold = 2,
      qualityThreshold = 0
    } = params;

    console.log('[QualityPreservingOptimizer] Starting quality-preserving search with query:', query);
    const startTime = performance.now();

    try {
      // 既存の検索ロジックをそのまま使用
      const results = await searchLanceDB({
        query,
        topK: limit,
        labelFilters: {
          excludeArchived: true,
          excludeMeetingNotes: true
        },
      });

      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      console.log(`[QualityPreservingOptimizer] Search completed in ${searchTime.toFixed(2)}ms`);
      console.log(`[QualityPreservingOptimizer] Results: ${results.length} items`);

      return results;

    } catch (error) {
      console.error('[QualityPreservingOptimizer] Search failed:', error);
      throw error;
    }
  }

  /**
   * バッチ検索（複数クエリを並列実行）
   */
  async batchSearch(queries: string[], limit: number = 10): Promise<{ query: string; results: any[]; time: number }[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`[QualityPreservingOptimizer] Starting batch search for ${queries.length} queries`);

    const startTime = performance.now();

    try {
      // 並列で複数のクエリを実行
      const searchPromises = queries.map(async (query) => {
        const queryStartTime = performance.now();
        const results = await this.search({ query, limit });
        const queryEndTime = performance.now();
        
        return {
          query,
          results,
          time: queryEndTime - queryStartTime
        };
      });

      const results = await Promise.all(searchPromises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      console.log(`[QualityPreservingOptimizer] Batch search completed in ${totalTime.toFixed(2)}ms`);
      console.log(`[QualityPreservingOptimizer] Average time per query: ${(totalTime / queries.length).toFixed(2)}ms`);

      return results;

    } catch (error) {
      console.error('[QualityPreservingOptimizer] Batch search failed:', error);
      throw error;
    }
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
export const qualityPreservingOptimizer = QualityPreservingOptimizer.getInstance();
