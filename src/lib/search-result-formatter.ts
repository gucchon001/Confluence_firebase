/**
 * 検索結果フォーマット処理の統一ユーティリティ
 * 重複コードを解消し、一貫した検索結果フォーマットを提供
 */

import { generateScoreText, calculateHybridScore, calculateHybridSearchScore } from './score-utils';

export interface BaseSearchResult {
  id: string;
  pageId?: number;
  title: string;
  content: string;
  distance?: number;
  score?: number;
  space_key?: string;
  labels?: string[] | string;
  url?: string;
  lastUpdated?: string;
  source?: 'vector' | 'bm25' | 'keyword' | 'hybrid';
  matchDetails?: {
    titleMatches?: number;
    labelMatches?: number;
    contentMatches?: number;
  };
  // 内部スコア情報
  _distance?: number;
  _keywordScore?: number;
  _labelScore?: number;
  _hybridScore?: number;
  _sourceType?: 'vector' | 'bm25' | 'keyword' | 'hybrid';
  _rrfScore?: number;
  _crossScore?: number;
}

export interface FormattedSearchResult {
  id: string;
  pageId?: number;
  title: string;
  content: string;
  distance: number;
  score: number;
  space_key?: string;
  labels: string[];
  url: string;
  lastUpdated: string;
  source: 'vector' | 'bm25' | 'keyword' | 'hybrid';
  matchDetails: {
    titleMatches?: number;
    labelMatches?: number;
    contentMatches?: number;
  };
  rrfScore: number;
  scoreKind: 'vector' | 'bm25' | 'keyword' | 'hybrid';
  scoreRaw: number;
  scoreText: string;
}

/**
 * ラベルを配列形式に正規化
 */
function normalizeLabels(labels: string[] | string | undefined): string[] {
  if (!labels) return [];
  if (Array.isArray(labels)) return labels;
  if (typeof labels === 'string') {
    try {
      return JSON.parse(labels);
    } catch {
      return [labels];
    }
  }
  return [];
}

/**
 * 検索結果を統一フォーマットに変換
 */
export function formatSearchResult(
  result: BaseSearchResult,
  options: {
    useHybridScoring?: boolean;
    vectorWeight?: number;
    keywordWeight?: number;
    labelWeight?: number;
  } = {}
): FormattedSearchResult {
  const {
    useHybridScoring = true,
    vectorWeight = 0.4,
    keywordWeight = 0.4,
    labelWeight = 0.2
  } = options;

  // 基本フィールドの正規化
  const normalizedLabels = normalizeLabels(result.labels);
  const distance = result._distance ?? result.distance ?? 1;
  const keywordScore = result._keywordScore ?? 0;
  const labelScore = result._labelScore ?? 0;
  const rrfScore = result._rrfScore ?? 0;

  // ソースタイプの決定
  const sourceType = result._sourceType ?? result.source ?? 'vector';

  // スコア計算
  let finalScore: number;
  let scoreKind: 'vector' | 'bm25' | 'keyword' | 'hybrid';
  let scoreRaw: number;

  if (useHybridScoring && (keywordScore > 0 || labelScore > 0)) {
    // ハイブリッドスコア計算
    finalScore = calculateHybridScore(distance, keywordScore, labelScore, vectorWeight, keywordWeight, labelWeight);
    scoreKind = 'hybrid';
    scoreRaw = finalScore;
  } else {
    // ベクトルスコアのみ
    finalScore = distance;
    scoreKind = sourceType as 'vector' | 'bm25' | 'keyword';
    scoreRaw = distance;
  }

  // スコアテキスト生成
  const scoreText = generateScoreText(scoreKind, scoreRaw, distance);

  return {
    id: result.id,
    pageId: result.pageId,
    title: result.title || 'No Title',
    content: result.content || '',
    distance: distance,
    score: finalScore,
    space_key: result.space_key,
    labels: normalizedLabels,
    url: result.url || '',
    lastUpdated: result.lastUpdated || '',
    source: sourceType,
    matchDetails: result.matchDetails || {},
    rrfScore: rrfScore,
    scoreKind: scoreKind,
    scoreRaw: scoreRaw,
    scoreText: scoreText
  };
}

/**
 * 複数の検索結果を一括フォーマット
 */
export function formatSearchResults(
  results: BaseSearchResult[],
  options: {
    useHybridScoring?: boolean;
    vectorWeight?: number;
    keywordWeight?: number;
    labelWeight?: number;
  } = {}
): FormattedSearchResult[] {
  return results.map(result => formatSearchResult(result, options));
}

/**
 * ハイブリッド検索結果の統合と再ランキング
 */
export function combineAndRerankResults(
  vectorResults: FormattedSearchResult[],
  bm25Results: FormattedSearchResult[],
  topK: number,
  vectorWeight: number = 0.5,
  bm25Weight: number = 0.5
): FormattedSearchResult[] {
  // ページIDでグループ化
  const pageGroups = new Map<number, FormattedSearchResult[]>();

  // ベクトル検索結果を追加
  vectorResults.forEach(result => {
    if (!pageGroups.has(result.pageId!)) {
      pageGroups.set(result.pageId!, []);
    }
    pageGroups.get(result.pageId!)!.push(result);
  });

  // BM25検索結果を追加
  bm25Results.forEach(result => {
    if (!pageGroups.has(result.pageId!)) {
      pageGroups.set(result.pageId!, []);
    }
    pageGroups.get(result.pageId!)!.push(result);
  });

  // ハイブリッドスコアを計算
  const hybridResults: FormattedSearchResult[] = [];
  
  for (const [pageId, results] of pageGroups) {
    const vectorResult = results.find(r => r.source === 'vector');
    const bm25Result = results.find(r => r.source === 'bm25');

    if (vectorResult && bm25Result) {
      // 両方の結果がある場合：ハイブリッドスコアを計算
      const hybridScore = calculateHybridSearchScore(
        vectorResult.scoreRaw,
        bm25Result.scoreRaw,
        vectorWeight,
        bm25Weight
      );
      
      hybridResults.push({
        ...vectorResult,
        source: 'hybrid',
        scoreKind: 'hybrid',
        scoreRaw: hybridScore,
        score: hybridScore,
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

  // スコアでソートして上位K件を返す
  return hybridResults
    .sort((a, b) => b.scoreRaw - a.scoreRaw)
    .slice(0, topK);
}

/**
 * 重複除去（ページIDとタイトルで判定）
 */
export function deduplicateResults(results: FormattedSearchResult[]): FormattedSearchResult[] {
  const dedupMap = new Map<string, FormattedSearchResult>();
  
  for (const result of results) {
    const key = `${result.pageId || ''}::${(result.title || '').toLowerCase()}`;
    const existing = dedupMap.get(key);
    
    if (!existing || result.rrfScore > existing.rrfScore) {
      dedupMap.set(key, result);
    }
  }
  
  return Array.from(dedupMap.values());
}
