/**
 * Phase 0A-4: LanceDB検索結果のメモリキャッシュ
 * 
 * 目的: enrichWithAllChunks の31秒を大幅削減
 * 
 * 戦略:
 * 1. チャンクデータをメモリキャッシュ（最大500MB）
 * 2. 検索結果をメモリキャッシュ（TTL: 5分）
 * 3. LRU方式で古いデータを自動削除
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  size: number; // bytes
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  totalSize: number;
  entryCount: number;
}

export class LanceDBCache {
  private static instance: LanceDBCache;
  
  // チャンクキャッシュ: pageId → chunks[]
  private chunkCache: Map<string, CacheEntry<any[]>> = new Map();
  
  // 検索結果キャッシュ: queryHash → results[]
  private searchCache: Map<string, CacheEntry<any[]>> = new Map();
  
  // 統計情報
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSize: 0,
    entryCount: 0
  };
  
  private readonly config = {
    maxCacheSize: 500 * 1024 * 1024, // 500MB
    chunkTTL: 30 * 60 * 1000, // 30分
    searchTTL: 5 * 60 * 1000, // 5分
  };

  private constructor() {
    // 定期的なクリーンアップ（5分ごと）
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  public static getInstance(): LanceDBCache {
    if (!LanceDBCache.instance) {
      LanceDBCache.instance = new LanceDBCache();
    }
    return LanceDBCache.instance;
  }

  /**
   * チャンクデータの取得（キャッシュ優先）
   */
  public getChunks(pageId: string): any[] | null {
    const entry = this.chunkCache.get(pageId);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // TTLチェック
    const age = Date.now() - entry.timestamp;
    if (age > this.config.chunkTTL) {
      this.chunkCache.delete(pageId);
      this.stats.totalSize -= entry.size;
      this.stats.entryCount--;
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.data;
  }

  /**
   * チャンクデータの保存
   */
  public setChunks(pageId: string, chunks: any[]): void {
    const size = this.estimateSize(chunks);
    
    // キャッシュサイズ制限チェック
    if (this.stats.totalSize + size > this.config.maxCacheSize) {
      this.evictOldest();
    }
    
    this.chunkCache.set(pageId, {
      data: chunks,
      timestamp: Date.now(),
      size
    });
    
    this.stats.totalSize += size;
    this.stats.entryCount++;
    
    // メモリ使用量の監視: キャッシュサイズが大きい場合（非同期で実行、エラーは無視）
    if (this.stats.totalSize > this.config.maxCacheSize * 0.8) {
      import('./memory-monitor').then(({ logMemoryUsage }) => {
        logMemoryUsage(`Chunk cache size warning (${(this.stats.totalSize / 1024 / 1024).toFixed(2)}MB / ${(this.config.maxCacheSize / 1024 / 1024).toFixed(2)}MB)`);
      }).catch(() => {
        // エラーは無視（メモリ監視の失敗でキャッシュ処理を止めない）
      });
    }
  }

  /**
   * 検索結果の取得（キャッシュ優先）
   */
  public getSearchResults(queryHash: string): any[] | null {
    const entry = this.searchCache.get(queryHash);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    const age = Date.now() - entry.timestamp;
    if (age > this.config.searchTTL) {
      this.searchCache.delete(queryHash);
      this.stats.totalSize -= entry.size;
      this.stats.entryCount--;
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.data;
  }

  /**
   * 検索結果の保存
   */
  public setSearchResults(queryHash: string, results: any[]): void {
    const size = this.estimateSize(results);
    
    if (this.stats.totalSize + size > this.config.maxCacheSize) {
      this.evictOldest();
    }
    
    this.searchCache.set(queryHash, {
      data: results,
      timestamp: Date.now(),
      size
    });
    
    this.stats.totalSize += size;
    this.stats.entryCount++;
  }

  /**
   * クエリハッシュの生成
   */
  public hashQuery(query: string, filters?: any): string {
    const str = JSON.stringify({ query, filters });
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `q_${hash}`;
  }

  /**
   * 最も古いエントリを削除
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    let oldestCache: 'chunk' | 'search' = 'chunk';
    
    // チャンクキャッシュから最古を探す
    for (const [key, entry] of this.chunkCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
        oldestCache = 'chunk';
      }
    }
    
    // 検索キャッシュから最古を探す
    for (const [key, entry] of this.searchCache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
        oldestCache = 'search';
      }
    }
    
    if (oldestKey) {
      if (oldestCache === 'chunk') {
        const entry = this.chunkCache.get(oldestKey);
        if (entry) {
          this.stats.totalSize -= entry.size;
          this.stats.entryCount--;
          this.chunkCache.delete(oldestKey);
        }
      } else {
        const entry = this.searchCache.get(oldestKey);
        if (entry) {
          this.stats.totalSize -= entry.size;
          this.stats.entryCount--;
          this.searchCache.delete(oldestKey);
        }
      }
      this.stats.evictions++;
    }
  }

  /**
   * 期限切れエントリのクリーンアップ
   */
  private cleanup(): void {
    const now = Date.now();
    
    // チャンクキャッシュのクリーンアップ
    for (const [key, entry] of this.chunkCache) {
      if (now - entry.timestamp > this.config.chunkTTL) {
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        this.chunkCache.delete(key);
      }
    }
    
    // 検索キャッシュのクリーンアップ
    for (const [key, entry] of this.searchCache) {
      if (now - entry.timestamp > this.config.searchTTL) {
        this.stats.totalSize -= entry.size;
        this.stats.entryCount--;
        this.searchCache.delete(key);
      }
    }
  }

  /**
   * データサイズの推定
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 1024; // デフォルト1KB
    }
  }

  /**
   * キャッシュ統計の取得
   */
  public getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * キャッシュのクリア
   */
  public clear(): void {
    this.chunkCache.clear();
    this.searchCache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalSize: 0,
      entryCount: 0
    };
  }
}

// シングルトンインスタンスのエクスポート
export const getLanceDBCache = () => LanceDBCache.getInstance();

