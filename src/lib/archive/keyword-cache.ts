/**
 * キーワード抽出キャッシュサービス
 * 同一クエリのキーワード抽出結果をキャッシュし、重複処理を防止
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

interface CachedKeywordResult {
  keywords: string[];
  timestamp: number;
  queryHash: string;
  queryLength: number;
}

interface KeywordCacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  cacheSize: number;
  lastCleanup: number;
}

export class KeywordCache {
  private static instance: KeywordCache;
  private cache: Map<string, CachedKeywordResult> = new Map();
  private stats: KeywordCacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    cacheSize: 0,
    lastCleanup: Date.now()
  };
  
  private readonly CACHE_DIR = '.cache';
  private readonly CACHE_FILE = 'keyword-cache.json';
  private readonly MAX_CACHE_SIZE = 500; // 最大キャッシュ数
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1時間

  private constructor() {
    this.initializeCache();
  }

  public static getInstance(): KeywordCache {
    if (!KeywordCache.instance) {
      KeywordCache.instance = new KeywordCache();
    }
    return KeywordCache.instance;
  }

  /**
   * キャッシュを初期化（ディスクから読み込み）
   */
  private async initializeCache(): Promise<void> {
    try {
      const cachePath = path.join(this.CACHE_DIR, this.CACHE_FILE);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cacheData = JSON.parse(data);
      
      // キャッシュデータを復元
      this.cache = new Map(cacheData.cache || []);
      this.stats = { ...this.stats, ...cacheData.stats };
      
      console.log(`[KeywordCache] Loaded ${this.cache.size} cached keyword extractions from disk`);
      
      // 期限切れキャッシュのクリーンアップ
      await this.cleanupExpiredCache();
      
    } catch (error) {
      console.log('[KeywordCache] No existing cache found, starting fresh');
    }
  }

  /**
   * クエリのハッシュを生成
   */
  private generateQueryHash(query: string): string {
    return crypto.createHash('sha256').update(query.trim().toLowerCase()).digest('hex');
  }

  /**
   * キャッシュキーを生成
   */
  private generateCacheKey(query: string): string {
    return this.generateQueryHash(query);
  }

  /**
   * キーワード抽出結果をキャッシュから取得
   */
  public async getCachedKeywords(query: string): Promise<string[] | null> {
    const cacheKey = this.generateCacheKey(query);
    const cached = this.cache.get(cacheKey);
    
    this.stats.totalRequests++;
    
    if (!cached) {
      this.stats.misses++;
      console.log(`[KeywordCache] Cache miss for query: "${query.substring(0, 30)}..."`);
      return null;
    }
    
    // TTLチェック
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      this.stats.misses++;
      console.log(`[KeywordCache] Cache expired for query: "${query.substring(0, 30)}..."`);
      return null;
    }
    
    this.stats.hits++;
    console.log(`[KeywordCache] Cache hit for query: "${query.substring(0, 30)}..."`);
    return cached.keywords;
  }

  /**
   * キーワード抽出結果をキャッシュに保存
   */
  public async setCachedKeywords(query: string, keywords: string[]): Promise<void> {
    const cacheKey = this.generateCacheKey(query);
    const queryHash = this.generateQueryHash(query);
    
    const cachedResult: CachedKeywordResult = {
      keywords: [...keywords], // コピーを作成
      timestamp: Date.now(),
      queryHash,
      queryLength: query.length
    };
    
    this.cache.set(cacheKey, cachedResult);
    this.stats.cacheSize = this.cache.size;
    
    console.log(`[KeywordCache] Cached keywords for query: "${query.substring(0, 30)}..." (${keywords.length} keywords)`);
    
    // キャッシュサイズが上限に達した場合はクリーンアップ
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      await this.cleanupOldCache();
    }
    
    // 定期的なクリーンアップ
    if (Date.now() - this.stats.lastCleanup > this.CLEANUP_INTERVAL) {
      await this.cleanupExpiredCache();
    }
  }

  /**
   * 期限切れキャッシュのクリーンアップ
   */
  private async cleanupExpiredCache(): Promise<void> {
    const now = Date.now();
    let removedCount = 0;
    
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
        removedCount++;
      }
    }
    
    if (removedCount > 0) {
      console.log(`[KeywordCache] Cleaned up ${removedCount} expired cache entries`);
      this.stats.cacheSize = this.cache.size;
    }
    
    this.stats.lastCleanup = now;
  }

  /**
   * 古いキャッシュのクリーンアップ（LRU方式）
   */
  private async cleanupOldCache(): Promise<void> {
    const entries = Array.from(this.cache.entries());
    
    // タイムスタンプでソート（古い順）
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // 上位25%を削除
    const removeCount = Math.floor(entries.length * 0.25);
    const toRemove = entries.slice(0, removeCount);
    
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
    
    console.log(`[KeywordCache] Removed ${removeCount} old cache entries (LRU cleanup)`);
    this.stats.cacheSize = this.cache.size;
  }

  /**
   * キャッシュをディスクに保存
   */
  public async saveCacheToDisk(): Promise<void> {
    try {
      await fs.mkdir(this.CACHE_DIR, { recursive: true });
      const cachePath = path.join(this.CACHE_DIR, this.CACHE_FILE);
      
      const cacheData = {
        cache: Array.from(this.cache.entries()),
        stats: this.stats,
        timestamp: Date.now()
      };
      
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
      // ログ出力を削除（頻繁な保存を避けるため）
      
    } catch (error) {
      console.error('[KeywordCache] Failed to save cache to disk:', error);
    }
  }

  /**
   * キャッシュ統計を取得
   */
  public getStats(): KeywordCacheStats & { hitRate: number } {
    const hitRate = this.stats.totalRequests > 0 
      ? (this.stats.hits / this.stats.totalRequests) * 100 
      : 0;
    
    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(2))
    };
  }

  /**
   * キャッシュをクリア
   */
  public clearCache(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      cacheSize: 0,
      lastCleanup: Date.now()
    };
    console.log('[KeywordCache] Cache cleared');
  }

  /**
   * 類似クエリの検索（部分一致）
   */
  public findSimilarCachedKeywords(query: string, threshold: number = 0.8): CachedKeywordResult[] {
    const queryHash = this.generateQueryHash(query);
    const similar: CachedKeywordResult[] = [];
    
    for (const cached of this.cache.values()) {
      if (cached.queryHash === queryHash) {
        similar.push(cached);
      }
    }
    
    return similar;
  }
}

// シングルトンインスタンスをエクスポート
export const keywordCache = KeywordCache.getInstance();

// アプリケーション終了時にキャッシュを保存（重複防止）
let isSaving = false;

process.on('beforeExit', async () => {
  if (!isSaving) {
    isSaving = true;
    await keywordCache.saveCacheToDisk();
  }
});

process.on('SIGINT', async () => {
  if (!isSaving) {
    isSaving = true;
    await keywordCache.saveCacheToDisk();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (!isSaving) {
    isSaving = true;
    await keywordCache.saveCacheToDisk();
  }
  process.exit(0);
});
