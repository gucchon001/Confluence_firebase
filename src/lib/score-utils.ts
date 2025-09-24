/**
 * スコア計算に関する共通ユーティリティ関数
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
      return `BM25 ${(score ?? 0).toFixed(2)}`;
    case 'keyword':
      return `Keyword ${(score ?? 0).toFixed(2)}`;
    default:
      return 'Unknown';
  }
}
