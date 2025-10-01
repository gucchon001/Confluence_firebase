/**
 * 並列検索エンジン
 * 複数の検索処理を並列化してパフォーマンスを大幅改善
 */

import { searchLanceDB } from './lancedb-search-client';
import { advancedSearchCache } from './advanced-search-cache';
import { performanceOptimizedInitializer } from './performance-optimized-initializer';

interface ParallelSearchParams {
  query: string;
  topK?: number;
  useLunrIndex?: boolean;
  labelFilters?: any;
  excludeTitlePatterns?: string[];
  enableParallelProcessing?: boolean;
}

interface ParallelSearchResult {
  results: any[];
  performance: {
    totalTime: number;
    vectorSearchTime: number;
    bm25SearchTime: number;
    cacheTime: number;
    parallelProcessingTime: number;
  };
  cache: {
    hit: boolean;
    key: string;
  };
}

export class ParallelSearchEngine {
  private static instance: ParallelSearchEngine;
  private isInitialized = false;

  private constructor() {}

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): ParallelSearchEngine {
    if (!ParallelSearchEngine.instance) {
      ParallelSearchEngine.instance = new ParallelSearchEngine();
    }
    return ParallelSearchEngine.instance;
  }

  /**
   * 並列検索を実行（無効化）
   */
  async search(params: ParallelSearchParams): Promise<ParallelSearchResult> {
    console.log(`[ParallelSearchEngine] DISABLED - Redirecting to traditional search`);
    
    // 従来の検索システムにリダイレクト
    const { searchLanceDB } = await import('./lancedb-search-client');
    
    const {
      query,
      topK = 10,
      useLunrIndex = false,
      labelFilters = { includeMeetingNotes: false },
      excludeTitlePatterns = ['xxx_*']
    } = params;

    const startTime = performance.now();
    
    try {
      const results = await searchLanceDB({
        query,
        topK,
        useLunrIndex,
        labelFilters
      });
      
      const totalTime = performance.now() - startTime;
      
      console.log(`[ParallelSearchEngine] Traditional search completed in ${totalTime.toFixed(2)}ms`);
      
      return {
        results,
        performance: {
          totalTime,
          vectorSearchTime: 0,
          bm25SearchTime: 0,
          cacheTime: 0,
          parallelProcessingTime: 0
        },
        cache: {
          hit: false,
          key: 'traditional'
        }
      };
      
    } catch (error) {
      console.error('[ParallelSearchEngine] Traditional search failed:', error);
      throw error;
    }
  }

  /**
   * 並列検索の実行（並列処理無効化）
   */
  private async performParallelSearch(
    query: string,
    topK: number,
    labelFilters: any,
    excludeTitlePatterns: string[]
  ): Promise<any[]> {
    console.log('[ParallelSearchEngine] Performing sequential search (parallel disabled)...');

    // 並列処理を無効化し、シーケンシャル処理に変更
    const results: any[] = [];
    
    // 戦略1: 標準検索のみ実行
    const standardResult = await this.executeSearchStrategy(query, topK, labelFilters, excludeTitlePatterns, 'standard');
    results.push(...standardResult);

    try {
      // 重複除去とランキング
      const uniqueResults = this.deduplicateAndRankResults(results, topK);

      console.log(`[ParallelSearchEngine] Sequential search found ${uniqueResults.length} unique results`);
      return uniqueResults;

    } catch (error) {
      console.error('[ParallelSearchEngine] Sequential search failed:', error);
      // フォールバック: 基本的な検索
      return this.performSequentialSearch(query, topK, labelFilters, excludeTitlePatterns);
    }
  }

  /**
   * シーケンシャル検索の実行
   */
  private async performSequentialSearch(
    query: string,
    topK: number,
    labelFilters: any,
    excludeTitlePatterns: string[]
  ): Promise<any[]> {
    console.log('[ParallelSearchEngine] Performing sequential search...');

    return this.executeSearchStrategy(query, topK, labelFilters, excludeTitlePatterns, 'standard');
  }

  /**
   * 検索戦略の実行（簡素化）
   */
  private async executeSearchStrategy(
    query: string,
    topK: number,
    labelFilters: any,
    excludeTitlePatterns: string[],
    strategy: 'standard' | 'extended' | 'fast'
  ): Promise<any[]> {
    try {
      // 最もシンプルな検索パラメータ
      const searchParams = {
        query,
        topK,
        useLunrIndex: false, // Lunrを無効化して高速化
        labelFilters,
        excludeTitlePatterns
      };

      const results = await searchLanceDB(searchParams);
      console.log(`[ParallelSearchEngine] Simplified strategy found ${results.length} results`);
      
      return results;
    } catch (error) {
      console.error(`[ParallelSearchEngine] Simplified strategy failed:`, error);
      return [];
    }
  }

  /**
   * 結果の重複除去とランキング
   */
  private deduplicateAndRankResults(results: any[], topK: number): any[] {
    const seen = new Set<string>();
    const uniqueResults: any[] = [];

    // 重複除去
    for (const result of results) {
      const key = `${result.id || result.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueResults.push(result);
      }
    }

    // スコアによるランキング
    uniqueResults.sort((a, b) => {
      const scoreA = a.score || a._distance || 0;
      const scoreB = b.score || b._distance || 0;
      return scoreB - scoreA; // 降順
    });

    // 上位結果を返す
    return uniqueResults.slice(0, topK);
  }

  /**
   * 初期化（簡素化）
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      console.log('[ParallelSearchEngine] Initializing (simplified)...');
      // 初期化を簡素化 - 必要最小限のみ実行
      this.isInitialized = true;
      console.log('✅ ParallelSearchEngine initialized (simplified)');
    } catch (error) {
      console.error('❌ ParallelSearchEngine initialization failed:', error);
      // 初期化失敗でもエラーを投げない
      this.isInitialized = true;
    }
  }

  /**
   * パフォーマンス統計を取得
   */
  public getPerformanceStats(): {
    cacheStats: any;
    initializationStats: any;
  } {
    return {
      cacheStats: advancedSearchCache.getStats(),
      initializationStats: performanceOptimizedInitializer.getPerformanceStats()
    };
  }

  /**
   * ヘルスチェック
   */
  public getHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // 初期化状態チェック
    if (!this.isInitialized) {
      issues.push('Engine not initialized');
      recommendations.push('Call initialize() before performing searches');
    }

    // キャッシュヘルスチェック
    const cacheHealth = advancedSearchCache.getHealth();
    if (!cacheHealth.isHealthy) {
      issues.push(...cacheHealth.issues);
      recommendations.push(...cacheHealth.recommendations);
    }

    // 初期化パフォーマンスチェック
    const initStats = performanceOptimizedInitializer.getPerformanceStats();
    if (initStats.initializationTime > 10000) { // 10秒以上
      issues.push(`Slow initialization: ${initStats.initializationTime.toFixed(2)}ms`);
      recommendations.push('Consider optimizing initialization processes');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }
}

// シングルトンインスタンス
export const parallelSearchEngine = ParallelSearchEngine.getInstance();
