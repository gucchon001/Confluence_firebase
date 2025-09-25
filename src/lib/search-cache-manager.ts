/**
 * 検索キャッシュマネージャー
 * 検索結果、埋め込みベクトル、キーワード抽出結果をキャッシュ
 */

import { createHash } from 'crypto';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export interface SearchCacheOptions {
  maxSize?: number;
  defaultTtl?: number; // Default TTL in milliseconds
  enableLogging?: boolean;
}

export class SearchCacheManager {
  private static instance: SearchCacheManager;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private options: Required<SearchCacheOptions>;

  private constructor(options: SearchCacheOptions = {}) {
    this.options = {
      maxSize: options.maxSize || 1000,
      defaultTtl: options.defaultTtl || 5 * 60 * 1000, // 5 minutes
      enableLogging: options.enableLogging || false
    };
  }

  static getInstance(options?: SearchCacheOptions): SearchCacheManager {
    if (!SearchCacheManager.instance) {
      SearchCacheManager.instance = new SearchCacheManager(options);
    }
    return SearchCacheManager.instance;
  }

  /**
   * キャッシュキーを生成
   */
  private generateKey(prefix: string, data: any): string {
    const hash = createHash('md5').update(JSON.stringify(data)).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * キャッシュからデータを取得
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      if (this.options.enableLogging) {
        console.log(`[SearchCache] Cache miss: ${key}`);
      }
      return null;
    }

    // TTLチェック
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      if (this.options.enableLogging) {
        console.log(`[SearchCache] Cache expired: ${key}`);
      }
      return null;
    }

    if (this.options.enableLogging) {
      console.log(`[SearchCache] Cache hit: ${key}`);
    }
    return entry.data;
  }

  /**
   * キャッシュにデータを保存
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // キャッシュサイズ制限
    if (this.cache.size >= this.options.maxSize) {
      this.evictOldest();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.options.defaultTtl
    };

    this.cache.set(key, entry);
    
    if (this.options.enableLogging) {
      console.log(`[SearchCache] Cache set: ${key} (TTL: ${entry.ttl}ms)`);
    }
  }

  /**
   * 検索結果をキャッシュ
   */
  cacheSearchResults(query: string, params: any, results: any[], ttl?: number): void {
    const key = this.generateKey('search', { query, params });
    this.set(key, results, ttl);
  }

  /**
   * 検索結果をキャッシュから取得
   */
  getSearchResults(query: string, params: any): any[] | null {
    const key = this.generateKey('search', { query, params });
    return this.get(key);
  }

  /**
   * 埋め込みベクトルをキャッシュ
   */
  cacheEmbedding(text: string, embedding: number[], ttl?: number): void {
    const key = this.generateKey('embedding', { text });
    this.set(key, embedding, ttl);
  }

  /**
   * 埋め込みベクトルをキャッシュから取得
   */
  getEmbedding(text: string): number[] | null {
    const key = this.generateKey('embedding', { text });
    return this.get(key);
  }

  /**
   * キーワード抽出結果をキャッシュ
   */
  cacheKeywords(query: string, keywords: string[], ttl?: number): void {
    const key = this.generateKey('keywords', { query });
    this.set(key, keywords, ttl);
  }

  /**
   * キーワード抽出結果をキャッシュから取得
   */
  getKeywords(query: string): string[] | null {
    const key = this.generateKey('keywords', { query });
    return this.get(key);
  }

  /**
   * 最も古いエントリを削除
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      if (this.options.enableLogging) {
        console.log(`[SearchCache] Evicted: ${oldestKey}`);
      }
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    if (this.options.enableLogging) {
      console.log('[SearchCache] Cache cleared');
    }
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl
    }));

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: 0, // TODO: 実装
      entries
    };
  }

  /**
   * 期限切れのエントリをクリーンアップ
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (this.options.enableLogging && cleaned > 0) {
      console.log(`[SearchCache] Cleaned up ${cleaned} expired entries`);
    }

    return cleaned;
  }
}

// シングルトンインスタンス
export const searchCacheManager = SearchCacheManager.getInstance({
  maxSize: 1000,
  defaultTtl: 5 * 60 * 1000, // 5 minutes
  enableLogging: true
});
