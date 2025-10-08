/**
 * 統計計算ユーティリティ
 * 日別トレンド、平均値、分布計算などの共通ロジックを提供
 */

export interface DailyTrend {
  date: string;
  value: number;
  count: number;
}

export interface Distribution {
  [key: string]: number;
}

/**
 * 日別トレンドを計算
 * @param items データ配列
 * @param valueExtractor 値を抽出する関数
 * @returns 日別トレンド配列（日付でソート済み）
 */
export function calculateDailyTrend<T extends { timestamp: Date }>(
  items: T[],
  valueExtractor: (item: T) => number
): DailyTrend[] {
  const dailyMap = new Map<string, { total: number; count: number }>();
  
  items.forEach(item => {
    const date = item.timestamp.toISOString().split('T')[0];
    const existing = dailyMap.get(date) || { total: 0, count: 0 };
    existing.total += valueExtractor(item);
    existing.count++;
    dailyMap.set(date, existing);
  });
  
  return Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      value: data.total / data.count,
      count: data.count
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 分布を計算
 * @param items データ配列
 * @param keyExtractor キーを抽出する関数
 * @returns 分布オブジェクト
 */
export function calculateDistribution<T>(
  items: T[],
  keyExtractor: (item: T) => string | number
): Distribution {
  const distribution: Distribution = {};
  
  items.forEach(item => {
    const key = String(keyExtractor(item));
    distribution[key] = (distribution[key] || 0) + 1;
  });
  
  return distribution;
}

/**
 * 平均値を計算
 * @param items データ配列
 * @param valueExtractor 値を抽出する関数
 * @returns 平均値
 */
export function calculateAverage<T>(
  items: T[],
  valueExtractor: (item: T) => number
): number {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + valueExtractor(item), 0);
  return total / items.length;
}

/**
 * 中央値を計算
 * @param items データ配列
 * @param valueExtractor 値を抽出する関数
 * @returns 中央値
 */
export function calculateMedian<T>(
  items: T[],
  valueExtractor: (item: T) => number
): number {
  if (items.length === 0) return 0;
  
  const values = items.map(valueExtractor).sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  
  if (values.length % 2 === 0) {
    return (values[mid - 1] + values[mid]) / 2;
  } else {
    return values[mid];
  }
}

/**
 * 合計値を計算
 * @param items データ配列
 * @param valueExtractor 値を抽出する関数
 * @returns 合計値
 */
export function calculateSum<T>(
  items: T[],
  valueExtractor: (item: T) => number
): number {
  return items.reduce((sum, item) => sum + valueExtractor(item), 0);
}

/**
 * パーセンタイルを計算
 * @param items データ配列
 * @param valueExtractor 値を抽出する関数
 * @param percentile パーセンタイル（0-100）
 * @returns パーセンタイル値
 */
export function calculatePercentile<T>(
  items: T[],
  valueExtractor: (item: T) => number,
  percentile: number
): number {
  if (items.length === 0) return 0;
  if (percentile < 0 || percentile > 100) {
    throw new Error('Percentile must be between 0 and 100');
  }
  
  const values = items.map(valueExtractor).sort((a, b) => a - b);
  const index = (percentile / 100) * (values.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  
  if (lower === upper) {
    return values[lower];
  }
  
  return values[lower] * (1 - weight) + values[upper] * weight;
}

/**
 * 標準偏差を計算
 * @param items データ配列
 * @param valueExtractor 値を抽出する関数
 * @returns 標準偏差
 */
export function calculateStandardDeviation<T>(
  items: T[],
  valueExtractor: (item: T) => number
): number {
  if (items.length === 0) return 0;
  
  const avg = calculateAverage(items, valueExtractor);
  const squaredDiffs = items.map(item => {
    const diff = valueExtractor(item) - avg;
    return diff * diff;
  });
  
  const variance = squaredDiffs.reduce((sum, sq) => sum + sq, 0) / items.length;
  return Math.sqrt(variance);
}

/**
 * グループ化して集計
 * @param items データ配列
 * @param keyExtractor キーを抽出する関数
 * @param valueExtractor 値を抽出する関数
 * @param aggregator 集計関数（デフォルトは合計）
 * @returns グループ化された集計結果
 */
export function groupByAndAggregate<T>(
  items: T[],
  keyExtractor: (item: T) => string | number,
  valueExtractor: (item: T) => number,
  aggregator: (values: number[]) => number = (values) => values.reduce((sum, v) => sum + v, 0)
): Record<string, number> {
  const groups = new Map<string, number[]>();
  
  items.forEach(item => {
    const key = String(keyExtractor(item));
    const value = valueExtractor(item);
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(value);
  });
  
  const result: Record<string, number> = {};
  groups.forEach((values, key) => {
    result[key] = aggregator(values);
  });
  
  return result;
}

/**
 * 移動平均を計算
 * @param items データ配列（timestamp順にソート済みであること）
 * @param valueExtractor 値を抽出する関数
 * @param windowSize ウィンドウサイズ
 * @returns 移動平均配列
 */
export function calculateMovingAverage<T>(
  items: T[],
  valueExtractor: (item: T) => number,
  windowSize: number
): number[] {
  if (items.length === 0 || windowSize <= 0) return [];
  
  const result: number[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const start = Math.max(0, i - windowSize + 1);
    const window = items.slice(start, i + 1);
    const avg = calculateAverage(window, valueExtractor);
    result.push(avg);
  }
  
  return result;
}

