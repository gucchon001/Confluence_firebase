/**
 * メモリ使用量監視ユーティリティ
 * メモリリークや異常なメモリ使用量を検出するために使用
 */

export interface MemoryUsage {
  heapUsed: number;      // ヒープ使用量（バイト）
  heapTotal: number;     // ヒープ総量（バイト）
  rss: number;           // 実メモリ使用量（バイト）
  external: number;      // 外部メモリ使用量（バイト）
  arrayBuffers: number;  // ArrayBuffer使用量（バイト）
}

export interface MemoryUsageFormatted {
  heapUsed: string;      // ヒープ使用量（MB）
  heapTotal: string;     // ヒープ総量（MB）
  rss: string;           // 実メモリ使用量（MB）
  external: string;      // 外部メモリ使用量（MB）
  arrayBuffers: string;  // ArrayBuffer使用量（MB）
  total: string;         // 合計（MB）
}

/**
 * 現在のメモリ使用量を取得
 */
export function getMemoryUsage(): MemoryUsage {
  const usage = process.memoryUsage();
  return {
    heapUsed: usage.heapUsed,
    heapTotal: usage.heapTotal,
    rss: usage.rss,
    external: usage.external,
    arrayBuffers: usage.arrayBuffers || 0
  };
}

/**
 * メモリ使用量をフォーマット（MB単位）
 */
export function formatMemoryUsage(usage: MemoryUsage): MemoryUsageFormatted {
  return {
    heapUsed: `${(usage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    heapTotal: `${(usage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
    rss: `${(usage.rss / 1024 / 1024).toFixed(2)}MB`,
    external: `${(usage.external / 1024 / 1024).toFixed(2)}MB`,
    arrayBuffers: `${(usage.arrayBuffers / 1024 / 1024).toFixed(2)}MB`,
    total: `${((usage.heapUsed + usage.external + usage.arrayBuffers) / 1024 / 1024).toFixed(2)}MB`
  };
}

/**
 * メモリ使用量をログに記録
 * @param label ラベル（処理名など）
 * @param usage メモリ使用量（省略時は現在の使用量を取得）
 */
export function logMemoryUsage(label: string, usage?: MemoryUsage): void {
  // ⚡ ログ削減: デバッグ時のみ詳細ログを出力
  const DEBUG_MEMORY = process.env.NODE_ENV === 'development' && process.env.DEBUG_MEMORY === 'true';
  
  const currentUsage = usage || getMemoryUsage();
  const formatted = formatMemoryUsage(currentUsage);
  
  if (DEBUG_MEMORY) {
    console.log(`[Memory] ${label}:`, {
      heapUsed: formatted.heapUsed,
      heapTotal: formatted.heapTotal,
      rss: formatted.rss,
      external: formatted.external,
      arrayBuffers: formatted.arrayBuffers,
      total: formatted.total
    });
  }
  
  // RSS（実メモリ使用量）が4GBを超えている場合は警告（常に出力）
  if (currentUsage.rss > 4 * 1024 * 1024 * 1024) {
    console.warn(`⚠️ [Memory] ${label}: RSS exceeds 4GB (${formatted.rss})`);
  }
  
  // ヒープ使用量が2GBを超えている場合は警告（常に出力）
  if (currentUsage.heapUsed > 2 * 1024 * 1024 * 1024) {
    console.warn(`⚠️ [Memory] ${label}: Heap used exceeds 2GB (${formatted.heapUsed})`);
  }
}

/**
 * メモリ使用量の差分を計算してログに記録
 * @param label ラベル（処理名など）
 * @param before 処理前のメモリ使用量
 * @param after 処理後のメモリ使用量（省略時は現在の使用量を取得）
 */
export function logMemoryDelta(label: string, before: MemoryUsage, after?: MemoryUsage): void {
  // ⚡ ログ削減: デバッグ時のみ詳細ログを出力
  const DEBUG_MEMORY = process.env.NODE_ENV === 'development' && process.env.DEBUG_MEMORY === 'true';
  
  const afterUsage = after || getMemoryUsage();
  const delta = {
    heapUsed: afterUsage.heapUsed - before.heapUsed,
    heapTotal: afterUsage.heapTotal - before.heapTotal,
    rss: afterUsage.rss - before.rss,
    external: afterUsage.external - before.external,
    arrayBuffers: (afterUsage.arrayBuffers || 0) - (before.arrayBuffers || 0)
  };
  
  const formattedDelta = {
    heapUsed: `${delta.heapUsed >= 0 ? '+' : ''}${(delta.heapUsed / 1024 / 1024).toFixed(2)}MB`,
    heapTotal: `${delta.heapTotal >= 0 ? '+' : ''}${(delta.heapTotal / 1024 / 1024).toFixed(2)}MB`,
    rss: `${delta.rss >= 0 ? '+' : ''}${(delta.rss / 1024 / 1024).toFixed(2)}MB`,
    external: `${delta.external >= 0 ? '+' : ''}${(delta.external / 1024 / 1024).toFixed(2)}MB`,
    arrayBuffers: `${delta.arrayBuffers >= 0 ? '+' : ''}${(delta.arrayBuffers / 1024 / 1024).toFixed(2)}MB`
  };
  
  if (DEBUG_MEMORY) {
    console.log(`[Memory] ${label} (delta):`, formattedDelta);
  }
  
  // ★★★ メモリ最適化: 警告閾値を調整（検索実行時の一時的なメモリ増加は正常な動作） ★★★
  // RSSの増加が500MBを超えている場合は警告（常に出力）
  // 注意: 検索実行時はLanceDBメモリマップドファイルやLunrインデックスの読み込みにより、400-500MB程度の増加は正常
  const RSS_WARNING_THRESHOLD = 500 * 1024 * 1024; // 500MB
  if (delta.rss > RSS_WARNING_THRESHOLD) {
    console.warn(`⚠️ [Memory] ${label}: RSS increased by ${formattedDelta.rss} (threshold: 500MB)`);
  }
  
  // ヒープ使用量の増加が200MBを超えている場合は警告（常に出力）
  // 注意: 検索実行時は検索結果の配列やキャッシュにより、100-200MB程度の増加は正常
  const HEAP_WARNING_THRESHOLD = 200 * 1024 * 1024; // 200MB
  if (delta.heapUsed > HEAP_WARNING_THRESHOLD) {
    console.warn(`⚠️ [Memory] ${label}: Heap used increased by ${formattedDelta.heapUsed} (threshold: 200MB)`);
  }
}

/**
 * メモリ使用量を定期的に監視（デバッグ用）
 * @param intervalMs 監視間隔（ミリ秒）
 * @returns 監視を停止する関数
 */
export function startMemoryMonitoring(intervalMs: number = 60000): () => void {
  const intervalId = setInterval(() => {
    logMemoryUsage('Periodic check');
  }, intervalMs);
  
  // 初回も実行
  logMemoryUsage('Initial check');
  
  return () => {
    clearInterval(intervalId);
  };
}

