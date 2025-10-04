/**
 * スコア計算に関する共通ユーティリティ関数
 * 重複コードを統一し、一貫したスコア計算を提供
 */

/**
 * ベクトル距離から類似度パーセンテージを計算
 * @param distance ベクトル距離（0-1の範囲）
 * @returns 類似度パーセンテージ（0-100%）
 */
export function calculateSimilarityPercentage(distance: number): number {
  return Math.max(0, Math.min(100, Math.round((1 - distance) * 1000) / 10));
}

/**
 * 距離値から類似度スコアを計算（ユークリッド距離対応）
 * @param distance 距離値
 * @returns 類似度スコア（0-100%）
 */
export function calculateSimilarityScore(distance: number): number {
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
 * BM25スコアを0-100%の範囲に正規化
 * @param score BM25スコア
 * @param maxScore 最大スコア値（デフォルト: 20）
 * @returns 正規化されたスコア（0-100%）
 */
export function normalizeBM25Score(score: number, maxScore: number = 20): number {
  const normalized = Math.max(0, Math.min(1, score / maxScore));
  return Math.round(normalized * 100);
}

/**
 * スコアテキストを生成
 * @param sourceType ソースタイプ
 * @param score スコア値
 * @param distance 距離値（ベクトル/ハイブリッドの場合）
 * @returns スコアテキスト
 */
/**
 * ハイブリッドスコアを計算（統一版）
 * @param vectorDistance ベクトル距離（0-1の範囲）
 * @param keywordScore キーワードスコア
 * @param labelScore ラベルスコア
 * @param vectorWeight ベクトル重み（デフォルト: 0.4）
 * @param keywordWeight キーワード重み（デフォルト: 0.4）
 * @param labelWeight ラベル重み（デフォルト: 0.2）
 * @returns ハイブリッドスコア（0-1の範囲）
 */
export function calculateHybridScore(
  vectorDistance: number,
  keywordScore: number,
  labelScore: number,
  vectorWeight: number = 0.4,
  keywordWeight: number = 0.4,
  labelWeight: number = 0.2
): number {
  // ベクトル距離を0-1の範囲に正規化
  const normalizedDistance = Math.min(1, Math.max(0, vectorDistance));
  
  // キーワードスコアを0-1の範囲に正規化
  const normalizedKeywordScore = Math.min(1, keywordScore / 10);
  
  // ラベルスコアを0-1の範囲に正規化
  const normalizedLabelScore = Math.min(1, labelScore / 5);
  
  // 重み付け平均
  return (normalizedDistance * vectorWeight) + (normalizedKeywordScore * keywordWeight) + (normalizedLabelScore * labelWeight);
}

/**
 * ハイブリッド検索エンジン用のスコア計算（ベクトル + BM25）
 * @param vectorScore ベクトルスコア（距離）
 * @param bm25Score BM25スコア
 * @param vectorWeight ベクトル重み（デフォルト: 0.5）
 * @param bm25Weight BM25重み（デフォルト: 0.5）
 * @returns ハイブリッドスコア
 */
export function calculateHybridSearchScore(
  vectorScore: number,
  bm25Score: number,
  vectorWeight: number = 0.5,
  bm25Weight: number = 0.5
): number {
  // ベクトルスコアは距離なので、1から引いて類似度に変換
  const vectorSimilarity = 1 - vectorScore;
  
  // 正規化されたBM25スコア（0-1の範囲に正規化）
  const normalizedBm25 = Math.min(bm25Score / 10, 1);
  
  // 重み付き平均
  return vectorWeight * vectorSimilarity + bm25Weight * normalizedBm25;
}

export function generateScoreText(
  sourceType: 'vector' | 'bm25' | 'keyword' | 'hybrid',
  score?: number,
  distance?: number
): string {
  switch (sourceType) {
    case 'vector':
    case 'hybrid':
      const similarityPct = calculateSimilarityPercentage(distance ?? 1);
      return `${sourceType === 'hybrid' ? 'Hybrid' : 'Vector'} ${similarityPct}%`;
    case 'bm25':
      // BM25スコアをパーセンテージで統一表示
      const normalizedBM25 = normalizeBM25Score(score ?? 0, 30); // 最大スコアを30に調整
      return `BM25 ${normalizedBM25}%`;
    case 'keyword':
      // キーワードスコアもパーセンテージで統一表示
      const normalizedKeyword = Math.min(100, Math.max(0, ((score ?? 0) / 20) * 100));
      return `Keyword ${Math.round(normalizedKeyword)}%`;
    default:
      return 'Unknown';
  }
}
