/**
 * ラベル処理ヘルパー関数
 * LanceDBのArrow Vector型をJavaScript配列として扱うためのユーティリティ
 */

/**
 * LanceDBから取得したラベルをJavaScript配列に変換
 * @param labels - LanceDBから取得したラベル（Arrow Vector型または配列）
 * @returns JavaScript配列
 */
export function convertLabelsToArray(labels: any): string[] {
  if (Array.isArray(labels)) {
    return [...labels].map(String);
  } else if (labels && typeof labels === 'object') {
    try {
      // Arrow Vector型の場合は配列に変換
      return Array.from(labels).map(String);
    } catch (error) {
      console.warn('ラベル変換エラー:', error);
      return [];
    }
  } else {
    return [];
  }
}

/**
 * ラベルが配列として動作するかテスト
 * @param labels - テスト対象のラベル
 * @returns 配列として動作するかどうか
 */
export function isLabelsArrayCompatible(labels: any): boolean {
  try {
    if (labels && typeof labels === 'object') {
      // 配列メソッドをテスト
      const length = labels.length;
      const first = labels[0];
      const join = labels.join(', ');
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * ラベルの型情報を取得
 * @param labels - 対象のラベル
 * @returns 型情報オブジェクト
 */
export function getLabelsTypeInfo(labels: any): {
  type: string;
  isArray: boolean;
  isArrayCompatible: boolean;
  length: number;
  values: string[];
} {
  return {
    type: typeof labels,
    isArray: Array.isArray(labels),
    isArrayCompatible: isLabelsArrayCompatible(labels),
    length: labels?.length || 0,
    values: convertLabelsToArray(labels)
  };
}

/**
 * ラベルフィルタリング用のヘルパー
 * @param labels - 対象のラベル
 * @param excludeLabels - 除外するラベルの配列
 * @returns 除外対象かどうか
 */
export function shouldExcludeByLabels(labels: any, excludeLabels: string[]): boolean {
  const labelsArray = convertLabelsToArray(labels);
  return labelsArray.some(label => excludeLabels.includes(label));
}

/**
 * ラベル検索用のヘルパー
 * @param labels - 対象のラベル
 * @param searchLabels - 検索するラベルの配列
 * @returns マッチするかどうか
 */
export function hasMatchingLabels(labels: any, searchLabels: string[]): boolean {
  const labelsArray = convertLabelsToArray(labels);
  return searchLabels.some(searchLabel => 
    labelsArray.some(label => label.includes(searchLabel))
  );
}
