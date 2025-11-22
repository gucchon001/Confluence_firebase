/**
 * ハイブリッド検索エンジン
 * ベクトル検索（LanceDB）+ BM25検索（Lunr）の組み合わせ
 */

import * as path from 'path';
import { getEmbeddings } from './embeddings';
import { searchLanceDB } from './lancedb-search-client';
import { lunrSearchClient } from './lunr-search-client';
import { preprocessQuery } from './query-preprocessor';
import { formatSearchResults, combineAndRerankResults, FormattedSearchResult } from './search-result-formatter';
import { lancedbClient } from './lancedb-client';
import { LabelFilterOptions } from './search-weights';
import { getLabelsAsArray } from './label-utils';
import { labelManager } from './label-manager';
import { buildConfluenceUrl } from './url-utils';

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
  // Jira特有のフィールド（オプショナル）
  issue_key?: string;
  status?: string;
  status_category?: string;
  priority?: string;
  assignee?: string;
  issue_type?: string;
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
      console.log(`[HybridSearchEngine] ${tableName} Lunr client ready: ${lunrSearchClient.isReady(tableName)}`);
      
      const [vectorResults, bm25Results] = await Promise.all([
        this.performVectorSearch(processedQuery.processedQuery, topK * 2, tableName, labelFilters),
        useLunrIndex ? this.performBM25Search(processedQuery.processedQuery, topK * 2, labelFilters, tableName) : []
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
  private async performVectorSearch(query: string, limit: number, tableName: string, labelFilters?: LabelFilterOptions): Promise<HybridSearchResult[]> {
    try {
      const vectorResults = await searchLanceDB({
        query,
        topK: limit,
        tableName,
        labelFilters: labelFilters || { includeMeetingNotes: false }
      });

      // URLを再構築（共通ユーティリティを使用）
      const { buildConfluenceUrl } = await import('./url-utils');
      const { buildJiraUrl } = await import('./jira-url-utils');
      
      return vectorResults.map(result => {
        const pageId = result.pageId || result.page_id;
        const issueKey = result.issue_key || result.id; // Jiraの場合はissue_keyを使用
        
        // JiraとConfluenceでURL構築を分離
        let url: string;
        if (tableName === 'jira_issues') {
          url = buildJiraUrl(issueKey, result.url);
        } else {
          // page_idだけでURL構築可能（space_keyはオプション）
          url = buildConfluenceUrl(pageId, result.space_key, result.url);
        }
        
        // Jira特有のフィールドを取得（LanceDBから直接取得）
        const jiraFields = tableName === 'jira_issues' ? {
          issue_key: result.issue_key || issueKey,
          status: result.status,
          status_category: result.status_category,
          priority: result.priority,
          assignee: result.assignee,
          issue_type: result.issue_type
        } : {};
        
        return {
          pageId: pageId || (issueKey ? 0 : undefined), // Jiraの場合はpageIdが存在しない可能性がある
          id: issueKey || result.id, // Jiraの場合はissue_keyをidとして使用
          title: result.title,
          content: result.content,
          labels: getLabelsAsArray(result.labels), // Arrow Vector型を配列に変換
          url: url, // URLを再構築
          space_key: result.space_key, // space_keyを保持
          source: 'vector' as const,
          scoreKind: 'vector' as const,
          scoreRaw: result.distance ?? 0,
          scoreText: `Vector ${this.calculateSimilarityScore(result.distance ?? 0).toFixed(1)}%`,
          // Jira特有のフィールド
          ...jiraFields
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
  private async performBM25Search(query: string, limit: number, labelFilters: any, tableName: string = 'confluence'): Promise<HybridSearchResult[]> {
    try {
      // Lunrクライアントをシングルトンで取得
      const { LunrSearchClient } = await import('./lunr-search-client');
      const lunrSearchClient = LunrSearchClient.getInstance();
      
      // ⚡ 最適化: Lunrインデックスの遅延初期化（オンデマンド）
      // 必要になった時だけ初期化を試行（バックグラウンドで開始、完了を待たない）
      if (!lunrSearchClient.isReady(tableName)) {
        console.log(`[HybridSearchEngine] ${tableName} Lunr client not ready, initializing in background...`);
        
        // バックグラウンドで初期化を開始（結果を待たずに返す）
        const { lunrInitializer } = await import('./lunr-initializer');
        
        // ⚡ 最適化: タイムアウトを設定して、初期化が完了するまで待たない
        Promise.race([
          lunrInitializer.initializeAsync(tableName),
          new Promise<void>((resolve) => {
            setTimeout(() => {
              console.log(`[HybridSearchEngine] Lunr initialization timeout for ${tableName}, continuing without waiting`);
              resolve();
            }, 100); // 100msでタイムアウト（初期化開始のみ確認）
          })
        ]).catch((error) => {
          console.warn(`[HybridSearchEngine] Lunr initialization failed for ${tableName}:`, error);
        });
        
        // 初回はBM25検索をスキップ（ベクトル検索のみ）
        console.log(`[HybridSearchEngine] Skipping BM25 search for now (initialization in progress), will be available on next request`);
        return [];
      }

      console.log(`[HybridSearchEngine] Performing BM25 search for ${tableName}: "${query}"`);
      const bm25Results = await lunrSearchClient.searchWithFilters(query, {
        excludeLabels: this.getExcludeLabels(labelFilters)
      }, limit, tableName);

      console.log(`[HybridSearchEngine] BM25 search returned ${bm25Results.length} results`);
      
      // URLを再構築（共通ユーティリティを使用）
      const { buildConfluenceUrl } = await import('./url-utils');
      const { buildJiraUrl } = await import('./jira-url-utils');
      
      return bm25Results.map(result => {
        // JiraとConfluenceでURL構築を分離
        const issueKey = (result as any).issue_key || result.id;
        let url: string;
        if (tableName === 'jira_issues') {
          url = buildJiraUrl(issueKey, result.url);
        } else {
          // page_idだけでURL構築可能（space_keyはオプション）
          url = buildConfluenceUrl(result.pageId, result.space_key, result.url);
        }
        
        const hybridResult: any = {
          pageId: result.pageId,
          id: result.id, // Jiraの場合はissue_keyが入る
          title: result.title,
          content: result.content,
          labels: getLabelsAsArray(result.labels), // Arrow Vector型を配列に変換
          url: url, // URLを再構築
          space_key: result.space_key, // space_keyを保持
          source: 'bm25' as const,
          scoreKind: 'bm25' as const,
          scoreRaw: result.score,
          scoreText: `BM25 ${result.score.toFixed(2)}`
        };
        
        // Jira特有のフィールドを追加
        if (result.issue_key) {
          hybridResult.issue_key = result.issue_key;
          hybridResult.status = result.status;
          hybridResult.status_category = result.status_category;
          hybridResult.priority = result.priority;
          hybridResult.assignee = result.assignee;
          hybridResult.issue_type = result.issue_type;
        }
        
        return hybridResult;
      });
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
        // BM25結果のJira特有フィールドを優先（より正確な情報）
        const hybridScore = this.calculateHybridScore(vectorResult.scoreRaw, bm25Result.scoreRaw);
        
        // pageIdを確実に保持（BM25結果にもpageIdがある場合、それも考慮）
        const finalPageId = vectorResult.pageId || bm25Result.pageId || pageId;
        
        // space_keyを適切に選択（存在する方を優先、両方ある場合はBM25を優先）
        const bestSpaceKey = bm25Result.space_key || vectorResult.space_key;
        
        // URLを適切に選択（より正確なURLを持つ結果を優先）
        // 有効なURL（#でない、httpで始まる）を優先
        const vectorUrl = vectorResult.url && vectorResult.url !== '#' && vectorResult.url.startsWith('http') 
          ? vectorResult.url 
          : undefined;
        const bm25Url = bm25Result.url && bm25Result.url !== '#' && bm25Result.url.startsWith('http') 
          ? bm25Result.url 
          : undefined;
        let bestUrl = bm25Url || vectorUrl || vectorResult.url || bm25Result.url;
        
        // URLが#の場合、pageIdとspace_keyから再構築を試行
        if ((!bestUrl || bestUrl === '#') && finalPageId && finalPageId > 0) {
          bestUrl = buildConfluenceUrl(finalPageId, bestSpaceKey, undefined);
        }
        
        hybridResults.push({
          ...vectorResult,
          // URLとspace_keyを適切に保持
          url: bestUrl,
          space_key: bestSpaceKey,
          // pageIdを確実に保持
          pageId: finalPageId,
          // Jira特有フィールドはBM25結果から取得（より正確）
          issue_key: bm25Result.issue_key || vectorResult.issue_key,
          status: bm25Result.status || vectorResult.status,
          status_category: bm25Result.status_category || vectorResult.status_category,
          priority: bm25Result.priority || vectorResult.priority,
          assignee: bm25Result.assignee || vectorResult.assignee,
          issue_type: bm25Result.issue_type || vectorResult.issue_type,
          source: 'hybrid',
          scoreKind: 'hybrid',
          scoreRaw: hybridScore,
          scoreText: `Hybrid ${hybridScore.toFixed(2)}`
        });
      } else if (vectorResult) {
        // ベクトル検索のみの場合
        // URLが#の場合、pageIdとspace_keyから再構築を試行
        let vectorUrl = vectorResult.url;
        if ((!vectorUrl || vectorUrl === '#') && vectorResult.pageId && vectorResult.pageId > 0) {
          vectorUrl = buildConfluenceUrl(vectorResult.pageId, vectorResult.space_key, undefined);
        }
        hybridResults.push({
          ...vectorResult,
          url: vectorUrl
        });
      } else if (bm25Result) {
        // BM25検索のみの場合
        // URLが#の場合、pageIdとspace_keyから再構築を試行
        let bm25Url = bm25Result.url;
        if ((!bm25Url || bm25Url === '#') && bm25Result.pageId && bm25Result.pageId > 0) {
          bm25Url = buildConfluenceUrl(bm25Result.pageId, bm25Result.space_key, undefined);
        }
        hybridResults.push({
          ...bm25Result,
          url: bm25Url
        });
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
   * 二重初期化を避けるため、lunrInitializerのみを使用
   */
  private async initializeLunrClient(lunrSearchClient: any, tableName: string = 'confluence'): Promise<void> {
    try {
      console.log(`[HybridSearchEngine] Starting ${tableName} Lunr client initialization via lunrInitializer...`);
      
      // lunrInitializerを使用して初期化（統一された初期化処理）
      // lunrInitializer内部でキャッシュの確認とロードが行われるため、ここでは追加の処理は不要
      const { lunrInitializer } = await import('./lunr-initializer');
      await lunrInitializer.initializeAsync(tableName);
      
      // Lunrクライアントが初期化済みか確認
      if (lunrSearchClient.isReady(tableName)) {
        console.log(`[HybridSearchEngine] ${tableName} Lunr client initialized successfully via lunrInitializer`);
        return;
      }
      
      // 初期化が完了していない場合は警告のみ（lunrInitializerが適切に処理する）
      console.warn(`[HybridSearchEngine] ${tableName} Lunr client not ready after initialization - BM25 search will be skipped`);
      
    } catch (error) {
      console.error(`[HybridSearchEngine] Failed to initialize ${tableName} Lunr client:`, error);
      // エラーを再スローせず、BM25検索をスキップするだけにする（ベクトル検索は継続）
      console.warn(`[HybridSearchEngine] Continuing without BM25 search for ${tableName} due to initialization error`);
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
