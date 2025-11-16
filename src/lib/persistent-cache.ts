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
 */
export function clearCache(): void {
  memoryCache.clear();
  
  try {
    if (fs.existsSync(TOKENIZER_CACHE_FILE)) {
      fs.unlinkSync(TOKENIZER_CACHE_FILE);
    }
    if (fs.existsSync(STARTUP_STATE_FILE)) {
      fs.unlinkSync(STARTUP_STATE_FILE);
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
  } catch (error) {
    // ファイルアクセスエラーは無視
  }
  
  return { memorySize, fileCount };
}
