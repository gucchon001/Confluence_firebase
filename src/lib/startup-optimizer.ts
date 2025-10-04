/**
 * アプリケーション起動時の最適化処理
 * パフォーマンス向上のための事前初期化を実行
 */

import { preInitializeTokenizer } from './japanese-tokenizer';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 起動時の最適化処理を実行
 * 複数回呼び出されても一度だけ実行される
 */
export async function initializeStartupOptimizations(): Promise<void> {
  if (isInitialized) {
    console.log('[StartupOptimizer] Already initialized, skipping...');
    return;
  }

  if (initializationPromise) {
    console.log('[StartupOptimizer] Initialization in progress, waiting...');
    return initializationPromise;
  }

  console.log('[StartupOptimizer] Starting startup optimizations...');
  const startTime = Date.now();

  initializationPromise = performInitialization();
  
  try {
    await initializationPromise;
    isInitialized = true;
    const endTime = Date.now();
    console.log(`[StartupOptimizer] Startup optimizations completed in ${endTime - startTime}ms`);
  } catch (error) {
    console.error('[StartupOptimizer] Startup optimization failed:', error);
    initializationPromise = null;
    throw error;
  }
}

/**
 * 実際の初期化処理を実行
 */
async function performInitialization(): Promise<void> {
  const optimizations = [
    {
      name: 'Japanese Tokenizer',
      fn: async () => {
        console.log('[StartupOptimizer] Pre-initializing Japanese tokenizer...');
        const startTime = Date.now();
        await preInitializeTokenizer();
        const endTime = Date.now();
        console.log(`[StartupOptimizer] Japanese tokenizer initialized in ${endTime - startTime}ms`);
      }
    }
  ];

  // 並列で初期化処理を実行
  const promises = optimizations.map(async (opt) => {
    try {
      await opt.fn();
      console.log(`[StartupOptimizer] ✅ ${opt.name} initialization completed`);
    } catch (error) {
      console.error(`[StartupOptimizer] ❌ ${opt.name} initialization failed:`, error);
      throw error;
    }
  });

  await Promise.all(promises);
}

/**
 * 初期化状態を確認
 */
export function isStartupOptimized(): boolean {
  return isInitialized;
}

/**
 * 初期化をリセット（テスト用）
 */
export function resetStartupOptimization(): void {
  isInitialized = false;
  initializationPromise = null;
}
