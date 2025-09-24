/**
 * 統一された埋め込み生成サービス
 * 重複コードを解消し、一貫した埋め込み生成を提供
 */

import { getEmbeddings } from './embeddings';
import { withRetry } from './retry-utils';
import { ErrorHandler } from './error-handling';

export interface EmbeddingOptions {
  maxRetries?: number;
  initialDelay?: number;
  batchSize?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  success: boolean;
  error?: string;
}

/**
 * 統一された埋め込み生成サービス
 */
export class UnifiedEmbeddingService {
  private static instance: UnifiedEmbeddingService;
  private defaultOptions: Required<EmbeddingOptions>;

  private constructor() {
    this.defaultOptions = {
      maxRetries: 3,
      initialDelay: 1000,
      batchSize: 20
    };
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): UnifiedEmbeddingService {
    if (!UnifiedEmbeddingService.instance) {
      UnifiedEmbeddingService.instance = new UnifiedEmbeddingService();
    }
    return UnifiedEmbeddingService.instance;
  }

  /**
   * 単一テキストの埋め込み生成
   */
  async generateSingleEmbedding(
    text: string,
    options: EmbeddingOptions = {}
  ): Promise<number[]> {
    const opts = { ...this.defaultOptions, ...options };

    if (!text || typeof text !== 'string') {
      throw new Error('テキストが空または文字列ではありません');
    }

    if (text.trim().length === 0) {
      text = 'No content available';
    }

    return await withRetry(
      async () => {
        return await getEmbeddings(text);
      },
      {
        maxRetries: opts.maxRetries,
        initialDelay: opts.initialDelay,
        onError: async (error: any, retryCount: number) => {
          await ErrorHandler.logError('embedding_generation_single', error, {
            textLength: text.length,
            retryCount
          });
        }
      }
    );
  }

  /**
   * バッチ埋め込み生成
   */
  async generateBatchEmbeddings(
    records: Array<{ content: string; [key: string]: any }>,
    options: EmbeddingOptions = {}
  ): Promise<EmbeddingResult[]> {
    const opts = { ...this.defaultOptions, ...options };

    if (!records || records.length === 0) {
      return [];
    }

    // バッチサイズに基づいて分割処理
    const results: EmbeddingResult[] = [];
    
    for (let i = 0; i < records.length; i += opts.batchSize) {
      const batch = records.slice(i, i + opts.batchSize);
      const batchResults = await this.processBatch(batch, opts);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * バッチ処理の実行
   */
  private async processBatch(
    batch: Array<{ content: string; [key: string]: any }>,
    options: Required<EmbeddingOptions>
  ): Promise<EmbeddingResult[]> {
    try {
      // バッチの内容を結合
      const content = batch.map(r => r.content).join('\n');
      
      // 統一されたリトライロジックを使用
      const embedding = await withRetry(
        async () => {
          return await getEmbeddings(content);
        },
        {
          maxRetries: options.maxRetries,
          initialDelay: options.initialDelay,
          onError: async (error: any, retryCount: number) => {
            await ErrorHandler.logError('embedding_generation_batch', error, {
              batchSize: batch.length,
              retryCount,
              contentSample: batch[0]?.content?.substring(0, 100)
            });
            
            // ペイロードサイズエラーの場合はバッチを再分割
            if (error.message?.includes('Request payload size exceeds the limit') && batch.length > 1) {
              console.log(`Payload too large, splitting batch of ${batch.length} into two parts`);
              const mid = Math.floor(batch.length / 2);
              const firstHalf = await this.processBatch(batch.slice(0, mid), options);
              const secondHalf = await this.processBatch(batch.slice(mid), options);
              return firstHalf.concat(secondHalf);
            }
          }
        }
      );

      // 各レコードに同じ埋め込みを割り当て（バッチ処理のため）
      return batch.map(() => ({
        embedding,
        success: true
      }));

    } catch (error: any) {
      console.error(`Batch processing failed:`, error);
      
      // エラーが発生した場合は空の埋め込みで続行
      return batch.map(() => ({
        embedding: [],
        success: false,
        error: error.message
      }));
    }
  }

  /**
   * 動的バッチサイズでの埋め込み生成（既存のAPI互換性維持）
   */
  async generateEmbeddingsWithDynamicBatch(
    recordsToEmbed: Array<{ content: string; [key: string]: any }>,
    options: EmbeddingOptions = {}
  ): Promise<Array<{ content: string; embedding: number[]; [key: string]: any }>> {
    const opts = { ...this.defaultOptions, ...options };
    
    console.log(`Using batch size: ${opts.batchSize}`);

    const results = await this.generateBatchEmbeddings(recordsToEmbed, opts);
    
    // 結果を元のレコード形式に変換
    return recordsToEmbed.map((record, index) => {
      const result = results[index];
      const embedding = result?.embedding || [];
      
      // L2正規化
      const l2 = Math.sqrt(embedding.reduce((s: number, v: number) => s + (v * v), 0)) || 1;
      const normalizedEmbedding = embedding.map((v: number) => v / l2);
      
      return {
        ...record,
        embedding: normalizedEmbedding
      };
    });
  }
}

// シングルトンインスタンスをエクスポート
export const unifiedEmbeddingService = UnifiedEmbeddingService.getInstance();

// 既存のAPI互換性のための関数
export async function embedWithRetry(
  batchOfRecords: any[],
  maxRetries = 3,
  initialDelay = 1000
): Promise<any[]> {
  const results = await unifiedEmbeddingService.generateBatchEmbeddings(
    batchOfRecords,
    { maxRetries, initialDelay }
  );
  
  return results.map(result => ({
    embedding: result.embedding
  }));
}

export async function generateEmbeddingsWithDynamicBatch(
  recordsToEmbed: any[]
): Promise<any[]> {
  return await unifiedEmbeddingService.generateEmbeddingsWithDynamicBatch(recordsToEmbed);
}
