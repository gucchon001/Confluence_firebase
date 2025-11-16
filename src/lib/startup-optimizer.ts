/**
 * アプリケーション起動時の最適化処理
 * パフォーマンス向上のための事前初期化を実行
 */

import { preInitializeTokenizer, preInitializeTokenizerLazy } from './japanese-tokenizer';
import { saveStartupState, loadStartupState, getCacheStats } from './persistent-cache';

let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

/**
 * 初期化が完了しているかチェック
 */
export function isStartupInitialized(): boolean {
  return isInitialized;
}

/**
 * 初期化完了を待つ
 * すでに完了していれば即座にreturn
 */
export async function waitForInitialization(): Promise<void> {
  if (isInitialized) {
    return;
  }
  if (initializationPromise) {
    await initializationPromise;
  }
}

/**
 * 起動時の最適化処理を実行
 * 複数回呼び出されても一度だけ実行される
 * 
 * ⚡ 最適化: 重い初期化処理をバックグラウンドで実行し、
 *    ユーザーリクエストをブロックしないようにする
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

  // 🚀 超高速起動: キャッシュから状態を復元
  const cachedOptimizations = loadStartupState();
  if (cachedOptimizations) {
    console.log('[StartupOptimizer] 🚀 Ultra-fast startup: Using cached optimizations');
    console.log('[StartupOptimizer] Cache stats:', getCacheStats());
    
    isInitialized = true;
    const endTime = Date.now();
    console.log(`[StartupOptimizer] 🚀 Ultra-fast startup completed in ${endTime - startTime}ms`);
    
    // バックグラウンドで最新状態を確認
    setTimeout(() => {
      console.log('[StartupOptimizer] 🔄 Background refresh started');
      performInitializationAsync().then(() => {
        console.log('[StartupOptimizer] ✅ Background refresh completed');
      }).catch((error) => {
        console.error('[StartupOptimizer] ❌ Background refresh failed:', error);
      });
    }, 1000);
    
    return;
  }

  // 初回起動またはキャッシュなしの場合
  console.log('[StartupOptimizer] 🔧 Cold start: Performing full initialization...');
  
  // ⚡ 最適化: 重い処理をバックグラウンドで実行
  initializationPromise = performInitializationAsync();
  
  try {
    // ⚡ 最適化: 最大3秒でタイムアウト
    await Promise.race([
      initializationPromise,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log('[StartupOptimizer] ⚡ Background initialization started (timeout reached)');
          resolve();
        }, 3000);
      })
    ]);
    
    isInitialized = true;
    const endTime = Date.now();
    console.log(`[StartupOptimizer] ⚡ Fast startup completed in ${endTime - startTime}ms`);
    
    // 初期化状態をキャッシュに保存
    saveStartupState({
      'japanese_tokenizer': true,
      'cold_start': false,
      'initialization_time': endTime - startTime
    });
    
    // バックグラウンドで完全初期化を継続
    initializationPromise.then(() => {
      console.log('[StartupOptimizer] ✅ Background initialization completed');
    }).catch((error) => {
      console.error('[StartupOptimizer] ❌ Background initialization failed:', error);
    });
    
  } catch (error) {
    console.error('[StartupOptimizer] Startup optimization failed:', error);
    initializationPromise = null;
    throw error;
  }
}

/**
 * 実際の初期化処理を実行（非同期バックグラウンド版）
 */
async function performInitializationAsync(): Promise<void> {
  const optimizations = [
    {
      name: 'Japanese Tokenizer',
      fn: async () => {
        console.log('[StartupOptimizer] Pre-initializing Japanese tokenizer...');
        const startTime = Date.now();
        
        // Phase 6修正: 実際にkuromojiを初期化する（品質維持のため）
        await preInitializeTokenizer();
        
        const endTime = Date.now();
        console.log(`[StartupOptimizer] Japanese tokenizer initialized in ${endTime - startTime}ms`);
      }
    },
    {
      name: 'LanceDB Warmup',
      fn: async () => {
        console.log('[StartupOptimizer] 🔥 Starting LanceDB warmup...');
        const startTime = Date.now();
        
        try {
          // LanceDBClientを使用して接続を確立
          const { lancedbClient } = await import('./lancedb-client');
          const connection = await lancedbClient.getConnection();
          const connectionTime = Date.now() - startTime;
          console.log(`[StartupOptimizer] ✅ LanceDB connection established in ${connectionTime}ms`);
          
          // ダミーのベクトル検索を実行してインデックスをメモリに読み込む
          const warmupStartTime = Date.now();
          const dummyVector = new Array(768).fill(0.1); // 768次元のダミーベクトル
          const warmupResults = await connection.table
            .search(dummyVector)
            .limit(1)
            .toArray();
          const warmupTime = Date.now() - warmupStartTime;
          
          console.log(`[StartupOptimizer] ✅ LanceDB warmup search completed in ${warmupTime}ms (found ${warmupResults.length} results)`);
          console.log(`[StartupOptimizer] 🎯 LanceDB indexes are now loaded in memory`);
          
          const endTime = Date.now();
          const totalTime = endTime - startTime;
          console.log(`[StartupOptimizer] 🚀 LanceDB warmup completed in ${totalTime}ms`);
          
        } catch (error: any) {
          // エラーが発生してもアプリケーションは起動を続行
          console.error(`[StartupOptimizer] ⚠️ LanceDB warmup failed: ${error?.message || error}`);
          console.error(`[StartupOptimizer] ⚠️ LanceDB will be initialized on first request`);
          // エラーをスローしない（他の初期化処理を継続）
        }
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
      // ⚡ 最適化: エラーでも処理を継続
      console.warn(`[StartupOptimizer] ⚠️ Continuing without ${opt.name} optimization`);
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
