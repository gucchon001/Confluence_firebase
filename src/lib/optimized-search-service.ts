/**
 * 最適化された検索サービス
 * 初期化処理の最適化と並列検索処理を実装
 */

import { LanceDBClient } from './lancedb-client';
import { LunrSearchClient } from './lunr-search-client';
import { UnifiedKeywordExtractionService } from './unified-keyword-extraction-service';
import { UnifiedSearchResultProcessor } from './unified-search-result-processor';
import { UnifiedEmbeddingService } from './unified-embedding-service';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  labels: string[];
  pageId: number;
  url: string;
  _sourceType?: 'vector' | 'bm25' | 'hybrid';
}

interface SearchParams {
  query: string;
  limit?: number;
  labelFilters?: {
    excludeLabels?: string[];
  };
}

class OptimizedSearchService {
  private static instance: OptimizedSearchService;
  private lancedbClient: LanceDBClient | null = null;
  private lunrClient: LunrSearchClient | null = null;
  private keywordService: UnifiedKeywordExtractionService | null = null;
  private embeddingService: UnifiedEmbeddingService | null = null;
  private resultProcessor: UnifiedSearchResultProcessor | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): OptimizedSearchService {
    if (!OptimizedSearchService.instance) {
      OptimizedSearchService.instance = new OptimizedSearchService();
    }
    return OptimizedSearchService.instance;
  }

  /**
   * 初期化処理（一度だけ実行）
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
    console.log('🚀 最適化検索サービスの初期化開始');
    const startTime = performance.now();

    try {
      // 並列でサービスを初期化
      const [lancedbClient, lunrClient, keywordService, embeddingService, resultProcessor] = await Promise.all([
        this.initializeLanceDB(),
        this.initializeLunr(),
        this.initializeKeywordService(),
        this.initializeEmbeddingService(),
        this.initializeResultProcessor()
      ]);

      this.lancedbClient = lancedbClient;
      this.lunrClient = lunrClient;
      this.keywordService = keywordService;
      this.embeddingService = embeddingService;
      this.resultProcessor = resultProcessor;
      this.isInitialized = true;

      const endTime = performance.now();
      console.log(`✅ 最適化検索サービス初期化完了: ${(endTime - startTime).toFixed(2)}ms`);

    } catch (error) {
      console.error('❌ 最適化検索サービス初期化エラー:', error);
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
    // LunrSearchClientは引数なしのinitializeメソッドがないため、スキップ
    return client;
  }

  private async initializeKeywordService(): Promise<UnifiedKeywordExtractionService> {
    const service = UnifiedKeywordExtractionService.getInstance();
    // キーワードリストの事前読み込み（initializeメソッドがない場合はスキップ）
    return service;
  }

  private async initializeEmbeddingService(): Promise<UnifiedEmbeddingService> {
    const service = UnifiedEmbeddingService.getInstance();
    return service;
  }

  private async initializeResultProcessor(): Promise<UnifiedSearchResultProcessor> {
    return UnifiedSearchResultProcessor.getInstance();
  }

  /**
   * 最適化された検索処理
   */
  async search(params: SearchParams): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { query, limit = 10, labelFilters } = params;
    console.log(`🔍 最適化検索開始: "${query}"`);

    const startTime = performance.now();

    try {
      // 並列でベクトル検索とBM25検索を実行
      const [vectorResults, bm25Results] = await Promise.all([
        this.performVectorSearch(query, limit * 2, labelFilters),
        this.performBM25Search(query, limit * 2, labelFilters)
      ]);

      // 結果をマージ（重複除去）
      const mergedResults = this.mergeSearchResults(vectorResults, bm25Results);

      // 結果を処理・ランキング
      const processedResults = await this.resultProcessor!.processSearchResults(mergedResults, {
        query,
        limit,
        labelFilters
      });

      const endTime = performance.now();
      console.log(`✅ 最適化検索完了: ${(endTime - startTime).toFixed(2)}ms, 結果数: ${processedResults.length}`);

      return processedResults;

    } catch (error) {
      console.error('❌ 最適化検索エラー:', error);
      throw error;
    }
  }

  /**
   * ベクトル検索の実行
   */
  private async performVectorSearch(query: string, limit: number, labelFilters?: any): Promise<SearchResult[]> {
    if (!this.lancedbClient || !this.embeddingService) {
      throw new Error('サービスが初期化されていません');
    }

    // 埋め込みベクトルを生成
    const embedding = await this.embeddingService.generateSingleEmbedding(query);
    
    // キーワードを抽出
    const keywords = this.keywordService ? await this.keywordService.extractKeywordsConfigured(query) : [];

    // LanceDBでベクトル検索を実行
    const table = await this.lancedbClient.getTable();
    const vectorResults = await table
      .search(embedding)
      .limit(limit)
      .toArray();

    // 結果を変換
    return vectorResults.map((result: any) => ({
      id: result.id,
      title: result.title,
      content: result.content,
      score: result.score || 0,
      labels: result.labels || [],
      pageId: result.pageId,
      url: result.url,
      _sourceType: 'vector' as const
    }));
  }

  /**
   * BM25検索の実行
   */
  private async performBM25Search(query: string, limit: number, labelFilters?: any): Promise<SearchResult[]> {
    if (!this.lunrClient) {
      throw new Error('サービスが初期化されていません');
    }

    // キーワードを抽出
    const keywords = this.keywordService ? await this.keywordService.extractKeywordsConfigured(query) : [];

    // LunrでBM25検索を実行
    const bm25Results = await this.lunrClient.searchCandidates(query, limit);

    // 結果を変換
    return bm25Results.map((result: any) => ({
      id: result.id,
      title: result.title,
      content: result.content,
      score: result.score || 0,
      labels: result.labels || [],
      pageId: result.pageId,
      url: result.url,
      _sourceType: 'bm25' as const
    }));
  }

  /**
   * 検索結果のマージ（重複除去）
   */
  private mergeSearchResults(vectorResults: SearchResult[], bm25Results: SearchResult[]): SearchResult[] {
    const resultMap = new Map<string, SearchResult>();

    // ベクトル検索結果を追加
    vectorResults.forEach(result => {
      resultMap.set(result.id, result);
    });

    // BM25検索結果を追加（重複はスコアが高い方を保持）
    bm25Results.forEach(result => {
      const existing = resultMap.get(result.id);
      if (!existing || result.score > existing.score) {
        resultMap.set(result.id, result);
      }
    });

    return Array.from(resultMap.values());
  }

  /**
   * サービス状態の確認
   */
  getStatus(): {
    isInitialized: boolean;
    services: {
      lancedb: boolean;
      lunr: boolean;
      keyword: boolean;
      embedding: boolean;
      processor: boolean;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      services: {
        lancedb: this.lancedbClient !== null,
        lunr: this.lunrClient !== null,
        keyword: this.keywordService !== null,
        embedding: this.embeddingService !== null,
        processor: this.resultProcessor !== null
      }
    };
  }
}

// シングルトンインスタンス
export const optimizedSearchService = OptimizedSearchService.getInstance();
