/**
 * ハイブリッド検索エンジン
 * ベクトル検索（LanceDB）+ BM25検索（Lunr）の組み合わせ
 */

import { getEmbeddings } from './embeddings';
import { searchLanceDB } from './lancedb-search-client';
import { lunrSearchClient } from './lunr-search-client';
import { preprocessQuery } from './query-preprocessor';
import { formatSearchResults, combineAndRerankResults, FormattedSearchResult } from './search-result-formatter';
import { lancedbClient } from './lancedb-client';
import { LabelFilterOptions } from './search-weights';
import { getLabelsAsArray } from './label-utils';
import { labelManager } from './label-manager';

export interface HybridSearchParams {
  query: string;
  topK?: number;
  useLunrIndex?: boolean;
  labelFilters?: LabelFilterOptions;
  tableName?: string;
}

export interface HybridSearchResult {
  pageId: number;
  title: string;
  content: string;
  labels: string[];
  url: string;
  source: 'vector' | 'bm25' | 'hybrid' | 'title';
  scoreKind: 'vector' | 'bm25' | 'hybrid' | 'title';
  scoreRaw: number;
  scoreText: string;
  // 追加フィールド（統一フォーマット対応）
  id?: string;
  distance?: number;
  score?: number;
  space_key?: string;
  lastUpdated?: string;
  matchDetails?: {
    titleMatches?: number;
    labelMatches?: number;
    contentMatches?: number;
  };
  rrfScore?: number;
}

export class HybridSearchEngine {
  private vectorWeight = 0.5; // ベクトル検索の重み（距離閾値調整により改善）
  private bm25Weight = 0.5;   // BM25検索の重み（バランス調整）

  /**
   * ハイブリッド検索を実行
   */
  async search(params: HybridSearchParams): Promise<HybridSearchResult[]> {
    const {
      query,
      topK = 10, // 参照元を10件に統一
      useLunrIndex = true,
      labelFilters = { includeMeetingNotes: false },
      tableName = 'confluence'
    } = params;

    console.log(`[HybridSearchEngine] Starting hybrid search for: "${query}"`);

    try {
      // 1. クエリ前処理
      const processedQuery = preprocessQuery(query);
      console.log(`[HybridSearchEngine] Processed query: "${processedQuery.processedQuery}"`);

      // 2. 並列検索実行
      console.log(`[HybridSearchEngine] Starting parallel search: vector=${true}, bm25=${useLunrIndex}`);
      console.log(`[HybridSearchEngine] Lunr client ready: ${lunrSearchClient.isReady()}`);
      
      const [vectorResults, bm25Results] = await Promise.all([
        this.performVectorSearch(processedQuery.processedQuery, topK * 2, tableName),
        useLunrIndex ? this.performBM25Search(processedQuery.processedQuery, topK * 2, labelFilters) : []
      ]);

      console.log(`[HybridSearchEngine] Vector results: ${vectorResults.length}, BM25 results: ${bm25Results.length}`);

      // 3. 結果の統合と再ランキング
      const hybridResults = this.combineAndRerankResults(vectorResults, bm25Results, topK);

      console.log(`[HybridSearchEngine] Final results: ${hybridResults.length}`);
      return hybridResults;

    } catch (error) {
      console.error('[HybridSearchEngine] Search failed:', error);
      return [];
    }
  }

  /**
   * ベクトル検索を実行
   */
  private async performVectorSearch(query: string, limit: number, tableName: string): Promise<HybridSearchResult[]> {
    try {
      const vectorResults = await searchLanceDB({
        query,
        topK: limit,
        tableName
      });

      // URLを再構築するヘルパー関数
      const buildUrl = (pageId: number | undefined, spaceKey: string | undefined, existingUrl: string | undefined): string => {
        const baseUrl = process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
        if (existingUrl && existingUrl !== '#' && existingUrl.startsWith('http')) {
          return existingUrl;
        }
        if (pageId && spaceKey) {
          return `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageId}`;
        }
        return existingUrl || '#';
      };
      
      return vectorResults.map(result => {
        const pageId = result.pageId || result.page_id;
        const spaceKey = result.space_key;
        return {
          pageId: pageId,
          title: result.title,
          content: result.content,
          labels: getLabelsAsArray(result.labels), // Arrow Vector型を配列に変換
          url: buildUrl(pageId, spaceKey, result.url), // URLを再構築
          source: 'vector' as const,
          scoreKind: 'vector' as const,
          scoreRaw: result.distance,
          scoreText: `Vector ${this.calculateSimilarityScore(result.distance).toFixed(1)}%`
        };
      });
    } catch (error) {
      console.error('[HybridSearchEngine] Vector search failed:', error);
      return [];
    }
  }

  /**
   * BM25検索を実行
   */
  private async performBM25Search(query: string, limit: number, labelFilters: any): Promise<HybridSearchResult[]> {
    try {
      // Lunrクライアントをシングルトンで取得
      const { LunrSearchClient } = await import('./lunr-search-client');
      const lunrSearchClient = LunrSearchClient.getInstance();
      
      // Lunrクライアントが初期化されていない場合は初期化を試行
      if (!lunrSearchClient.isReady()) {
        console.log('[HybridSearchEngine] Lunr client not ready, attempting initialization...');
        
        // 直接Lunrクライアントを初期化
        await this.initializeLunrClient(lunrSearchClient);
        
        // 再確認
        if (!lunrSearchClient.isReady()) {
          console.warn('[HybridSearchEngine] Lunr client still not ready after initialization, skipping BM25 search');
          console.log('[HybridSearchEngine] Lunr status:', lunrSearchClient.getStatus());
          return [];
        }
      }

      console.log(`[HybridSearchEngine] Performing BM25 search for: "${query}"`);
      const bm25Results = await lunrSearchClient.searchWithFilters(query, {
        excludeLabels: this.getExcludeLabels(labelFilters)
      }, limit);

      console.log(`[HybridSearchEngine] BM25 search returned ${bm25Results.length} results`);
      
      // URLを再構築するヘルパー関数
      const buildUrl = (pageId: number | undefined, spaceKey: string | undefined, existingUrl: string | undefined): string => {
        const baseUrl = process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
        if (existingUrl && existingUrl !== '#' && existingUrl.startsWith('http')) {
          return existingUrl;
        }
        if (pageId && spaceKey) {
          return `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageId}`;
        }
        return '#';
      };
      
      return bm25Results.map(result => ({
        pageId: result.pageId,
        title: result.title,
        content: result.content,
        labels: getLabelsAsArray(result.labels), // Arrow Vector型を配列に変換
        url: buildUrl(result.pageId, result.space_key, result.url), // URLを再構築
        source: 'bm25' as const,
        scoreKind: 'bm25' as const,
        scoreRaw: result.score,
        scoreText: `BM25 ${result.score.toFixed(2)}`
      }));
    } catch (error) {
      console.error('[HybridSearchEngine] BM25 search failed:', error);
      return [];
    }
  }

  /**
   * 結果を統合して再ランキング
   */
  private combineAndRerankResults(
    vectorResults: HybridSearchResult[],
    bm25Results: HybridSearchResult[],
    topK: number
  ): HybridSearchResult[] {
    // 1. ページIDでグループ化
    const pageGroups = new Map<number, HybridSearchResult[]>();

    // ベクトル検索結果を追加
    vectorResults.forEach(result => {
      if (!pageGroups.has(result.pageId)) {
        pageGroups.set(result.pageId, []);
      }
      pageGroups.get(result.pageId)!.push(result);
    });

    // BM25検索結果を追加
    bm25Results.forEach(result => {
      if (!pageGroups.has(result.pageId)) {
        pageGroups.set(result.pageId, []);
      }
      pageGroups.get(result.pageId)!.push(result);
    });

    // 2. ハイブリッドスコアを計算
    const hybridResults: HybridSearchResult[] = [];
    
    for (const [pageId, results] of pageGroups) {
      const vectorResult = results.find(r => r.source === 'vector');
      const bm25Result = results.find(r => r.source === 'bm25');

      if (vectorResult && bm25Result) {
        // 両方の結果がある場合：ハイブリッドスコアを計算
        const hybridScore = this.calculateHybridScore(vectorResult.scoreRaw, bm25Result.scoreRaw);
        hybridResults.push({
          ...vectorResult,
          source: 'hybrid',
          scoreKind: 'hybrid',
          scoreRaw: hybridScore,
          scoreText: `Hybrid ${hybridScore.toFixed(2)}`
        });
      } else if (vectorResult) {
        // ベクトル検索のみの場合
        hybridResults.push(vectorResult);
      } else if (bm25Result) {
        // BM25検索のみの場合
        hybridResults.push(bm25Result);
      }
    }

    // 3. スコアでソートして上位K件を返す
    return hybridResults
      .sort((a, b) => b.scoreRaw - a.scoreRaw)
      .slice(0, topK);
  }

  /**
   * ハイブリッドスコアを計算（統一ユーティリティを使用）
   */
  private calculateHybridScore(vectorScore: number, bm25Score: number): number {
    // 統一ユーティリティを使用してスコア計算
    const { calculateHybridSearchScore } = require('./score-utils');
    return calculateHybridSearchScore(vectorScore, bm25Score, this.vectorWeight, this.bm25Weight);
  }

  /**
   * Lunrクライアントを初期化（lunrInitializerを使用）
   */
  private async initializeLunrClient(lunrSearchClient: any): Promise<void> {
    try {
      console.log('[HybridSearchEngine] Starting Lunr client initialization via lunrInitializer...');
      
      // lunrInitializerを使用して初期化（統一された初期化処理）
      const { lunrInitializer } = await import('./lunr-initializer');
      await lunrInitializer.initializeAsync();
      
      // Lunrクライアントが初期化済みか確認
      if (lunrSearchClient.isReady()) {
        console.log('[HybridSearchEngine] Lunr client initialized successfully via lunrInitializer');
        return;
      }
      
      // 初期化が完了していない場合は、直接キャッシュから読み込みを試行
      console.log('[HybridSearchEngine] Lunr client not ready after initialization, trying direct cache load...');
      const loaded = await lunrSearchClient.loadFromCache();
      if (loaded) {
        console.log('[HybridSearchEngine] Lunr client loaded from cache successfully');
        return;
      }
      
      console.warn('[HybridSearchEngine] Lunr client initialization failed - cache not found and initialization not ready');
      
    } catch (error) {
      console.error('[HybridSearchEngine] Failed to initialize Lunr client:', error);
      // エラーを再スローせず、BM25検索をスキップするだけにする（ベクトル検索は継続）
      console.warn('[HybridSearchEngine] Continuing without BM25 search due to initialization error');
    }
  }

  /**
   * 除外ラベルを取得
   */
  private getExcludeLabels(labelFilters: any): string[] {
    return labelManager.buildExcludeLabels(labelFilters);
  }

  /**
   * 距離値から類似度スコアを計算
   * @param distance 距離値
   * @returns 類似度スコア（0-100%）
   * @deprecated 新しい calculateSimilarityScore 関数を使用してください
   */
  private calculateSimilarityScore(distance: number): number {
    // 距離値が1.0を超えている場合、ユークリッド距離と仮定
    if (distance > 1.0) {
      // ユークリッド距離の場合: 1 / (1 + distance) で正規化
      return (1 / (1 + distance)) * 100;
    } else {
      // コサイン距離の場合: 1 - distance で正規化
      return Math.max(0, (1 - distance)) * 100;
    }
  }

  /**
   * 重みを調整
   */
  setWeights(vectorWeight: number, bm25Weight: number): void {
    this.vectorWeight = vectorWeight;
    this.bm25Weight = bm25Weight;
    console.log(`[HybridSearchEngine] Weights updated: Vector=${vectorWeight}, BM25=${bm25Weight}`);
  }
}

// シングルトンインスタンス
export const hybridSearchEngine = new HybridSearchEngine();
