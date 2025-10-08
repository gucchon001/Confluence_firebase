/**
 * ジェネリックLRUキャッシュ実装
 * 共通のキャッシュロジックを提供し、コード重複を削減
 */

export interface CacheOptions {
  /** TTL（Time To Live）- キャッシュの有効期限（ミリ秒） */
  ttl: number;
  /** 最大サイズ - キャッシュに保存できる最大エントリ数 */
  maxSize: number;
  /** 削除戦略 */
  evictionStrategy?: 'lru' | 'fifo' | 'lfu';
}

export interface CacheEntry<T> {
  /** キャッシュされた値 */
  value: T;
  /** タイムスタンプ（作成時刻） */
  timestamp: number;
  /** ヒット数 */
  hits: number;
}

export interface CacheStats {
  /** 現在のキャッシュサイズ */
  size: number;
  /** 平均ヒット数 */
  avgHits: number;
  /** ヒット率（ヒットされたエントリの割合） */
  hitRate: number;
}

/**
 * ジェネリックLRUキャッシュ
 * @template T キャッシュする値の型
 */
export class GenericCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private options: Required<CacheOptions>;
  
  constructor(options: CacheOptions) {
    this.options = {
      ...options,
      evictionStrategy: options.evictionStrategy || 'lru'
    };
  }
  
  /**
   * キャッシュから値を取得
   * @param key キー
   * @returns キャッシュされた値、またはnull
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // TTLチェック
    if (Date.now() - entry.timestamp > this.options.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    // ヒット数を増やす
    entry.hits++;
    
    return entry.value;
  }
  
  /**
   * キャッシュに値を設定
   * @param key キー
   * @param value 値
   */
  set(key: string, value: T): void {
    // サイズ制限チェック
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      this.evict();
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0
    });
  }
  
  /**
   * キャッシュから削除
   * @param key キー
   * @returns 削除に成功したかどうか
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * キャッシュに存在するか確認
   * @param key キー
   * @returns 存在するかどうか
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }
    
    // TTLチェック
    if (Date.now() - entry.timestamp > this.options.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * 削除戦略に応じてエントリを削除
   */
  private evict(): void {
    switch (this.options.evictionStrategy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'fifo':
        this.evictFIFO();
        break;
      case 'lfu':
        this.evictLFU();
        break;
    }
  }
  
  /**
   * LRU（Least Recently Used）削除
   * 最も古く、ヒット数が少ないエントリを削除
   */
  private evictLRU(): void {
    let oldestTime = Infinity;
    let oldestKey = '';
    
    for (const [key, entry] of this.cache.entries()) {
      // ヒット1回 = 1分の価値として計算
      const score = entry.timestamp + (entry.hits * 60000);
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }
  
  /**
   * FIFO（First In First Out）削除
   * 最も古いエントリを削除
   */
  private evictFIFO(): void {
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
    }
  }
  
  /**
   * LFU（Least Frequently Used）削除
   * 最も使用頻度が低いエントリを削除
   */
  private evictLFU(): void {
    let lowestHits = Infinity;
    let lfuKey = '';
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.hits < lowestHits) {
        lowestHits = entry.hits;
        lfuKey = key;
      }
    }
    
    if (lfuKey) {
      this.cache.delete(lfuKey);
    }
  }
  
  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * キャッシュ統計を取得
   * @returns キャッシュ統計
   */
  getStats(): CacheStats {
    let totalHits = 0;
    let entriesWithHits = 0;
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      if (entry.hits > 0) {
        entriesWithHits++;
      }
    }
    
    return {
      size: this.cache.size,
      avgHits: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      hitRate: this.cache.size > 0 ? entriesWithHits / this.cache.size : 0
    };
  }
  
  /**
   * 現在のキャッシュサイズを取得
   * @returns キャッシュサイズ
   */
  get size(): number {
    return this.cache.size;
  }
  
  /**
   * キャッシュの全エントリを取得（デバッグ用）
   * @returns エントリの配列
   */
  entries(): Array<[string, T]> {
    const result: Array<[string, T]> = [];
    for (const [key, entry] of this.cache.entries()) {
      result.push([key, entry.value]);
    }
    return result;
  }
}

/**
 * キャッシュファクトリー関数
 * @template T キャッシュする値の型
 * @param options キャッシュオプション
 * @returns GenericCacheインスタンス
 */
export function createCache<T>(options: CacheOptions): GenericCache<T> {
  return new GenericCache<T>(options);
}

