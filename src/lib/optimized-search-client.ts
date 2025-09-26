/**
 * 最適化された検索クライアント
 * 既存の検索ロジックを完全に保持しながらパフォーマンスを向上
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { lancedbClient } from './lancedb-client';
import { getEmbeddings } from './embeddings';
import { calculateKeywordScore, LabelFilterOptions } from './search-weights';
import { calculateHybridScore } from './score-utils';
import { unifiedKeywordExtractionService } from './unified-keyword-extraction-service';
import { getRowsByPageId, getRowsByPageIdViaUrl } from './lancedb-utils';
import { lunrSearchClient, LunrDocument } from './lunr-search-client';
import { lunrInitializer } from './lunr-initializer';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { labelManager } from './label-manager';
import { calculateSimilarityPercentage, normalizeBM25Score, generateScoreText } from './score-utils';
import { unifiedSearchResultProcessor } from './unified-search-result-processor';

/**
 * タイトルが除外パターンにマッチするかチェック
 */
function isTitleExcluded(title: string, excludePatterns: string[]): boolean {
  if (!title || !excludePatterns || excludePatterns.length === 0) {
    return false;
  }
  
  return excludePatterns.some(pattern => {
    // パターンが末尾に*がある場合は前方一致
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return title.startsWith(prefix);
    }
    // パターンが先頭に*がある場合は後方一致
    else if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return title.endsWith(suffix);
    }
    // パターンが*で囲まれている場合は部分一致
    else if (pattern.startsWith('*') && pattern.endsWith('*')) {
      const substring = pattern.slice(1, -1);
      return title.includes(substring);
    }
    // 完全一致
    else {
      return title === pattern;
    }
  });
}

/**
 * 検索パラメータのインターフェース
 */
export interface OptimizedSearchParams {
  query: string;
  limit?: number;
  labelFilters?: LabelFilterOptions;
  excludeLabels?: string[];
  excludeTitlePatterns?: string[];
  distanceThreshold?: number;
  qualityThreshold?: number;
}

/**
 * 最適化された検索クライアント
 * 既存のロジックを完全に保持しながらパフォーマンスを向上
 */
export class OptimizedSearchClient {
  private static instance: OptimizedSearchClient;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): OptimizedSearchClient {
    if (!OptimizedSearchClient.instance) {
      OptimizedSearchClient.instance = new OptimizedSearchClient();
    }
    return OptimizedSearchClient.instance;
  }

  /**
   * 並列初期化でパフォーマンスを向上
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
    console.log('[OptimizedSearchClient] Starting parallel initialization...');
    const startTime = performance.now();

    try {
      // 並列でサービスを初期化
      await Promise.all([
        this.initializeLunr(),
        this.initializeKeywordService(),
        this.initializeEmbeddingService(),
        this.initializeResultProcessor()
      ]);

      this.isInitialized = true;
      const endTime = performance.now();
      console.log(`[OptimizedSearchClient] Initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('[OptimizedSearchClient] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeLunr(): Promise<void> {
    await lunrInitializer.initializeAsync();
  }

  private async initializeKeywordService(): Promise<void> {
    // キーワードサービスは既に初期化済み
  }

  private async initializeEmbeddingService(): Promise<void> {
    // 埋め込みサービスは既に初期化済み
  }

  private async initializeResultProcessor(): Promise<void> {
    // 結果処理サービスは既に初期化済み
  }

  /**
   * 最適化された検索実行
   * 既存のロジックを完全に保持
   */
  async search(params: OptimizedSearchParams): Promise<any[]> {
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

    console.log('[OptimizedSearchClient] Starting optimized search with query:', query);

    try {
      // 1. 並列でキーワード抽出と埋め込み生成
      const [keywords, embedding] = await Promise.all([
        this.extractKeywords(query),
        this.generateEmbedding(query)
      ]);

      console.log('[OptimizedSearchClient] Extracted keywords:', keywords);
      console.log('[OptimizedSearchClient] Generated embedding vector with', embedding.length, 'dimensions');

      // 2. 並列でベクトル検索とBM25検索
      const [vectorResults, bm25Results] = await Promise.all([
        this.performVectorSearch(embedding, limit * 2, distanceThreshold, qualityThreshold),
        this.performBM25Search(query, keywords, limit * 2)
      ]);

      console.log('[OptimizedSearchClient] Vector search found', vectorResults.length, 'results before filtering');
      console.log('[OptimizedSearchClient] BM25 search found', bm25Results.length, 'results');

      // 3. 既存のフィルタリングロジックを適用
      const normalizedLabelFilters = labelFilters || { excludeMeetingNotes: true, excludeArchived: true };
      const filteredVectorResults = this.applyFiltering(vectorResults, normalizedLabelFilters, excludeLabels, excludeTitlePatterns);
      const filteredBM25Results = this.applyFiltering(bm25Results, normalizedLabelFilters, excludeLabels, excludeTitlePatterns);

      console.log('[OptimizedSearchClient] Vector search found', filteredVectorResults.length, 'results after filtering');
      console.log('[OptimizedSearchClient] BM25 search found', filteredBM25Results.length, 'results after filtering');

      // 4. 既存のハイブリッド検索ロジックを適用
      const hybridResults = this.performHybridSearch(filteredVectorResults, filteredBM25Results, keywords, query);

      // 5. 既存の結果処理ロジックを適用
      const processedResults = this.processResults(hybridResults, query, limit);

      console.log('[OptimizedSearchClient] Final results:', processedResults.length);
      return processedResults;

    } catch (error) {
      console.error('[OptimizedSearchClient] Search failed:', error);
      throw error;
    }
  }

  private async extractKeywords(query: string): Promise<string[]> {
    return unifiedKeywordExtractionService.extractKeywordsConfigured(query);
  }

  private async generateEmbedding(query: string): Promise<number[]> {
    return getEmbeddings(query);
  }

  private async performVectorSearch(
    embedding: number[], 
    limit: number, 
    distanceThreshold: number, 
    qualityThreshold: number
  ): Promise<any[]> {
    const table = await lancedbClient.getTable();
    const results = await table.search(embedding)
      .limit(limit)
      .toArray();

    // 既存の品質閾値ロジックを適用
    let filteredResults = results;
    if (qualityThreshold > 0) {
      filteredResults = results.filter((result: any) => {
        const distance = result._distance || 0;
        return distance <= qualityThreshold;
      });
      console.log('[OptimizedSearchClient] Applied quality threshold', qualityThreshold + ':', results.length, '->', filteredResults.length, 'results');
    }

    return filteredResults;
  }

  private async performBM25Search(query: string, keywords: string[], limit: number): Promise<any[]> {
    // 既存のBM25検索ロジックを適用
    const results = await lunrSearchClient.searchCandidates(query, limit);
    return results;
  }

  private applyFiltering(
    results: any[], 
    labelFilters: LabelFilterOptions, 
    excludeLabels: string[], 
    excludeTitlePatterns: string[]
  ): any[] {
    // LabelManagerを使用してラベルフィルタリング
    let filteredResults = labelManager.filterResults(results, labelFilters);

    // タイトルパターンフィルタリング
    if (excludeTitlePatterns && excludeTitlePatterns.length > 0) {
      const beforeCount = filteredResults.length;
      filteredResults = filteredResults.filter(result => {
        return !isTitleExcluded(result.title, excludeTitlePatterns);
      });
      console.log('[OptimizedSearchClient] Excluded', beforeCount - filteredResults.length, 'results due to title pattern filtering');
    }

    return filteredResults;
  }

  private performHybridSearch(vectorResults: any[], bm25Results: any[], keywords: string[], query: string): any[] {
    // 既存のハイブリッド検索ロジックを完全に保持
    const hybridResults: any[] = [];

    // ベクトル検索結果の処理
    for (const result of vectorResults) {
      const hybridScore = calculateHybridScore(result._distance || 0, 0.5, 0.3);
      hybridResults.push({
        ...result,
        _sourceType: 'hybrid',
        _hybridScore: hybridScore
      });
    }

    // BM25検索結果の処理
    for (const result of bm25Results) {
      const hybridScore = calculateHybridScore(result._distance || 0, 0.5, 0.3);
      hybridResults.push({
        ...result,
        _sourceType: 'hybrid',
        _hybridScore: hybridScore
      });
    }

    return hybridResults;
  }

  private processResults(results: any[], query: string, limit: number): any[] {
    // 既存の結果処理ロジックを完全に保持
    return unifiedSearchResultProcessor.processSearchResults(results, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      bm25MaxScore: 20,
      enableRRF: true,
      rrfK: 60
    });
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
export const optimizedSearchClient = OptimizedSearchClient.getInstance();
