/**
 * Phase 5 Week 2: 回答キャッシュ
 * 
 * 同一質問に対する回答をキャッシュして、2回目以降のレスポンスを高速化
 * 
 * 設計方針:
 * - キャッシュキー: query + documentIds のハッシュ
 * - TTL: 15分（検索キャッシュと同じ）
 * - maxSize: 1000エントリー
 * - 品質への影響: なし（同じ回答を返却）
 */

import { GenericCache } from './generic-cache';
import crypto from 'crypto';

/**
 * キャッシュされた回答データ
 */
export interface CachedAnswer {
  answer: string;
  references: Array<{
    id: string;
    title: string;
    url: string;
  }>;
  timestamp: number;
  documentCount: number;
}

/**
 * 回答キャッシュのオプション
 */
export interface AnswerCacheOptions {
  ttl?: number;        // キャッシュの有効期限（ミリ秒）
  maxSize?: number;    // 最大キャッシュサイズ
  enabled?: boolean;   // キャッシュの有効/無効
}

/**
 * 回答キャッシュサービス
 * 
 * Geminiの回答をキャッシュして、同一質問の2回目以降を高速化
 */
export class AnswerCache {
  private cache: GenericCache<CachedAnswer>;
  private enabled: boolean;

  constructor(options: AnswerCacheOptions = {}) {
    const {
      ttl = 15 * 60 * 1000,      // デフォルト: 15分
      maxSize = 1000,             // デフォルト: 1000エントリー
      enabled = true
    } = options;

    this.enabled = enabled;
    this.cache = new GenericCache<CachedAnswer>({
      ttl,
      maxSize,
      name: 'answer-cache'
    });

    console.log(`[AnswerCache] Initialized: TTL=${ttl}ms, MaxSize=${maxSize}, Enabled=${enabled}`);
  }

  /**
   * キャッシュキーの生成
   * 
   * query + documentIds の組み合わせからハッシュを生成
   * 同じ質問で同じドキュメントセットなら同じキーになる
   */
  private generateCacheKey(query: string, documentIds: string[]): string {
    // クエリを正規化（大文字小文字、空白を統一）
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // ドキュメントIDをソートして一意性を確保
    const sortedDocIds = [...documentIds].sort();
    
    // ハッシュ生成
    const data = `${normalizedQuery}:${sortedDocIds.join(',')}`;
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    
    return hash;
  }

  /**
   * キャッシュから回答を取得
   * 
   * @param query - ユーザーの質問
   * @param documents - 検索結果のドキュメント
   * @returns キャッシュされた回答、または null
   */
  get(query: string, documents: Array<{ id?: string; pageId?: string }>): CachedAnswer | null {
    if (!this.enabled) {
      return null;
    }

    try {
      // ドキュメントIDを抽出
      const documentIds = documents
        .map(doc => doc.id || doc.pageId)
        .filter(id => id) as string[];

      if (documentIds.length === 0) {
        return null;
      }

      const cacheKey = this.generateCacheKey(query, documentIds);
      const cached = this.cache.get(cacheKey);

      if (cached) {
        console.log(`[AnswerCache] ✅ HIT - Query: "${query.substring(0, 50)}...", Docs: ${documentIds.length}`);
        return cached;
      }

      console.log(`[AnswerCache] ❌ MISS - Query: "${query.substring(0, 50)}...", Docs: ${documentIds.length}`);
      return null;

    } catch (error) {
      console.error('[AnswerCache] Error getting from cache:', error);
      return null;
    }
  }

  /**
   * 回答をキャッシュに保存
   * 
   * @param query - ユーザーの質問
   * @param documents - 検索結果のドキュメント
   * @param answer - 生成された回答
   * @param references - 参照ドキュメント
   */
  set(
    query: string,
    documents: Array<{ id?: string; pageId?: string }>,
    answer: string,
    references: Array<{ id: string; title: string; url: string }>
  ): void {
    if (!this.enabled) {
      return;
    }

    try {
      // ドキュメントIDを抽出
      const documentIds = documents
        .map(doc => doc.id || doc.pageId)
        .filter(id => id) as string[];

      if (documentIds.length === 0) {
        return;
      }

      const cacheKey = this.generateCacheKey(query, documentIds);
      const cachedAnswer: CachedAnswer = {
        answer,
        references,
        timestamp: Date.now(),
        documentCount: documentIds.length
      };

      this.cache.set(cacheKey, cachedAnswer);

      console.log(`[AnswerCache] 💾 SAVED - Query: "${query.substring(0, 50)}...", Docs: ${documentIds.length}, Answer: ${answer.length} chars`);

    } catch (error) {
      console.error('[AnswerCache] Error saving to cache:', error);
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear();
    console.log('[AnswerCache] 🗑️ Cache cleared');
  }

  // 緊急: 特定の質問のキャッシュをクリア
  clearForQuestion(questionPattern: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.includes(questionPattern)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[AnswerCache] 🗑️ Cleared ${keysToDelete.length} entries for pattern: "${questionPattern}"`);
  }

  /**
   * キャッシュ統計を取得
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * キャッシュの有効/無効を切り替え
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[AnswerCache] Enabled: ${enabled}`);
  }
}

// シングルトンインスタンス
let answerCacheInstance: AnswerCache | null = null;

/**
 * 回答キャッシュのシングルトンインスタンスを取得
 */
export function getAnswerCache(options?: AnswerCacheOptions): AnswerCache {
  if (!answerCacheInstance) {
    answerCacheInstance = new AnswerCache(options);
    // 緊急: 起動時にキャッシュを完全クリア（デグレード対策）
    answerCacheInstance.clear();
    console.log('[AnswerCache] 🔄 起動時にキャッシュを完全クリアしました（デグレード対策）');
  }
  return answerCacheInstance;
}

/**
 * 回答キャッシュインスタンスをリセット（テスト用）
 */
export function resetAnswerCache(): void {
  if (answerCacheInstance) {
    answerCacheInstance.clear();
  }
  answerCacheInstance = null;
}

