/**
 * GraphRAG統合ハイブリッド検索システム
 * ベクトル検索 + BM25検索 + グラフ検索を統合
 */

import { LanceDBClient } from './lancedb-client';
import { searchLanceDB } from './lancedb-search-client';
import { GraphSearchClient } from './graph-search-client';
// import { DynamicKeywordExtractor } from './dynamic-keyword-extractor';

interface SearchResult {
  pageId: string;
  title: string;
  content: string;
  url: string;
  score: number;
  source: 'vector' | 'bm25' | 'graph' | 'keyword' | 'title';
  metadata: {
    labels: string[];
    lastModified: string;
    spaceKey: string;
  };
  graphContext?: {
    relatedFunctions: string[];
    relatedKeywords: string[];
    relationships: string[];
  };
}

interface HybridSearchOptions {
  maxResults?: number;
  includeGraphContext?: boolean;
  graphSearchDepth?: number;
  vectorWeight?: number;
  bm25Weight?: number;
  graphWeight?: number;
  keywordWeight?: number;
  titleWeight?: number;
}

export class HybridSearchWithGraph {
  private lancedbClient: LanceDBClient;
  private graphSearchClient: GraphSearchClient;

  constructor() {
    this.lancedbClient = LanceDBClient.getInstance();
    this.graphSearchClient = new GraphSearchClient();
  }

  /**
   * GraphRAG統合検索を実行
   */
  async search(query: string, options: HybridSearchOptions = {}): Promise<SearchResult[]> {
    const {
      maxResults = 20,
      includeGraphContext = true,
      graphSearchDepth = 3,
      vectorWeight = 0.4,
      bm25Weight = 0.3,
      graphWeight = 0.2,
      keywordWeight = 0.05,
      titleWeight = 0.05
    } = options;

    console.log(`🔍 GraphRAG統合検索実行: "${query}"`);

    // 1. 並列検索実行
    const [vectorResults, bm25Results, graphResults, keywordResults, titleResults] = await Promise.all([
      this.performVectorSearch(query),
      this.performBM25Search(query),
      this.performGraphSearch(query, graphSearchDepth),
      this.performKeywordSearch(query),
      this.performTitleSearch(query)
    ]);

    console.log(`📊 検索結果: Vector(${vectorResults.length}), BM25(${bm25Results.length}), Graph(${graphResults.length}), Keyword(${keywordResults.length}), Title(${titleResults.length})`);

    // 2. 結果を統合
    const mergedResults = this.mergeSearchResults({
      vector: vectorResults,
      bm25: bm25Results,
      graph: graphResults,
      keyword: keywordResults,
      title: titleResults
    }, {
      vectorWeight,
      bm25Weight,
      graphWeight,
      keywordWeight,
      titleWeight
    });

    // 3. グラフコンテキストを追加
    if (includeGraphContext) {
      await this.addGraphContext(mergedResults, query);
    }

    // 4. 最終結果をソート
    const finalResults = mergedResults
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    console.log(`✅ 統合検索完了: ${finalResults.length}件の結果`);

    return finalResults;
  }

  /**
   * ベクトル検索を実行
   */
  private async performVectorSearch(query: string): Promise<SearchResult[]> {
    try {
      const results = await searchLanceDB({
        query,
        topK: 100,
        useLunrIndex: true
      });

      return results.map(result => ({
        pageId: result.pageId.toString(),
        title: result.title,
        content: result.content,
        url: result.url || '',
        score: (result as any)._hybridScore || result.distance || 0,
        source: 'vector' as const,
        metadata: {
          labels: result.labels || [],
          lastModified: result.lastUpdated || '',
          spaceKey: result.space_key || ''
        }
      }));
    } catch (error) {
      console.error('❌ ベクトル検索エラー:', error);
      return [];
    }
  }

  /**
   * BM25検索を実行
   */
  private async performBM25Search(query: string): Promise<SearchResult[]> {
    try {
      // BM25検索はsearchLanceDBで統合されているので、同じ関数を使用
      const results = await searchLanceDB({
        query,
        topK: 100,
        useLunrIndex: true
      });

      return results.map(result => ({
        pageId: result.pageId.toString(),
        title: result.title,
        content: result.content,
        url: result.url || '',
        score: (result as any)._hybridScore || result.distance || 0,
        source: 'bm25' as const,
        metadata: {
          labels: result.labels || [],
          lastModified: result.lastUpdated || '',
          spaceKey: result.space_key || ''
        }
      }));
    } catch (error) {
      console.error('❌ BM25検索エラー:', error);
      return [];
    }
  }

  /**
   * グラフ検索を実行
   */
  private async performGraphSearch(query: string, maxDepth: number): Promise<SearchResult[]> {
    try {
      const graphResult = await this.graphSearchClient.searchGraph(query, {
        maxDepth,
        maxResults: 50,
        nodeTypes: ['Page', 'Function'],
        minRelevanceScore: 0.3
      });

      // グラフ検索結果からページ情報を取得
      const searchResults: SearchResult[] = [];
      
      for (const entity of graphResult.entities) {
        if (entity.type === 'Page') {
          // ページ情報をLanceDBから取得
          const pageData = await searchLanceDB({
            query: entity.properties.pageId,
            topK: 1,
            useLunrIndex: false
          });
          
          if (pageData.length > 0) {
            const page = pageData[0];
            searchResults.push({
              pageId: entity.properties.pageId,
              title: entity.name,
              content: page.content,
              url: page.url || '',
              score: graphResult.relevanceScore,
              source: 'graph' as const,
              metadata: {
                labels: page.labels || [],
                lastModified: page.lastUpdated || '',
                spaceKey: page.space_key || ''
              }
            });
          }
        }
      }

      return searchResults;
    } catch (error) {
      console.error('❌ グラフ検索エラー:', error);
      return [];
    }
  }

  /**
   * キーワード検索を実行
   */
  private async performKeywordSearch(query: string): Promise<SearchResult[]> {
    try {
      // キーワード検索はsearchLanceDBで統合されているので、同じ関数を使用
      const results = await searchLanceDB({
        query,
        topK: 50,
        useLunrIndex: true
      });

      return results.map(result => ({
        pageId: result.pageId.toString(),
        title: result.title,
        content: result.content,
        url: result.url || '',
        score: (result as any)._hybridScore || result.distance || 0,
        source: 'keyword' as const,
        metadata: {
          labels: result.labels || [],
          lastModified: result.lastUpdated || '',
          spaceKey: result.space_key || ''
        }
      }));
    } catch (error) {
      console.error('❌ キーワード検索エラー:', error);
      return [];
    }
  }

  /**
   * タイトル検索を実行
   */
  private async performTitleSearch(query: string): Promise<SearchResult[]> {
    try {
      // タイトル検索はsearchLanceDBで統合されているので、同じ関数を使用
      const results = await searchLanceDB({
        query,
        topK: 20,
        useLunrIndex: true
      });

      return results.map(result => ({
        pageId: result.pageId.toString(),
        title: result.title,
        content: result.content,
        url: result.url || '',
        score: (result as any)._hybridScore || result.distance || 0,
        source: 'title' as const,
        metadata: {
          labels: result.labels || [],
          lastModified: result.lastUpdated || '',
          spaceKey: result.space_key || ''
        }
      }));
    } catch (error) {
      console.error('❌ タイトル検索エラー:', error);
      return [];
    }
  }

  /**
   * 検索結果を統合
   */
  private mergeSearchResults(
    results: {
      vector: SearchResult[];
      bm25: SearchResult[];
      graph: SearchResult[];
      keyword: SearchResult[];
      title: SearchResult[];
    },
    weights: {
      vectorWeight: number;
      bm25Weight: number;
      graphWeight: number;
      keywordWeight: number;
      titleWeight: number;
    }
  ): SearchResult[] {
    const pageMap = new Map<string, SearchResult>();

    // 各検索結果を統合
    const allResults = [
      ...results.vector.map(r => ({ ...r, weight: weights.vectorWeight })),
      ...results.bm25.map(r => ({ ...r, weight: weights.bm25Weight })),
      ...results.graph.map(r => ({ ...r, weight: weights.graphWeight })),
      ...results.keyword.map(r => ({ ...r, weight: weights.keywordWeight })),
      ...results.title.map(r => ({ ...r, weight: weights.titleWeight }))
    ];

    // RRF（Reciprocal Rank Fusion）でスコアを統合
    for (const result of allResults) {
      const existing = pageMap.get(result.pageId);
      
      if (existing) {
        // 既存の結果と統合
        existing.score += result.score * result.weight;
        
        // ソース情報を追加
        if (!existing.source.includes(result.source)) {
          existing.source += `,${result.source}`;
        }
      } else {
        // 新しい結果を追加
        pageMap.set(result.pageId, {
          ...result,
          score: result.score * result.weight
        });
      }
    }

    return Array.from(pageMap.values());
  }

  /**
   * グラフコンテキストを追加
   */
  private async addGraphContext(results: SearchResult[], query: string): Promise<void> {
    try {
      const graphResult = await this.graphSearchClient.searchGraph(query, {
        maxDepth: 2,
        maxResults: 100
      });

      // 各結果にグラフコンテキストを追加
      for (const result of results) {
        const relatedFunctions = graphResult.entities
          .filter(e => e.type === 'Function')
          .map(e => e.name);

        const relatedKeywords = graphResult.entities
          .filter(e => e.type === 'Keyword')
          .map(e => e.name);

        const relationships = graphResult.relationships
          .map(r => r.relationship);

        result.graphContext = {
          relatedFunctions: [...new Set(relatedFunctions)],
          relatedKeywords: [...new Set(relatedKeywords)],
          relationships: [...new Set(relationships)]
        };
      }
    } catch (error) {
      console.error('❌ グラフコンテキスト追加エラー:', error);
    }
  }

  /**
   * 検索結果の品質を評価
   */
  async evaluateSearchQuality(query: string, results: SearchResult[]): Promise<{
    relevanceScore: number;
    diversityScore: number;
    completenessScore: number;
    overallScore: number;
  }> {
    // 関連性スコア（グラフ検索結果との一致度）
    const relevanceScore = this.calculateRelevanceScore(query, results);
    
    // 多様性スコア（異なるソースからの結果の分布）
    const diversityScore = this.calculateDiversityScore(results);
    
    // 完全性スコア（期待される結果の網羅性）
    const completenessScore = await this.calculateCompletenessScore(query, results);
    
    const overallScore = (relevanceScore + diversityScore + completenessScore) / 3;

    return {
      relevanceScore,
      diversityScore,
      completenessScore,
      overallScore
    };
  }

  private calculateRelevanceScore(query: string, results: SearchResult[]): number {
    if (results.length === 0) return 0;

    const totalScore = results.reduce((sum, result) => sum + result.score, 0);
    return totalScore / results.length;
  }

  private calculateDiversityScore(results: SearchResult[]): number {
    if (results.length === 0) return 0;

    const sources = new Set(results.map(r => r.source));
    return sources.size / 5; // 5つの検索ソース
  }

  private async calculateCompletenessScore(query: string, results: SearchResult[]): Promise<number> {
    try {
      // グラフ検索で期待される結果を取得
      const expectedResults = await this.graphSearchClient.searchGraph(query, {
        maxDepth: 2,
        maxResults: 20
      });

      const foundPageIds = new Set(results.map(r => r.pageId));
      const expectedPageIds = expectedResults.entities
        .filter(e => e.type === 'Page')
        .map(e => e.properties.pageId);

      const foundCount = expectedPageIds.filter(id => foundPageIds.has(id)).length;
      return expectedPageIds.length > 0 ? foundCount / expectedPageIds.length : 0;
    } catch (error) {
      console.error('❌ 完全性スコア計算エラー:', error);
      return 0;
    }
  }
}

// HybridSearchWithGraph is already exported above
