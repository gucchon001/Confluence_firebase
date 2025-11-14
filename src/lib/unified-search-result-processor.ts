/**
 * 統一検索結果処理サービス
 * 検索結果のスコア計算、フォーマット、ランキングを統一的に処理
 */

import { calculateSimilarityPercentage, normalizeBM25Score, generateScoreText, calculateHybridScore } from './score-utils';
import { labelManager } from './label-manager';
import { GENERIC_DOCUMENT_TERMS, CommonTermsHelper } from './common-terms-config';
import { getLabelsAsArray } from './label-utils';
import { buildConfluenceUrl } from './url-utils';

/**
 * 検索結果の生データ
 */
export interface RawSearchResult {
  id: string;
  pageId?: number;
  page_id?: number; // ★★★ MIGRATION: page_idフィールドを追加 ★★★
  title: string;
  content: string;
  isChunked?: boolean;  // Phase 0A-3: チャンク統合判定フラグ
  _distance?: number;
  _bm25Score?: number;
  _keywordScore?: number;
  _labelScore?: number;
  _hybridScore?: number;
  _rrfScore?: number;
  _sourceType?: string;
  _matchDetails?: {
    titleMatches?: number;
    labelMatches?: number;
    contentMatches?: number;
  };
  space_key?: string;
  labels?: string | string[];
  url?: string;
  lastUpdated?: string;
  // Jira特有のフィールド（オプショナル）
  issue_key?: string;
  status?: string;
  status_category?: string;
  priority?: string;
  assignee?: string;
  issue_type?: string;
  updated_at?: string;
}

/**
 * 処理済み検索結果
 */
export interface ProcessedSearchResult {
  id: string;
  pageId?: number;
  page_id?: number; // ★★★ MIGRATION: page_idフィールドを追加 ★★★
  title: string;  // Required to match LanceDBSearchResult
  content: string;
  isChunked?: boolean;  // Phase 0A-3: チャンク統合判定フラグ
  distance: number;
  score: number;
  space_key?: string;
  labels?: string[];
  url?: string;
  lastUpdated?: string;
  source?: 'vector' | 'keyword' | 'hybrid' | 'bm25';
  matchDetails?: {
    titleMatches?: number;
    labelMatches?: number;
    contentMatches?: number;
  };
  rrfScore?: number;
  scoreKind?: 'vector' | 'bm25' | 'keyword' | 'hybrid';
  scoreRaw?: number;
  scoreText?: string;
  // Phase 0A-4: Composite Scoringフィールドを保持
  _compositeScore?: number;
  _scoreBreakdown?: {
    vectorContribution?: number;
    bm25Contribution?: number;
    titleContribution?: number;
    labelContribution?: number;
  };
  // StructuredLabelフィールド
  structured_category?: string;
  structured_domain?: string;
  structured_feature?: string;
  structured_status?: string;
  structured_priority?: string;
  structured_confidence?: number;
  structured_tags?: string[];
  structured_version?: string;
  structured_content_length?: number;
  structured_is_valid?: boolean;
  // 検索メタデータフィールド（デバッグ用）
  keyword?: number;
  titleScore?: number;  // Renamed from 'title' to avoid conflict
  labelScore?: number;  // Renamed from 'label' to avoid conflict
  _titleMatchRatio?: number;
  _titleMatchedKeywords?: number; // ★★★ 追加: タイトルマッチキーワード数 ★★★
  _bm25Score?: number; // ★★★ 追加: BM25スコア ★★★
  _distance?: number;
  _hybridScore?: number;
  _sourceType?: string;
  // Jira特有のフィールド（オプショナル）
  issue_key?: string;
  status?: string;
  status_category?: string;
  priority?: string;
  assignee?: string;
  issue_type?: string;
  updated_at?: string;
}

/**
 * スコア計算オプション
 */
export interface ScoreCalculationOptions {
  vectorWeight?: number;
  keywordWeight?: number;
  labelWeight?: number;
  bm25MaxScore?: number;
  enableRRF?: boolean;
  rrfK?: number;
}

/**
 * 統一検索結果処理サービス
 */
export class UnifiedSearchResultProcessor {
  private static instance: UnifiedSearchResultProcessor;
  
  private constructor() {}
  
  public static getInstance(): UnifiedSearchResultProcessor {
    if (!UnifiedSearchResultProcessor.instance) {
      UnifiedSearchResultProcessor.instance = new UnifiedSearchResultProcessor();
    }
    return UnifiedSearchResultProcessor.instance;
  }
  
  /**
   * URLを再構築するヘルパーメソッド
   * page_idとspace_keyから正しいURLを生成
   * @deprecated buildConfluenceUrlを使用してください
   */
  private buildUrl(pageId: number | undefined, spaceKey: string | undefined, existingUrl: string | undefined): string {
    return buildConfluenceUrl(pageId, spaceKey, existingUrl);
  }

  /**
   * 検索結果を処理・フォーマット
   */
  public processSearchResults(
    rawResults: RawSearchResult[],
    options: ScoreCalculationOptions = {}
  ): ProcessedSearchResult[] {
    const opts = {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      bm25MaxScore: 20,
      enableRRF: true,
      rrfK: 60,
      ...options
    };

    console.log(`[UnifiedSearchResultProcessor] Processing ${rawResults.length} results`);

    // 1. 基本スコア計算
    const resultsWithScores = this.calculateBasicScores(rawResults, opts);
    
    // 2. RRF融合（オプション）
    const finalResults = opts.enableRRF 
      ? this.applyRRFFusion(resultsWithScores, opts)
      : resultsWithScores;

    // 3. 結果フォーマット
    return this.formatResults(finalResults);
  }

  /**
   * 基本スコア計算
   */
  private calculateBasicScores(
    results: RawSearchResult[],
    options: Required<ScoreCalculationOptions>
  ): RawSearchResult[] {
    return results.map(result => {
      const sourceType = (result._sourceType || 'vector') as 'vector' | 'keyword' | 'hybrid' | 'bm25';
      
      // ハイブリッドスコア計算
      const hybridScore = calculateHybridScore(
        result._distance ?? 1,
        result._keywordScore ?? 0,
        result._labelScore ?? 0,
        options.vectorWeight,
        options.keywordWeight,
        options.labelWeight
      );

      return {
        ...result,
        _hybridScore: hybridScore
      };
    }).filter(result => {
      // 関連性の低い文書を除外するフィルタリング
      return this.isRelevantResult(result, options);
    });
  }

  /**
   * 関連性チェック（フィルタリングを無効化 - RRFに任せる）
   */
  private isRelevantResult(result: RawSearchResult, options: Required<ScoreCalculationOptions>): boolean {
    // フィルタリングは無効化
    // RRFで既に適切にランキングされているため、ここでの除外は不要
    // 過剰なフィルタリングにより重要な文書が除外される問題を解決
    return true;
  }

  /**
   * RRF融合適用
   */
  private applyRRFFusion(
    results: RawSearchResult[],
    options: Required<ScoreCalculationOptions>
  ): RawSearchResult[] {
    const kRrf = options.rrfK;
    
    // 各ソース別の順位計算
    const byVector = [...results].sort((a, b) => (a._distance ?? 1) - (b._distance ?? 1));
    const byKeyword = [...results].sort((a, b) => (b._keywordScore ?? 0) - (a._keywordScore ?? 0));
    const byTitleExact = results.filter(r => r._sourceType === 'title-exact');
    const byBm25 = results.filter(r => r._sourceType === 'bm25');

    const vecRank = new Map<string, number>();
    const kwRank = new Map<string, number>();
    const titleRank = new Map<string, number>();
    const bm25Rank = new Map<string, number>();

    byVector.forEach((r, idx) => vecRank.set(r.id, idx + 1));
    byKeyword.forEach((r, idx) => kwRank.set(r.id, idx + 1));
    byTitleExact.forEach((r, idx) => titleRank.set(r.id, idx + 1));
    byBm25.forEach((r, idx) => bm25Rank.set(r.id, idx + 1));

    // RRFスコア計算
    return results.map(result => {
      const vr = vecRank.get(result.id) ?? 1000000;
      const kr = kwRank.get(result.id) ?? 1000000;
      const tr = titleRank.get(result.id);
      const br = bm25Rank.get(result.id);

      // 重み: vector=1.0, keyword=0.8, title-exact=1.2, bm25=0.6
      let rrf = (1.0 / (kRrf + vr)) + 0.8 * (1 / (kRrf + kr)) + 
                (tr ? 1.2 * (1 / (kRrf + tr)) : 0) + 
                (br ? 0.6 * (1 / (kRrf + br)) : 0);

      // ドメイン減衰適用
      rrf = this.applyDomainPenalty(rrf, result);

      return {
        ...result,
        _rrfScore: rrf
      };
    });
  }

  /**
   * ドメイン減衰・ブースト適用（RRF段階）
   * Phase 5改善: クエリに関連するドメイン固有キーワードのみをブースト
   */
  private applyDomainPenalty(rrf: number, result: RawSearchResult, query?: string): number {
    try {
      const titleStr = String(result.title || '').toLowerCase();
      const labelsArr = this.getLabelsAsArray(result.labels);
      const lowerLabels = labelsArr.map((x) => String(x).toLowerCase());
      
      const penaltyTerms = labelManager.getPenaltyTerms();
      
      const hasPenalty = penaltyTerms.some(t => titleStr.includes(t)) || 
                        lowerLabels.some(l => penaltyTerms.some(t => l.includes(t)));
      const isGenericDoc = GENERIC_DOCUMENT_TERMS.some(t => titleStr.includes(t.toLowerCase()));
      
      // 減衰適用（強化版）
      if (hasPenalty) rrf *= 0.9;
      if (isGenericDoc) rrf *= 0.5;  // 0.8 → 0.5に強化（50%減衰）
      if (String(result.title || '').includes('本システム外')) rrf *= 0.8;
      
      // Phase 5改善: クエリとタイトルの両方に含まれるドメイン固有キーワードのみをブースト
      if (query && !isGenericDoc) {
        const matchingKeywordCount = CommonTermsHelper.countMatchingDomainKeywords(query, String(result.title || ''));
        
        if (matchingKeywordCount > 0) {
          // マッチしたキーワード数に応じてブースト（最大2倍）
          const boostFactor = 1.0 + (matchingKeywordCount * 0.5);
          rrf *= Math.min(boostFactor, 2.0);
        }
      }
      
    } catch (error) {
      console.warn('[UnifiedSearchResultProcessor] Domain penalty calculation failed:', error);
    }
    
    return rrf;
  }

  /**
   * 結果フォーマット
   */
  private formatResults(results: RawSearchResult[]): ProcessedSearchResult[] {
    return results.map(result => {
      const sourceType = (result._sourceType || 'vector') as 'vector' | 'keyword' | 'hybrid' | 'bm25';
      const distance = result._distance ?? 1;
      const bm25Score = result._bm25Score ?? result._keywordScore ?? 0;

      // スコア計算
      // 注意: Composite Scoreが利用可能な場合は、それを優先的に使用（0-1の範囲を0-100に変換）
      const compositeScore = (result as any)._compositeScore; // 最新の計算ロジック（Composite Score）
      
      // まず、compositeScoreが有効な数値かチェック
      const hasValidCompositeScore = typeof compositeScore === 'number' && 
                                      !isNaN(compositeScore) && 
                                      isFinite(compositeScore) && 
                                      compositeScore >= 0;
      
      // distanceを安全に処理（undefined、null、NaN、負の値を考慮）
      const safeDistance = (typeof distance === 'number' && !isNaN(distance) && isFinite(distance))
        ? Math.max(0, distance) // 負の値を0にクランプ（距離は非負であるべき）
        : 1.0; // デフォルト値
      
      // bm25Scoreを安全に処理
      const safeBm25Score = (typeof bm25Score === 'number' && !isNaN(bm25Score) && isFinite(bm25Score))
        ? Math.max(0, bm25Score)
        : 0;
      
      let finalScore: number;
      
      if (hasValidCompositeScore) {
        // Composite Scoreを使用（0-1の範囲を0-100に変換）
        finalScore = Math.round(Math.max(0, Math.min(100, compositeScore * 100)));
      } else if (sourceType === 'bm25' || sourceType === 'keyword') {
        // BM25/キーワード検索の場合
        finalScore = Math.min(100, Math.max(0, safeBm25Score * 10));
      } else {
        // ベクトル検索の場合
        finalScore = calculateSimilarityPercentage(safeDistance);
      }
      
      // 最終的な安全チェック（NaNやundefined、Infinityを防ぐ）
      if (typeof finalScore !== 'number' || isNaN(finalScore) || !isFinite(finalScore)) {
        // フォールバック: 距離ベースの計算（安全な値を使用）
        finalScore = calculateSimilarityPercentage(safeDistance);
      }
      
      // 最終的な範囲チェック（0-100の範囲に制限）
      finalScore = Math.max(0, Math.min(100, finalScore));
      
      // デバッグログ（本番環境での問題を診断するため）
      if (process.env.NODE_ENV === 'development' && (finalScore === undefined || finalScore === null || isNaN(finalScore))) {
        console.warn(`[UnifiedSearchResultProcessor] Invalid finalScore:`, {
          finalScore,
          compositeScore,
          hasValidCompositeScore,
          sourceType,
          distance,
          safeDistance,
          bm25Score,
          safeBm25Score,
          title: result.title?.substring(0, 50)
        });
      }

      // スコア情報生成（最新の計算ロジック: Composite Score を優先的に使用）
      const scoreKind = sourceType;
      const scoreRaw = sourceType === 'bm25' || sourceType === 'keyword' ? bm25Score : distance;
      const scoreText = generateScoreText(sourceType, bm25Score, distance, compositeScore);

      // 🔧 BOM文字（U+FEFF）を削除（データベースからのデータにBOM文字が含まれている可能性を考慮）
      const cleanTitle = (result.title || 'No Title').replace(/\uFEFF/g, '');
      const cleanContent = (result.content || '').replace(/\uFEFF/g, '');
      
      return {
        id: result.id,
        pageId: result.pageId ?? result.page_id, // ★★★ MIGRATION: page_idをフォールバックとして使用 ★★★
        page_id: result.page_id ?? result.pageId, // ★★★ MIGRATION: page_idを保持 ★★★
        title: cleanTitle,
        content: cleanContent,
        isChunked: result.isChunked,  // Phase 0A-3: チャンク統合判定フラグ
        distance: distance,
        score: finalScore, // Composite Scoreが利用可能な場合はそれを使用、それ以外は従来の計算
        space_key: result.space_key,
        labels: this.getLabelsAsArray(result.labels),
        url: buildConfluenceUrl(result.pageId || result.page_id, result.space_key, result.url),
        lastUpdated: result.lastUpdated || '',
        source: sourceType,
        matchDetails: result._matchDetails || {},
        rrfScore: result._rrfScore || 0,
        _rrfScore: (result as any)._rrfScore, // デバッグ用に保持
        scoreKind,
        scoreRaw,
        scoreText,
        // Phase 0A-4: Composite Scoringフィールドを保持
        _compositeScore: (result as any)._compositeScore,
        _scoreBreakdown: (result as any)._scoreBreakdown,
        // StructuredLabelフィールドを保持
        structured_category: (result as any).structured_category,
        structured_domain: (result as any).structured_domain,
        structured_feature: (result as any).structured_feature,
        structured_status: (result as any).structured_status,
        structured_priority: (result as any).structured_priority,
        structured_confidence: (result as any).structured_confidence,
        structured_tags: getLabelsAsArray((result as any).structured_tags),
        structured_version: (result as any).structured_version,
        structured_content_length: (result as any).structured_content_length,
        structured_is_valid: (result as any).structured_is_valid,
        // 検索メタデータフィールドを保持（デバッグ用）
        keyword: (result as any).keyword,
        titleScore: (result as any).title,  // Renamed to avoid conflict with title property
        labelScore: (result as any).label,  // Renamed to avoid conflict
        _titleMatchRatio: (result as any)._titleMatchRatio,
        _titleMatchedKeywords: (result as any)._titleMatchedKeywords, // ★★★ 追加: タイトルマッチキーワード数を保持 ★★★
        _bm25Score: (result as any)._bm25Score, // ★★★ 追加: BM25スコアを保持 ★★★
        _distance: result._distance,
        _hybridScore: result._hybridScore,
        _sourceType: result._sourceType,
        // Jira特有のフィールドを保持
        issue_key: result.issue_key,
        status: result.status,
        status_category: result.status_category,
        priority: result.priority,
        assignee: result.assignee,
        issue_type: result.issue_type,
        updated_at: result.updated_at,
      };
    });
  }

  /**
   * ラベル配列の取得（統一処理）
   */
  private getLabelsAsArray(labels: string | string[] | undefined): string[] {
    if (!labels) return [];
    if (Array.isArray(labels)) return labels;
    if (typeof labels === 'string') {
      try {
        const parsed = JSON.parse(labels);
        return Array.isArray(parsed) ? parsed : [labels];
      } catch {
        return [labels];
      }
    }
    return [];
  }

  /**
   * 結果の並び替え（RRFスコア順）
   */
  public sortByRRFScore(results: ProcessedSearchResult[]): ProcessedSearchResult[] {
    return [...results].sort((a, b) => (b.rrfScore || 0) - (a.rrfScore || 0));
  }

  /**
   * 結果の並び替え（ハイブリッドスコア順）
   */
  public sortByHybridScore(results: ProcessedSearchResult[]): ProcessedSearchResult[] {
    return [...results].sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * 結果のフィルタリング
   */
  public filterResults(
    results: ProcessedSearchResult[],
    minScore: number = 0,
    maxResults: number = 10
  ): ProcessedSearchResult[] {
    return results
      .filter(result => result.score >= minScore)
      .slice(0, maxResults);
  }
}

// シングルトンインスタンスをエクスポート
export const unifiedSearchResultProcessor = UnifiedSearchResultProcessor.getInstance();
