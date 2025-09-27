/**
 * 最適化された埋め込みベクトル生成サービス
 * 並列処理、バッチ処理、メモリ最適化を実装
 */

import * as dotenv from 'dotenv';
dotenv.config();

const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'local';
const MODEL_ID = process.env.EMBEDDINGS_MODEL || 'Xenova/paraphrase-multilingual-mpnet-base-v2';

import { pipeline } from '@xenova/transformers';
import { embeddingCache } from './embedding-cache';

let extractor: any | null = null;
let isInitializing = false;
const initializationPromise: Promise<any> | null = null;

// 並列処理の制限
const MAX_CONCURRENT_EMBEDDINGS = 4;
const BATCH_SIZE = 8;

interface EmbeddingTask {
  text: string;
  resolve: (value: number[]) => void;
  reject: (error: Error) => void;
}

class OptimizedEmbeddingService {
  private static instance: OptimizedEmbeddingService;
  private taskQueue: EmbeddingTask[] = [];
  private activeTasks = 0;
  private batchQueue: EmbeddingTask[] = [];

  private constructor() {}

  public static getInstance(): OptimizedEmbeddingService {
    if (!OptimizedEmbeddingService.instance) {
      OptimizedEmbeddingService.instance = new OptimizedEmbeddingService();
    }
    return OptimizedEmbeddingService.instance;
  }

  /**
   * 単一テキストの埋め込み生成（最適化版）
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== 'string') {
      throw new Error('テキストが空または文字列ではありません');
    }

    if (text.trim().length === 0) {
      text = 'No content available';
    }

    // キャッシュから取得を試行
    const cachedEmbedding = await embeddingCache.getCachedEmbedding(text);
    if (cachedEmbedding) {
      console.log(`🚀 埋め込みベクトルをキャッシュから取得: ${text.substring(0, 50)}...`);
      return cachedEmbedding;
    }

    console.log(`🔍 埋め込みベクトル生成中: ${text.substring(0, 50)}...`);

    // 並列処理制限内で実行
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ text, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * 複数テキストの並列埋め込み生成
   */
  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    const validTexts = texts.filter(text => text && typeof text === 'string' && text.trim().length > 0);
    
    if (validTexts.length === 0) {
      return [];
    }

    console.log(`📦 バッチ埋め込み生成開始: ${validTexts.length}件`);

    // キャッシュチェック
    const results: (number[] | null)[] = new Array(validTexts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < validTexts.length; i++) {
      const cached = await embeddingCache.getCachedEmbedding(validTexts[i]);
      if (cached) {
        results[i] = cached;
        console.log(`🚀 バッチ内キャッシュヒット: ${validTexts[i].substring(0, 30)}...`);
      } else {
        results[i] = null;
        uncachedIndices.push(i);
        uncachedTexts.push(validTexts[i]);
      }
    }

    // 未キャッシュのテキストを並列処理
    if (uncachedTexts.length > 0) {
      const embeddingPromises = uncachedTexts.map(text => this.getEmbedding(text));
      const uncachedEmbeddings = await Promise.all(embeddingPromises);

      // 結果を配置
      for (let i = 0; i < uncachedIndices.length; i++) {
        results[uncachedIndices[i]] = uncachedEmbeddings[i];
      }
    }

    return results.filter((result): result is number[] => result !== null);
  }

  /**
   * キューを処理（並列制限付き）
   */
  private async processQueue(): Promise<void> {
    if (this.activeTasks >= MAX_CONCURRENT_EMBEDDINGS || this.taskQueue.length === 0) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeTasks++;

    try {
      const embedding = await this.generateEmbedding(task.text);
      await embeddingCache.setCachedEmbedding(task.text, embedding);
      task.resolve(embedding);
    } catch (error) {
      task.reject(error as Error);
    } finally {
      this.activeTasks--;
      // 次のタスクを処理
      if (this.taskQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * 実際の埋め込み生成
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    await this.ensureExtractorInitialized();
    
    const startTime = performance.now();
    const output = await extractor(text, { 
      pooling: 'mean', 
      normalize: true,
      // メモリ最適化オプション
      use_cache: false,
      return_tensor: false
    });
    const endTime = performance.now();
    
    console.log(`⚡ 埋め込み生成完了: ${(endTime - startTime).toFixed(2)}ms`);
    
    return Array.from(output.data);
  }

  /**
   * エクストラクタの初期化（シングルトン）
   */
  private async ensureExtractorInitialized(): Promise<void> {
    if (extractor) {
      return;
    }

    if (isInitializing) {
      // 既に初期化中の場合は待機
      return new Promise((resolve) => {
        const checkInitialization = () => {
          if (extractor) {
            resolve();
          } else {
            setTimeout(checkInitialization, 100);
          }
        };
        checkInitialization();
      });
    }

    isInitializing = true;
    
    try {
      console.log('🔧 埋め込みエクストラクタ初期化中...');
      const startTime = performance.now();
      
      extractor = await pipeline('feature-extraction', MODEL_ID, {
        // メモリ最適化オプション
        device: 'cpu',
        dtype: 'float32'
      });
      
      const endTime = performance.now();
      console.log(`✅ 埋め込みエクストラクタ初期化完了: ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('❌ 埋め込みエクストラクタ初期化失敗:', error);
      throw error;
    } finally {
      isInitializing = false;
    }
  }

  /**
   * メモリ使用量の最適化
   */
  async optimizeMemory(): Promise<void> {
    if (extractor && typeof extractor.cleanup === 'function') {
      console.log('🧹 埋め込みエクストラクタメモリ最適化中...');
      await extractor.cleanup();
    }
  }

  /**
   * 統計情報を取得
   */
  getStats(): {
    activeTasks: number;
    queueLength: number;
    isInitialized: boolean;
  } {
    return {
      activeTasks: this.activeTasks,
      queueLength: this.taskQueue.length,
      isInitialized: extractor !== null
    };
  }
}

// シングルトンインスタンスをエクスポート
export const optimizedEmbeddingService = OptimizedEmbeddingService.getInstance();

// 既存のAPIとの互換性を保つ
export async function getEmbeddings(text: string): Promise<number[]> {
  return optimizedEmbeddingService.getEmbedding(text);
}

export async function getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  return optimizedEmbeddingService.getEmbeddingsBatch(texts);
}

export default { getEmbeddings, getEmbeddingsBatch };
