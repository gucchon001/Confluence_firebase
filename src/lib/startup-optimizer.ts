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
 * ⚡ 最適化: タイムアウトを追加して、長時間待機しないようにする
 */
export async function waitForInitialization(): Promise<void> {
  if (isInitialized) {
    return;
  }
  if (initializationPromise) {
    // ⚡ 最適化: 最大1秒でタイムアウト（ユーザーリクエストをブロックしない）
    // これにより、Lunrインデックスのロードなどの重い処理でブロックされない
    // 重い初期化処理はバックグラウンドで継続し、最初のリクエストは即座に処理を開始
    try {
      await Promise.race([
        initializationPromise,
        new Promise<void>((resolve) => {
          setTimeout(() => {
            console.log('[StartupOptimizer] waitForInitialization: Timeout reached (1s), continuing without waiting');
            console.log('[StartupOptimizer] Heavy initialization will continue in background');
            resolve();
          }, 1000); // 5秒 → 1秒に短縮（ユーザーリクエストをブロックしない）
        })
      ]);
    } catch (error) {
      // エラーが発生しても処理を継続（初期化エラーでアプリケーションを停止させない）
      console.warn('[StartupOptimizer] waitForInitialization: Error during initialization, continuing anyway:', error);
    }
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
    // ⚡ 最適化: 最大60秒でタイムアウト（Lunrインデックスのロードを待つ）
    // メモリ使用量が高い環境では初期化に時間がかかる可能性があるため、タイムアウトを延長
    // キャッシュからのロードは通常1-2秒で完了するが、メモリ不足時は遅延する可能性がある
    // 重い初期化処理（Lunrインデックスの再構築など）はバックグラウンドで継続
    await Promise.race([
      initializationPromise,
      new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log('[StartupOptimizer] ⚡ Background initialization started (timeout reached after 60s)');
          console.log('[StartupOptimizer] Heavy initialization (Lunr index rebuild, etc.) will continue in background');
          resolve();
        }, 60000); // 5秒 → 60秒に延長（メモリ使用量が高い環境に対応）
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
  // メモリ使用量の監視: 初期化開始時
  const { logMemoryUsage } = await import('./memory-monitor');
  logMemoryUsage('Application startup - initialization start');
  
  const optimizations = [
    {
      name: 'Japanese Tokenizer',
      fn: async () => {
        console.log('[StartupOptimizer] Pre-initializing Japanese tokenizer...');
        const startTime = Date.now();
        
        // ⚡ 最適化: 既に初期化されている場合はスキップ（重複初期化を防止）
        const { isTokenizerInitialized } = await import('./japanese-tokenizer');
        if (!isTokenizerInitialized()) {
          // Phase 6修正: 実際にkuromojiを初期化する（品質維持のため）
          await preInitializeTokenizer();
        } else {
          console.log('[StartupOptimizer] Tokenizer already initialized, skipping re-initialization');
        }
        
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
    },
    {
      name: 'Lunr Index Preload',
      fn: async () => {
        console.log('[StartupOptimizer] 🔥 Starting Lunr index preload...');
        const startTime = Date.now();
        
        try {
          // Lunrインデックスをバックグラウンドでロード
          const { lunrInitializer } = await import('./lunr-initializer');
          
          // テーブル存在確認を事前に行う（存在しないテーブルの初期化をスキップ）
          const path = await import('path');
          const dbPath = path.resolve(process.cwd(), '.lancedb');
          const lancedb = await import('@lancedb/lancedb');
          const db = await lancedb.connect(dbPath);
          const availableTables = await db.tableNames();
          console.log(`[StartupOptimizer] Available LanceDB tables: ${availableTables.join(', ')}`);
          
          // ⚡ 最適化: メモリ使用量を最小化するため、すべてのテーブルをオンデマンド初期化に統一
          // 起動時にはテーブルを初期化せず、検索リクエストが来た時にオンデマンドで初期化される
          // これにより、起動時のメモリ使用量を最小化し、メモリ制限エラーを回避できる
          // 初回検索は遅くなる可能性があるが、2回目以降は高速（既に初期化済み）
          const allTables = availableTables.filter(name => name === 'confluence' || name === 'jira_issues');
          
          console.log(`[StartupOptimizer] ⚡ All tables will be initialized on-demand to minimize memory usage`);
          console.log(`[StartupOptimizer] Available tables: ${allTables.join(', ')}`);
          console.log(`[StartupOptimizer] Tables will be initialized when first search request comes for each table`);
          
          // 起動時には初期化しない（オンデマンド初期化）
          // 検索リクエストが来た時に、必要なテーブルが自動的に初期化される
          
          const endTime = Date.now();
          const totalTime = endTime - startTime;
          console.log(`[StartupOptimizer] 🚀 Lunr index preload completed in ${totalTime}ms`);
          
        } catch (error: any) {
          // エラーが発生してもアプリケーションは起動を続行
          console.error(`[StartupOptimizer] ⚠️ Lunr index preload failed: ${error?.message || error}`);
          console.error(`[StartupOptimizer] ⚠️ Lunr index will be initialized on first request`);
          // エラーをスローしない（他の初期化処理を継続）
        }
      }
    }
  ];

  // ⚡ 最適化: Lunrインデックスの事前ロードを優先的に実行（検索パフォーマンス向上のため）
  // 1. Lunrインデックスの事前ロードを最初に実行（検索に必要）
  // 2. その他の初期化処理（トークナイザー、LanceDB）を並列実行
  
  const lunrOptimization = optimizations.find(opt => opt.name === 'Lunr Index Preload');
  const otherOptimizations = optimizations.filter(opt => opt.name !== 'Lunr Index Preload');
  
  // Lunrインデックスの事前ロードを優先的に実行
  if (lunrOptimization) {
    try {
      console.log(`[StartupOptimizer] 🚀 Priority: Starting ${lunrOptimization.name} first...`);
      await lunrOptimization.fn();
      console.log(`[StartupOptimizer] ✅ ${lunrOptimization.name} initialization completed`);
    } catch (error) {
      console.error(`[StartupOptimizer] ❌ ${lunrOptimization.name} initialization failed:`, error);
      console.warn(`[StartupOptimizer] ⚠️ Continuing without ${lunrOptimization.name} optimization`);
    }
  }
  
  // その他の初期化処理を並列実行
  const otherPromises = otherOptimizations.map(async (opt) => {
    try {
      await opt.fn();
      console.log(`[StartupOptimizer] ✅ ${opt.name} initialization completed`);
    } catch (error) {
      console.error(`[StartupOptimizer] ❌ ${opt.name} initialization failed:`, error);
      // ⚡ 最適化: エラーでも処理を継続
      console.warn(`[StartupOptimizer] ⚠️ Continuing without ${opt.name} optimization`);
    }
  });

  await Promise.all(otherPromises);
  
  // メモリ使用量の監視: 初期化完了時
  logMemoryUsage('Application startup - initialization complete');
  
  isInitialized = true;
  console.log('[StartupOptimizer] ✅ All initialization completed');
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
