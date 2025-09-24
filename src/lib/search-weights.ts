/**
 * 検索重み付けユーティリティ
 */

export interface LabelFilterOptions {
  excludeArchived?: boolean;
  excludeMeetingNotes?: boolean;
  excludeTemplates?: boolean;
  excludeGeneric?: boolean;
}

export interface KeywordScoreResult {
  score: number;
  titleMatches: number;
  labelMatches: number;
  contentMatches: number;
}

/**
 * キーワードスコアを計算
 */
export function calculateKeywordScore(
  title: string,
  content: string,
  labels: string[] | string | undefined,
  keywords: string[],
  priority: { highPriority: Set<string>; lowPriority: Set<string> }
): KeywordScoreResult {
  const titleMatches = countMatches(title, keywords);
  const labelMatches = countMatches(Array.isArray(labels) ? labels.join(' ') : String(labels || ''), keywords);
  const contentMatches = countMatches(content, keywords);

  let score = 0;
  
  // タイトルマッチの重み付け
  score += titleMatches * 3;
  
  // ラベルマッチの重み付け
  score += labelMatches * 2;
  
  // コンテンツマッチの重み付け
  score += contentMatches * 1;
  
  // 優先度による重み付け
  for (const keyword of keywords) {
    if (priority.highPriority.has(keyword)) {
      score += 2;
    } else if (priority.lowPriority.has(keyword)) {
      score += 1;
    }
  }

  return {
    score,
    titleMatches,
    labelMatches,
    contentMatches
  };
}

/**
 * ハイブリッドスコアを計算
 */
export function calculateHybridScore(
  distance: number,
  keywordScore: number,
  labelScore: number
): number {
  // ベクトル距離を0-1の範囲に正規化
  const normalizedDistance = Math.min(1, Math.max(0, distance));
  
  // キーワードスコアを0-1の範囲に正規化
  const normalizedKeywordScore = Math.min(1, keywordScore / 10);
  
  // ラベルスコアを0-1の範囲に正規化
  const normalizedLabelScore = Math.min(1, labelScore / 5);
  
  // 重み付け平均
  return (normalizedDistance * 0.4) + (normalizedKeywordScore * 0.4) + (normalizedLabelScore * 0.2);
}

/**
 * 文字列内のキーワードマッチ数をカウント
 */
function countMatches(text: string, keywords: string[]): number {
  if (!text || !keywords.length) return 0;
  
  const lowerText = text.toLowerCase();
  let matches = 0;
  
  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      matches++;
    }
  }
  
  return matches;
}
