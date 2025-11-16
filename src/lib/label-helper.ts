/**
 * ラベル処理ヘルパー関数
 * LanceDBのArrow Vector型をJavaScript配列として扱うためのユーティリティ
 */

import { getLabelsAsArray } from './label-utils';

/**
 * ラベルフィルタリング用のヘルパー
 * @param labels - 対象のラベル
 * @param excludeLabels - 除外するラベルの配列
 * @returns 除外対象かどうか
 */
export function shouldExcludeByLabels(labels: any, excludeLabels: string[]): boolean {
  const labelsArray = getLabelsAsArray(labels);
  return labelsArray.some(label => excludeLabels.includes(label));
}
