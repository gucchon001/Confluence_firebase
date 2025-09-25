/**
 * シンプルなパフォーマンス最適化サービス
 * 既存のコードを最小限の変更で最適化
 */

import { LanceDBClient } from './lancedb-client';
import { LunrSearchClient } from './lunr-search-client';
import { UnifiedKeywordExtractionService } from './unified-keyword-extraction-service';
import { UnifiedEmbeddingService } from './unified-embedding-service';
import { UnifiedSearchResultProcessor } from './unified-search-result-processor';

export class SimplePerformanceOptimizer {
  private static instance: SimplePerformanceOptimizer;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  // キャッシュされたサービスインスタンス
  private lancedbClient: LanceDBClient | null = null;
  private lunrClient: LunrSearchClient | null = null;
  private keywordService: UnifiedKeywordExtractionService | null = null;
  private embeddingService: UnifiedEmbeddingService | null = null;
  private resultProcessor: UnifiedSearchResultProcessor | null = null;

  private constructor() {}

  static getInstance(): SimplePerformanceOptimizer {
    if (!SimplePerformanceOptimizer.instance) {
      SimplePerformanceOptimizer.instance = new SimplePerformanceOptimizer();
    }
    return SimplePerformanceOptimizer.instance;
  }

  /**
   * 並列初期化でパフォーマンスを向上
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    await this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    console.log('[SimplePerformanceOptimizer] Starting parallel initialization...');
    const startTime = performance.now();

    try {
      // 並列でサービスを初期化
      const [
        lancedbClient,
        lunrClient,
        keywordService,
        embeddingService,
        resultProcessor
      ] = await Promise.all([
        this.initializeLanceDB(),
        this.initializeLunr(),
        this.initializeKeywordService(),
        this.initializeEmbeddingService(),
        this.initializeResultProcessor()
      ]);

      // インスタンスを保存
      this.lancedbClient = lancedbClient;
      this.lunrClient = lunrClient;
      this.keywordService = keywordService;
      this.embeddingService = embeddingService;
      this.resultProcessor = resultProcessor;

      this.isInitialized = true;
      const endTime = performance.now();
      console.log(`[SimplePerformanceOptimizer] Initialization completed in ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      console.error('[SimplePerformanceOptimizer] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeLanceDB(): Promise<LanceDBClient> {
    const client = LanceDBClient.getInstance();
    await client.connect();
    return client;
  }

  private async initializeLunr(): Promise<LunrSearchClient> {
    const client = LunrSearchClient.getInstance();
    // Lunrは既に初期化済みの場合はスキップ
    return client;
  }

  private async initializeKeywordService(): Promise<UnifiedKeywordExtractionService> {
    return UnifiedKeywordExtractionService.getInstance();
  }

  private async initializeEmbeddingService(): Promise<UnifiedEmbeddingService> {
    return UnifiedEmbeddingService.getInstance();
  }

  private async initializeResultProcessor(): Promise<UnifiedSearchResultProcessor> {
    return UnifiedSearchResultProcessor.getInstance();
  }

  /**
   * 最適化された検索実行
   */
  async search(query: string, limit: number = 10): Promise<any[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    console.log(`[SimplePerformanceOptimizer] Starting optimized search for: "${query}"`);

    try {
      // 1. 並列でキーワード抽出と埋め込み生成
      const [keywords, embedding] = await Promise.all([
        this.keywordService!.extractKeywordsConfigured(query),
        this.embeddingService!.generateSingleEmbedding(query)
      ]);

      console.log(`[SimplePerformanceOptimizer] Extracted ${keywords.length} keywords, generated embedding`);

      // 2. 並列でベクトル検索とBM25検索
      const [vectorResults, bm25Results] = await Promise.all([
        this.performVectorSearch(embedding, limit * 2), // 多めに取得
        this.performBM25Search(query, keywords, limit * 2)
      ]);

      console.log(`[SimplePerformanceOptimizer] Vector: ${vectorResults.length}, BM25: ${bm25Results.length} results`);

      // 3. 結果の統合と処理
      const combinedResults = this.combineResults(vectorResults, bm25Results);
      const processedResults = this.resultProcessor!.processSearchResults(combinedResults, {
        query,
        limit,
        excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
      });

      const endTime = performance.now();
      console.log(`[SimplePerformanceOptimizer] Search completed in ${(endTime - startTime).toFixed(2)}ms`);

      return processedResults.slice(0, limit);
    } catch (error) {
      console.error('[SimplePerformanceOptimizer] Search failed:', error);
      throw error;
    }
  }

  private async performVectorSearch(embedding: number[], limit: number): Promise<any[]> {
    if (!this.lancedbClient) {
      throw new Error('LanceDB client not initialized');
    }

    const table = await this.lancedbClient.getTable();
    const results = await table.search(embedding)
      .limit(limit)
      .toArray();

    return results.map((result: any) => ({
      ...result,
      _sourceType: 'vector'
    }));
  }

  private async performBM25Search(query: string, keywords: string[], limit: number): Promise<any[]> {
    if (!this.lunrClient) {
      throw new Error('Lunr client not initialized');
    }

    const results = await this.lunrClient.searchCandidates(query, limit);
    return results.map((result: any) => ({
      ...result,
      _sourceType: 'bm25'
    }));
  }

  private combineResults(vectorResults: any[], bm25Results: any[]): any[] {
    // 重複を除去して結果を統合
    const combined = [...vectorResults];
    const vectorIds = new Set(vectorResults.map(r => r.id));

    for (const bm25Result of bm25Results) {
      if (!vectorIds.has(bm25Result.id)) {
        combined.push(bm25Result);
      }
    }

    return combined;
  }

  /**
   * 初期化状況を取得
   */
  getStatus(): { initialized: boolean; services: Record<string, boolean> } {
    return {
      initialized: this.isInitialized,
      services: {
        lancedb: !!this.lancedbClient,
        lunr: !!this.lunrClient,
        keyword: !!this.keywordService,
        embedding: !!this.embeddingService,
        resultProcessor: !!this.resultProcessor
      }
    };
  }
}

// シングルトンインスタンス
export const simplePerformanceOptimizer = SimplePerformanceOptimizer.getInstance();
