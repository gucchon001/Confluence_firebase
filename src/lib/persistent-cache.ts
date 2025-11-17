/**
 * 永続化キャッシュシステム
 * サーバー再起動後もキャッシュを維持し、起動時間を大幅短縮
 */

import * as fs from 'fs';
import * as path from 'path';

// キャッシュディレクトリ
const CACHE_DIR = path.join(process.cwd(), '.cache');
const TOKENIZER_CACHE_FILE = path.join(CACHE_DIR, 'tokenizer-cache.json');
const STARTUP_STATE_FILE = path.join(CACHE_DIR, 'startup-state.json');

// メモリキャッシュ
const memoryCache = new Map<string, any>();

/**
 * キャッシュディレクトリを初期化
 */
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    console.log('[PersistentCache] Cache directory created:', CACHE_DIR);
  }
}

/**
 * トークナイザーの初期化状態をキャッシュに保存
 */
export function saveTokenizerState(isInitialized: boolean, initTime?: number): void {
  try {
    ensureCacheDir();
    
    const state = {
      isInitialized,
      initTime: initTime || Date.now(),
      version: '1.0',
      timestamp: new Date().toISOString()
    };
    
    fs.writeFileSync(TOKENIZER_CACHE_FILE, JSON.stringify(state, null, 2));
    memoryCache.set('tokenizer_state', state);
    
    console.log('[PersistentCache] ✅ Tokenizer state cached:', {
      isInitialized,
      initTime: state.initTime,
      age: Date.now() - state.initTime
    });
  } catch (error) {
    console.error('[PersistentCache] Failed to save tokenizer state:', error);
  }
}

/**
 * トークナイザーの初期化状態をキャッシュから復元
 */
export function loadTokenizerState(): { isInitialized: boolean; initTime: number } | null {
  try {
    // メモリキャッシュを優先
    const memoryState = memoryCache.get('tokenizer_state');
    if (memoryState) {
      console.log('[PersistentCache] ✅ Tokenizer state loaded from memory cache');
      return memoryState;
    }
    
    // ファイルキャッシュを確認
    if (fs.existsSync(TOKENIZER_CACHE_FILE)) {
      const data = fs.readFileSync(TOKENIZER_CACHE_FILE, 'utf8');
      const state = JSON.parse(data);
      
      // キャッシュの有効期限チェック（24時間）
      const cacheAge = Date.now() - state.initTime;
      const maxAge = 24 * 60 * 60 * 1000; // 24時間
      
      if (cacheAge < maxAge) {
        memoryCache.set('tokenizer_state', state);
        console.log('[PersistentCache] ✅ Tokenizer state loaded from file cache:', {
          isInitialized: state.isInitialized,
          age: `${Math.round(cacheAge / 1000)}s`
        });
        return state;
      } else {
        console.log('[PersistentCache] ⚠️ Tokenizer cache expired, removing');
        fs.unlinkSync(TOKENIZER_CACHE_FILE);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[PersistentCache] Failed to load tokenizer state:', error);
    return null;
  }
}

/**
 * 起動最適化状態をキャッシュに保存
 */
export function saveStartupState(optimizations: Record<string, boolean | number>): void {
  try {
    ensureCacheDir();
    
    const state = {
      optimizations,
      timestamp: Date.now(),
      version: '1.0'
    };
    
    fs.writeFileSync(STARTUP_STATE_FILE, JSON.stringify(state, null, 2));
    memoryCache.set('startup_state', state);
    
    console.log('[PersistentCache] ✅ Startup state cached:', optimizations);
  } catch (error) {
    console.error('[PersistentCache] Failed to save startup state:', error);
  }
}

/**
 * 起動最適化状態をキャッシュから復元
 */
export function loadStartupState(): Record<string, boolean> | null {
  try {
    // メモリキャッシュを優先
    const memoryState = memoryCache.get('startup_state');
    if (memoryState) {
      return memoryState.optimizations;
    }
    
    // ファイルキャッシュを確認
    if (fs.existsSync(STARTUP_STATE_FILE)) {
      const data = fs.readFileSync(STARTUP_STATE_FILE, 'utf8');
      const state = JSON.parse(data);
      
      // キャッシュの有効期限チェック（12時間）
      const cacheAge = Date.now() - state.timestamp;
      const maxAge = 12 * 60 * 60 * 1000; // 12時間
      
      if (cacheAge < maxAge) {
        memoryCache.set('startup_state', state);
        console.log('[PersistentCache] ✅ Startup state loaded from cache');
        return state.optimizations;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[PersistentCache] Failed to load startup state:', error);
    return null;
  }
}

/**
 * キャッシュのクリア
 * @param clearFiles - trueの場合、キャッシュファイルも削除（デフォルト: true）
 *                     falseの場合、メモリ状態のみクリア（キャッシュファイルは保持）
 */
export function clearCache(clearFiles: boolean = true): void {
  memoryCache.clear();
  
  try {
    // トークナイザーとスタートアップ状態のキャッシュをクリア
    if (fs.existsSync(TOKENIZER_CACHE_FILE)) {
      fs.unlinkSync(TOKENIZER_CACHE_FILE);
    }
    if (fs.existsSync(STARTUP_STATE_FILE)) {
      fs.unlinkSync(STARTUP_STATE_FILE);
    }
    
    // キャッシュファイルのクリア（オプション）
    if (clearFiles) {
      // Lunrインデックスのキャッシュファイルをクリア
      // 環境に応じたキャッシュパスを決定
      const { appConfig } = require('../config/app-config');
      const isCloudRun = appConfig.deployment.isCloudRun;
      const cacheDir = isCloudRun 
        ? path.join(process.cwd(), '.next', 'standalone', '.cache')
        : path.join(process.cwd(), '.cache');
      
      // ConfluenceとJiraの両方のLunrインデックスキャッシュをクリア
      // .json と .msgpack の両方の形式をサポート
      const lunrCacheFiles = [
        path.join(cacheDir, 'lunr-index.json'), // Confluence (JSON)
        path.join(cacheDir, 'lunr-index.msgpack'), // Confluence (MessagePack)
        path.join(cacheDir, 'lunr-index-jira_issues.json'), // Jira (JSON)
        path.join(cacheDir, 'lunr-index-jira_issues.msgpack'), // Jira (MessagePack)
      ];
      
      for (const cacheFile of lunrCacheFiles) {
        if (fs.existsSync(cacheFile)) {
          fs.unlinkSync(cacheFile);
          console.log(`[PersistentCache] Deleted Lunr cache: ${cacheFile}`);
        }
      }
      
      // keyword-cache.json もクリア
      const keywordCacheFile = path.join(cacheDir, 'keyword-cache.json');
      if (fs.existsSync(keywordCacheFile)) {
        fs.unlinkSync(keywordCacheFile);
        console.log(`[PersistentCache] Deleted keyword cache: ${keywordCacheFile}`);
      }
    } else {
      console.log('[PersistentCache] Cache files preserved (only memory state cleared)');
    }
    
    // ⚡ 最適化: clearFiles=trueの場合のみ、メモリキャッシュもクリア
    // clearFiles=falseの場合は、キャッシュファイルが存在するため、メモリ状態も保持して
    // 次回の初期化時にキャッシュから高速にロードできるようにする
    if (clearFiles) {
      // キャッシュファイルを削除した場合のみ、メモリキャッシュもクリア
      try {
        const { lunrSearchClient } = require('./lunr-search-client');
        if (lunrSearchClient && typeof lunrSearchClient.destroy === 'function') {
          lunrSearchClient.destroy(); // すべてのテーブルのインデックスをクリア
          console.log('[PersistentCache] Cleared LunrSearchClient memory cache');
        }
        
        // LunrInitializerの初期化状態もリセット
        const { lunrInitializer } = require('./lunr-initializer');
        if (lunrInitializer && typeof lunrInitializer.reset === 'function') {
          lunrInitializer.reset();
          console.log('[PersistentCache] Reset LunrInitializer state');
        }
      } catch (lunrError) {
        // LunrSearchClient/LunrInitializerのクリアに失敗しても続行
        console.warn('[PersistentCache] Failed to clear Lunr caches:', lunrError);
      }
    } else {
      // clearFiles=falseの場合: キャッシュファイルは保持されるため、
      // メモリ状態も保持して、次回の初期化時にキャッシュから高速にロードできるようにする
      console.log('[PersistentCache] Memory cache preserved (cache files exist, will be reused on next initialization)');
    }
    
    console.log('[PersistentCache] All caches cleared');
  } catch (error) {
    console.error('[PersistentCache] Failed to clear file caches:', error);
  }
}

/**
 * キャッシュ統計情報を取得
 */
export function getCacheStats(): { memorySize: number; fileCount: number } {
  const memorySize = memoryCache.size;
  let fileCount = 0;
  
  try {
    if (fs.existsSync(TOKENIZER_CACHE_FILE)) fileCount++;
    if (fs.existsSync(STARTUP_STATE_FILE)) fileCount++;
    
    // Lunrインデックスのキャッシュファイルもカウント
    const { appConfig } = require('../config/app-config');
    const isCloudRun = appConfig.deployment.isCloudRun;
    const cacheDir = isCloudRun 
      ? path.join(process.cwd(), '.next', 'standalone', '.cache')
      : path.join(process.cwd(), '.cache');
    
    const lunrCacheFiles = [
      path.join(cacheDir, 'lunr-index.json'),
      path.join(cacheDir, 'lunr-index.msgpack'),
      path.join(cacheDir, 'lunr-index-jira_issues.json'),
      path.join(cacheDir, 'lunr-index-jira_issues.msgpack'),
    ];
    
    for (const cacheFile of lunrCacheFiles) {
      if (fs.existsSync(cacheFile)) fileCount++;
    }
    
    // keyword-cache.json もカウント
    const keywordCacheFile = path.join(cacheDir, 'keyword-cache.json');
    if (fs.existsSync(keywordCacheFile)) fileCount++;
  } catch (error) {
    // ファイルアクセスエラーは無視
  }
  
  return { memorySize, fileCount };
}
