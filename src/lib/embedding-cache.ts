/**
 * エンベディングキャッシュ
 * クエリのエンベディングをキャッシュして、再計算を避ける
 */

import crypto from 'crypto';
import { GenericCache } from './generic-cache';

// エンベディングキャッシュ（グローバルに保持してHMRの影響を回避）
const getEmbeddingCacheInstance = () => {
  if (!globalThis.__embeddingCache) {
    globalThis.__embeddingCache = new GenericCache<number[]>({
      ttl: 7200000, // 2時間（エンベディングは長期間有効）
      maxSize: 500, // 最大500エントリ
      evictionStrategy: 'lru'
    });
    console.log('🔧 エンベディングキャッシュを初期化しました');
  }
  return globalThis.__embeddingCache;
};

const cache = getEmbeddingCacheInstance();

// TypeScript用のグローバル型定義
declare global {
  var __embeddingCache: GenericCache<number[]> | undefined;
}

class EmbeddingCache {
  /**
   * キャッシュからエンベディングを取得（同期版）
   */
  get(query: string): number[] | null {
    const key = this.generateKey(query);
    return cache.get(key);
  }

  /**
   * キャッシュからエンベディングを取得（embeddings.tsとの互換性のため）
   */
  async getCachedEmbedding(query: string): Promise<number[] | null> {
    const key = this.generateKey(query);
    const result = cache.get(key);
    
    if (result) {
      console.log(`🚀 エンベディングキャッシュヒット: "${query.substring(0, 50)}..."`);
    }
    
    return result;
  }

  /**
   * エンベディングをキャッシュに保存
   */
  set(query: string, embedding: number[]): void {
    const key = this.generateKey(query);
    cache.set(key, embedding);
  }

  /**
   * エンベディングをキャッシュに保存（embeddings.tsとの互換性のため）
   */
  async setCachedEmbedding(query: string, embedding: number[]): Promise<void> {
    const key = this.generateKey(query);
    cache.set(key, embedding);
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
   * キャッシュをクリア
   */
  clear(): void {
    cache.clear();
    console.log('🗑️ エンベディングキャッシュをクリア');
  }

  /**
   * キャッシュ統計を取得
   */
  getStats(): { size: number; avgHits: number; hitRate: number } {
    return cache.getStats();
  }
}

export const embeddingCache = new EmbeddingCache();
