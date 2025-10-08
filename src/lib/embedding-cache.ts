/**
 * エンベディングキャッシュ
 * クエリのエンベディングをキャッシュして、再計算を避ける
 */

import crypto from 'crypto';

interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
  hits: number;
}

class EmbeddingCache {
  private cache = new Map<string, EmbeddingCacheEntry>();
  private readonly TTL = 7200000; // 2時間（エンベディングは長期間有効）
  private readonly MAX_SIZE = 500; // 最大500エントリ

  /**
   * キャッシュからエンベディングを取得（同期版）
   */
  get(query: string): number[] | null {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // TTLチェック
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // ヒット数を増やす
    entry.hits++;
    
    return entry.embedding;
  }

  /**
   * キャッシュからエンベディングを取得（embeddings.tsとの互換性のため）
   */
  async getCachedEmbedding(query: string): Promise<number[] | null> {
    const key = this.generateKey(query);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // TTLチェック
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // ヒット数を増やす
    entry.hits++;
    console.log(`🚀 エンベディングキャッシュヒット: "${query.substring(0, 50)}..." (${entry.hits}回目)`);
    
    return entry.embedding;
  }

  /**
   * エンベディングをキャッシュに保存（同期版）
   */
  set(query: string, embedding: number[]): void {
    const key = this.generateKey(query);
    
    // キャッシュサイズ制限
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      hits: 0
    });
  }

  /**
   * エンベディングをキャッシュに保存（embeddings.tsとの互換性のため）
   */
  async setCachedEmbedding(query: string, embedding: number[]): Promise<void> {
    const key = this.generateKey(query);
    
    // キャッシュサイズ制限
    if (this.cache.size >= this.MAX_SIZE) {
      this.evictLRU();
    }
    
    this.cache.set(key, {
      embedding,
      timestamp: Date.now(),
      hits: 0
    });
    
    console.log(`💾 エンベディングをキャッシュに保存: "${query.substring(0, 50)}..."`);
  }

  /**
   * クエリを正規化してキーを生成
   */
  private generateKey(query: string): string {
    // クエリの正規化（大小文字、空白、句読点を統一）
    const normalized = query
      .toLowerCase()
      .trim()
      .replace(/[？！。、\s]+/g, ' ')
      .replace(/です|ます|ください|でしょうか/g, '');
    
    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  /**
   * LRU（Least Recently Used）でエントリを削除
   */
  private evictLRU(): void {
    let oldestTime = Infinity;
    let oldestKey = '';
    
    // 最も古く、ヒット数が少ないエントリを見つける
    for (const [key, entry] of this.cache.entries()) {
      const score = entry.timestamp + (entry.hits * 60000); // ヒット1回 = 1分の価値
      if (score < oldestTime) {
        oldestTime = score;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log('🗑️ エンベディングキャッシュLRU削除');
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    console.log('🗑️ エンベディングキャッシュをクリア');
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): { size: number; avgHits: number; hitRate: number } {
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
      avgHits: totalHits / Math.max(this.cache.size, 1),
      hitRate: entriesWithHits / Math.max(this.cache.size, 1)
    };
  }
}

export const embeddingCache = new EmbeddingCache();
