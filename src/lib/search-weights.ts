/**
 * 検索アルゴリズムの重み付け設定
 * これらの値を調整することで検索精度を最適化できます
 */

// ベクトル検索とキーワード検索の重み
export const VECTOR_WEIGHT = 0.5; // ベクトル検索の重み
export const KEYWORD_WEIGHT = 0.3; // キーワード検索の重み
export const LABEL_WEIGHT = 0.2; // ラベル検索の重み

// ラベルフィルタオプション
export interface LabelFilterOptions {
  includeMeetingNotes: boolean;
  includeArchived: boolean;
}

// ラベル分類と重み付け
export const LABEL_WEIGHTS = {
  // 仕様・要件系（高優先度）
  SPECIFICATION: {
    '機能要件': 0.6,        // 重みを上げる
    '共通要件': 0.5,        // 重みを上げる
    '非機能要件': 0.4,      // 重みを上げる
    'テスト要件': 0.3,      // 重みを上げる
    'テスト計画': 0.2,      // 重みを上げる
    '仕様書': 0.7,          // 新規追加
    '設計書': 0.6,          // 新規追加
    '要件定義': 0.5,        // 新規追加
    '機能仕様': 0.6,        // 新規追加
    'システム仕様': 0.5     // 新規追加
  },
  
  // 文書種別（中優先度）
  DOCUMENT_TYPE: {
    '帳票': 0.1,
    'メールテンプレート': 0.02,  // 重みを下げる
    'ワークフロー': 0.1,
    'API仕様': 0.4,         // 新規追加
    'データベース仕様': 0.3, // 新規追加
    '画面仕様': 0.3         // 新規追加
  },
  
  // 除外対象（完全除外）
  EXCLUDE_ALWAYS: ['フォルダ', 'スコープ外', 'アーカイブ'],
  
  // 条件付き除外
  EXCLUDE_CONDITIONAL: {
    '議事録': 'includeMeetingNotes',
    'meeting-notes': 'includeMeetingNotes'
  }
};

// キーワードマッチングの重み
export const WEIGHTS = {
  // タイトル関連
  TITLE_EXACT_MATCH: 0.8,   // タイトルに完全一致
  TITLE_CONTAINS: 0.5,      // タイトルに部分一致
  
  // ラベル関連
  LABEL_MATCH: 0.4,         // ラベルに一致
  
  // コンテンツ関連
  CONTENT_MATCH: 0.3,       // コンテンツに一致
  
  // 複合スコアの計算係数
  HYBRID_FACTOR: 0.7        // ハイブリッドスコア計算時の係数
};

/**
 * ラベルスコアを計算する
 * @param labels ラベル配列
 * @param filterOptions フィルタオプション
 * @returns スコアと除外フラグ
 */
export function calculateLabelScore(
  labels: string[],
  filterOptions: LabelFilterOptions
): { score: number; shouldExclude: boolean } {
  let score = 0;
  let shouldExclude = false;

  for (const label of labels) {
    // 完全除外ラベルチェック
    if (LABEL_WEIGHTS.EXCLUDE_ALWAYS.includes(label)) {
      shouldExclude = true;
      return { score: 0, shouldExclude: true };
    }

    // 条件付き除外ラベルチェック
    const conditionalKey = LABEL_WEIGHTS.EXCLUDE_CONDITIONAL[label];
    if (conditionalKey) {
      const shouldInclude = filterOptions[conditionalKey as keyof LabelFilterOptions];
      if (!shouldInclude) {
        shouldExclude = true;
        return { score: 0, shouldExclude: true };
      }
    }

    // 重み付けスコア計算
    if (LABEL_WEIGHTS.SPECIFICATION[label]) {
      score += LABEL_WEIGHTS.SPECIFICATION[label];
    } else if (LABEL_WEIGHTS.DOCUMENT_TYPE[label]) {
      score += LABEL_WEIGHTS.DOCUMENT_TYPE[label];
    }
  }

  return { score, shouldExclude };
}

/**
 * ハイブリッドスコアを計算する
 * @param vectorDistance ベクトル距離
 * @param keywordScore キーワードスコア
 * @param labelScore ラベルスコア
 * @returns ハイブリッドスコア
 */
export function calculateHybridScore(vectorDistance: number, keywordScore: number, labelScore: number = 0): number {
  return vectorDistance * VECTOR_WEIGHT - keywordScore * KEYWORD_WEIGHT - labelScore * LABEL_WEIGHT;
}

/**
 * キーワードスコアを計算する
 * @param title タイトル
 * @param content コンテンツ
 * @param labels ラベル配列
 * @param keywords 検索キーワード配列
 * @returns スコア情報
 */
export function calculateKeywordScore(
  title: string,
  content: string,
  labels: string[],
  keywords: string[]
): {
  score: number;
  titleMatches: number;
  labelMatches: number;
  contentMatches: number;
} {
  let keywordScore = 0;
  let titleMatches = 0;
  let labelMatches = 0;
  let contentMatches = 0;
  
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();
  const lowerLabels = labels.map(l => l.toLowerCase());
  
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    
    // タイトルに完全一致する場合
    if (lowerTitle === lowerKeyword) {
      keywordScore += WEIGHTS.TITLE_EXACT_MATCH;
      titleMatches++;
    }
    // タイトルに含まれる場合
    else if (lowerTitle.includes(lowerKeyword)) {
      keywordScore += WEIGHTS.TITLE_CONTAINS;
      titleMatches++;
    }
    
    // ラベルに一致する場合
    if (lowerLabels.some(label => label.includes(lowerKeyword))) {
      keywordScore += WEIGHTS.LABEL_MATCH;
      labelMatches++;
    }
    
    // コンテンツに含まれる場合
    if (lowerContent.includes(lowerKeyword)) {
      keywordScore += WEIGHTS.CONTENT_MATCH;
      contentMatches++;
    }
  }
  
  return {
    score: keywordScore,
    titleMatches,
    labelMatches,
    contentMatches
  };
}
