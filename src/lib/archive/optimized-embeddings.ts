/**
 * 最適化された埋め込みベクトル生成サービス（ロールバック版）
 * 複雑な最適化を無効化し、元の実装を使用
 */

export class OptimizedEmbeddingService {
  private static instance: OptimizedEmbeddingService;

  private constructor() {}

  public static getInstance(): OptimizedEmbeddingService {
    if (!OptimizedEmbeddingService.instance) {
      OptimizedEmbeddingService.instance = new OptimizedEmbeddingService();
    }
    return OptimizedEmbeddingService.instance;
  }

  /**
   * 単一テキストの埋め込み生成（ロールバック版）
   */
  async getEmbedding(text: string): Promise<number[]> {
    if (!text || typeof text !== 'string') {
      throw new Error('テキストが空または文字列ではありません');
    }
    
    // 最適化を無効化し、元の実装を使用
    const { getEmbeddings } = await import('./embeddings');
    return getEmbeddings(text);
  }

  /**
   * 複数テキストの並列埋め込み生成（ロールバック版）
   */
  async getEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    const validTexts = texts.filter(text => text && typeof text === 'string' && text.trim().length > 0);
    
    if (validTexts.length === 0) {
      return [];
    }

    console.log(`📦 バッチ埋め込み生成開始: ${validTexts.length}件（ロールバック版）`);

    // 元の実装を使用して並列処理
    const { getEmbeddings } = await import('./embeddings');
    const embeddingPromises = validTexts.map(text => getEmbeddings(text));
    const embeddings = await Promise.all(embeddingPromises);

    return embeddings;
  }
}

// シングルトンインスタンスをエクスポート
export const optimizedEmbeddingService = OptimizedEmbeddingService.getInstance();