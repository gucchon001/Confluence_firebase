/**
 * 埋め込みベクトルキャッシュサービス
 * 同一クエリの埋め込みベクトルをキャッシュし、重複生成を防止
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

interface CachedEmbedding {
  embedding: number[];
  timestamp: number;
  textHash: string;
  textLength: number;
}

interface EmbeddingCacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  cacheSize: number;
  lastCleanup: number;
}

export class EmbeddingCache {
  private static instance: EmbeddingCache;
  private cache: Map<string, CachedEmbedding> = new Map();
  private stats: EmbeddingCacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    cacheSize: 0,
    lastCleanup: Date.now()
  };
  
  private readonly CACHE_DIR = '.cache';
  private readonly CACHE_FILE = 'embedding-cache.json';
  private readonly MAX_CACHE_SIZE = 1000; // 最大キャッシュ数
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1時間

  private constructor() {
    this.initializeCache();
  }

  public static getInstance(): EmbeddingCache {
    if (!EmbeddingCache.instance) {
      EmbeddingCache.instance = new EmbeddingCache();
    }
    return EmbeddingCache.instance;
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
      
      console.log(`[EmbeddingCache] Loaded ${this.cache.size} cached embeddings from disk`);
      
      // 期限切れキャッシュのクリーンアップ
      await this.cleanupExpiredCache();
      
    } catch (error) {
      console.log('[EmbeddingCache] No existing cache found, starting fresh');
    }
  }

  /**
   * テキストのハッシュを生成
   */
  private generateTextHash(text: string): string {
    return crypto.createHash('sha256').update(text.trim().toLowerCase()).digest('hex');
  }

  /**
   * キャッシュキーを生成
   */
  private generateCacheKey(text: string): string {
    return this.generateTextHash(text);
  }

  /**
   * 埋め込みベクトルをキャッシュから取得
   */
  public async getCachedEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = this.generateCacheKey(text);
    const cached = this.cache.get(cacheKey);
    
    this.stats.totalRequests++;
    
    if (!cached) {
      this.stats.misses++;
      console.log(`[EmbeddingCache] Cache miss for text: "${text.substring(0, 50)}..."`);
      return null;
    }
    
    // TTLチェック
    if (Date.now() - cached.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      this.stats.misses++;
      console.log(`[EmbeddingCache] Cache expired for text: "${text.substring(0, 50)}..."`);
      return null;
    }
    
    this.stats.hits++;
    console.log(`[EmbeddingCache] Cache hit for text: "${text.substring(0, 50)}..."`);
    return cached.embedding;
  }

  /**
   * 埋め込みベクトルをキャッシュに保存
   */
  public async setCachedEmbedding(text: string, embedding: number[]): Promise<void> {
    const cacheKey = this.generateCacheKey(text);
    const textHash = this.generateTextHash(text);
    
    const cachedEmbedding: CachedEmbedding = {
      embedding: [...embedding], // コピーを作成
      timestamp: Date.now(),
      textHash,
      textLength: text.length
    };
    
    this.cache.set(cacheKey, cachedEmbedding);
    this.stats.cacheSize = this.cache.size;
    
    console.log(`[EmbeddingCache] Cached embedding for text: "${text.substring(0, 50)}..."`);
    
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
      console.log(`[EmbeddingCache] Cleaned up ${removedCount} expired cache entries`);
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
    
    console.log(`[EmbeddingCache] Removed ${removeCount} old cache entries (LRU cleanup)`);
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
      console.error('[EmbeddingCache] Failed to save cache to disk:', error);
    }
  }

  /**
   * キャッシュ統計を取得
   */
  public getStats(): EmbeddingCacheStats & { hitRate: number } {
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
    console.log('[EmbeddingCache] Cache cleared');
  }

  /**
   * 類似テキストの検索（部分一致）
   */
  public findSimilarCachedEmbeddings(text: string, threshold: number = 0.8): CachedEmbedding[] {
    const textHash = this.generateTextHash(text);
    const similar: CachedEmbedding[] = [];
    
    for (const cached of this.cache.values()) {
      if (cached.textHash === textHash) {
        similar.push(cached);
      }
    }
    
    return similar;
  }
}

// シングルトンインスタンスをエクスポート
export const embeddingCache = EmbeddingCache.getInstance();

// アプリケーション終了時にキャッシュを保存（重複防止）
let isSaving = false;

process.on('beforeExit', async () => {
  if (!isSaving) {
    isSaving = true;
    await embeddingCache.saveCacheToDisk();
  }
});

process.on('SIGINT', async () => {
  if (!isSaving) {
    isSaving = true;
    await embeddingCache.saveCacheToDisk();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (!isSaving) {
    isSaving = true;
    await embeddingCache.saveCacheToDisk();
  }
  process.exit(0);
});
