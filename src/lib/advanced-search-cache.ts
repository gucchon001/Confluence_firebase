/**
 * 高度な検索キャッシュシステム
 * 複数レイヤーのキャッシュ戦略でパフォーマンスを大幅改善
 */

interface CacheEntry {
  results: any[];
  timestamp: number;
  ttl: number;
  hitCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  memoryUsage: number;
}

export class AdvancedSearchCache {
  private static instance: AdvancedSearchCache;
  private cache: Map<string, CacheEntry> = new Map();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    size: 0,
    memoryUsage: 0
  };

  // キャッシュ設定
  private readonly MAX_SIZE = 1000; // 最大キャッシュエントリ数
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5分
  private readonly MEMORY_LIMIT = 100 * 1024 * 1024; // 100MB
  private readonly CLEANUP_INTERVAL = 60 * 1000; // 1分

  private cleanupTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startCleanupTimer();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): AdvancedSearchCache {
    if (!AdvancedSearchCache.instance) {
      AdvancedSearchCache.instance = new AdvancedSearchCache();
    }
    return AdvancedSearchCache.instance;
  }

  /**
   * 高度なキャッシュキー生成
   */
  private generateAdvancedCacheKey(query: string, params: any): string {
    // クエリの正規化
    const normalizedQuery = query.toLowerCase().trim();
    
    // パラメータの正規化
    const normalizedParams = {
      topK: params.topK || 10,
      labelFilters: params.labelFilters || { includeMeetingNotes: false },
      excludeTitlePatterns: params.excludeTitlePatterns || ['xxx_*'],
      useLunrIndex: params.useLunrIndex || false
    };

    // ハッシュ化
    const paramString = JSON.stringify(normalizedParams);
    const hash = this.simpleHash(normalizedQuery + paramString);
    
    return `${normalizedQuery}_${hash}`;
  }

  /**
   * シンプルなハッシュ関数
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * キャッシュから結果を取得
   */
  public get(query: string, params: any): any[] | null {
    const cacheKey = this.generateAdvancedCacheKey(query, params);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // TTLチェック
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(cacheKey);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // ヒット統計更新
    entry.hitCount++;
    entry.lastAccessed = now;
    this.stats.hits++;

    console.log(`🎯 Advanced cache hit: "${query}" (${entry.hitCount} hits)`);
    return entry.results;
  }

  /**
   * キャッシュに結果を保存
   */
  public set(query: string, params: any, results: any[]): void {
    const cacheKey = this.generateAdvancedCacheKey(query, params);
    const now = Date.now();

    // メモリ使用量チェック
    if (this.getMemoryUsage() > this.MEMORY_LIMIT) {
      this.evictOldEntries();
    }

    // サイズ制限チェック
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLeastUsed();
    }

    const entry: CacheEntry = {
      results: [...results], // ディープコピー
      timestamp: now,
      ttl: params.ttl || this.DEFAULT_TTL,
      hitCount: 0,
      lastAccessed: now
    };

    this.cache.set(cacheKey, entry);
    this.stats.size = this.cache.size;

    console.log(`💾 Advanced cache set: "${query}" (${results.length} results)`);
  }

  /**
   * 古いエントリを削除
   */
  private evictOldEntries(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        entriesToDelete.push(key);
      }
    }

    entriesToDelete.forEach(key => {
      this.cache.delete(key);
      this.stats.evictions++;
    });

    if (entriesToDelete.length > 0) {
      console.log(`🧹 Evicted ${entriesToDelete.length} expired cache entries`);
    }
  }

  /**
   * 使用頻度の低いエントリを削除
   */
  private evictLeastUsed(): void {
    let leastUsedKey = '';
    let leastUsedCount = Infinity;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      // ヒット数が少ない、または最も古いものを選択
      if (entry.hitCount < leastUsedCount || 
          (entry.hitCount === leastUsedCount && entry.lastAccessed < oldestTime)) {
        leastUsedKey = key;
        leastUsedCount = entry.hitCount;
        oldestTime = entry.lastAccessed;
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey);
      this.stats.evictions++;
      console.log(`🗑️ Evicted least used cache entry: ${leastUsedKey}`);
    }
  }

  /**
   * メモリ使用量を計算
   */
  private getMemoryUsage(): number {
    let totalSize = 0;
    for (const [key, entry] of this.cache.entries()) {
      totalSize += key.length * 2; // 文字列のメモリ使用量（UTF-16）
      totalSize += JSON.stringify(entry.results).length * 2;
    }
    return totalSize;
  }

  /**
   * クリーンアップタイマーを開始
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.evictOldEntries();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * クリーンアップタイマーを停止
   */
  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * キャッシュをクリア
   */
  public clear(): void {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      size: 0,
      memoryUsage: 0
    };
    console.log('🧹 Advanced cache cleared');
  }

  /**
   * キャッシュ統計を取得
   */
  public getStats(): CacheStats & { hitRate: number; memoryUsageMB: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    const memoryUsageMB = this.getMemoryUsage() / (1024 * 1024);

    return {
      ...this.stats,
      hitRate: Number(hitRate.toFixed(2)),
      memoryUsageMB: Number(memoryUsageMB.toFixed(2))
    };
  }

  /**
   * キャッシュの健全性をチェック
   */
  public getHealth(): {
    isHealthy: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const stats = this.getStats();

    // ヒット率チェック
    if (stats.hitRate < 50) {
      issues.push(`Low cache hit rate: ${stats.hitRate}%`);
      recommendations.push('Consider increasing cache TTL or improving cache key generation');
    }

    // メモリ使用量チェック
    if (stats.memoryUsageMB > 50) {
      issues.push(`High memory usage: ${stats.memoryUsageMB}MB`);
      recommendations.push('Consider reducing cache size or implementing more aggressive eviction');
    }

    // エビクション率チェック
    const evictionRate = stats.evictions / (stats.hits + stats.misses);
    if (evictionRate > 0.1) {
      issues.push(`High eviction rate: ${(evictionRate * 100).toFixed(2)}%`);
      recommendations.push('Consider increasing cache size or TTL');
    }

    return {
      isHealthy: issues.length === 0,
      issues,
      recommendations
    };
  }
}

// シングルトンインスタンス
export const advancedSearchCache = AdvancedSearchCache.getInstance();

