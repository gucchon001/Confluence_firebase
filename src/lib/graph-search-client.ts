/**
 * GraphRAG用グラフ検索クライアント
 * ナレッジグラフを探索して関連エンティティを返す
 */

import fs from 'fs';
import path from 'path';

interface GraphNode {
  id: string;
  type: 'Function' | 'SystemItem' | 'Keyword' | 'Page' | 'Label';
  name: string;
  properties: Record<string, any>;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: 'DESCRIBES' | 'CONTAINS' | 'RELATES_TO' | 'ASSOCIATED_WITH' | 'TAGGED_WITH';
  properties?: Record<string, any>;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: {
    generatedAt: string;
    totalNodes: number;
    totalEdges: number;
    nodeTypes: Record<string, number>;
  };
}

interface GraphSearchResult {
  entities: GraphNode[];
  relationships: GraphEdge[];
  paths: GraphPath[];
  relevanceScore: number;
  query: string;
}

interface GraphPath {
  nodes: GraphNode[];
  edges: GraphEdge[];
  length: number;
  relevanceScore: number;
}

interface SearchOptions {
  maxDepth?: number;
  maxResults?: number;
  nodeTypes?: string[];
  relationships?: string[];
  minRelevanceScore?: number;
}

export class GraphSearchClient {
  private graphData: GraphData | null = null;
  private adjacencyList: Map<string, string[]> = new Map();
  private nodeMap: Map<string, GraphNode> = new Map();
  private edgeMap: Map<string, GraphEdge[]> = new Map();

  constructor() {
    this.loadGraphData();
  }

  /**
   * グラフデータを読み込み
   */
  private loadGraphData(): void {
    try {
      const filePath = path.join(process.cwd(), 'data/graph-data/knowledge-graph.json');
      
      if (!fs.existsSync(filePath)) {
        console.warn('⚠️ グラフデータが見つかりません。先にgraph-data-generatorを実行してください。');
        return;
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.graphData = data;
      
      // インデックスを構築
      this.buildIndexes();
      
      console.log(`📊 グラフデータを読み込みました: ${data.metadata.totalNodes}ノード, ${data.metadata.totalEdges}エッジ`);
    } catch (error) {
      console.error('❌ グラフデータの読み込みに失敗しました:', error);
    }
  }

  /**
   * 検索用インデックスを構築
   */
  private buildIndexes(): void {
    if (!this.graphData) return;

    // ノードマップを構築
    for (const node of this.graphData.nodes) {
      this.nodeMap.set(node.id, node);
    }

    // 隣接リストを構築
    for (const edge of this.graphData.edges) {
      if (!this.adjacencyList.has(edge.source)) {
        this.adjacencyList.set(edge.source, []);
      }
      this.adjacencyList.get(edge.source)!.push(edge.target);

      // エッジマップを構築
      if (!this.edgeMap.has(edge.source)) {
        this.edgeMap.set(edge.source, []);
      }
      this.edgeMap.get(edge.source)!.push(edge);
    }
  }

  /**
   * クエリに基づいてグラフを検索
   */
  async searchGraph(query: string, options: SearchOptions = {}): Promise<GraphSearchResult> {
    if (!this.graphData) {
      throw new Error('グラフデータが読み込まれていません');
    }

    const {
      maxDepth = 3,
      maxResults = 50,
      nodeTypes = [],
      relationships = [],
      minRelevanceScore = 0.1
    } = options;

    console.log(`🔍 グラフ検索実行: "${query}"`);

    // クエリからエンティティを抽出
    const queryEntities = this.extractQueryEntities(query);
    
    // 各エンティティからグラフを探索
    const searchResults: GraphSearchResult[] = [];
    
    for (const entity of queryEntities) {
      const result = await this.exploreFromEntity(entity, {
        maxDepth,
        maxResults,
        nodeTypes,
        relationships,
        minRelevanceScore
      });
      searchResults.push(result);
    }

    // 結果を統合
    const mergedResult = this.mergeSearchResults(searchResults, query);
    
    console.log(`✅ 検索完了: ${mergedResult.entities.length}エンティティ, ${mergedResult.paths.length}パス`);
    
    return mergedResult;
  }

  /**
   * クエリからエンティティを抽出
   */
  private extractQueryEntities(query: string): string[] {
    // 簡単なエンティティ抽出（実際の実装ではより高度なNLPを使用）
    const entities: string[] = [];
    
    // 既知のドメイン名を検索
    const domainNames = this.findMatchingNodes('Function', query);
    entities.push(...domainNames.map(n => n.name));

    // 既知のキーワードを検索
    const keywords = this.findMatchingNodes('Keyword', query);
    entities.push(...keywords.map(n => n.name));

    // 既知のシステム項目を検索
    const systemItems = this.findMatchingNodes('SystemItem', query);
    entities.push(...systemItems.map(n => n.name));

    return [...new Set(entities)]; // 重複を削除
  }

  /**
   * 指定されたタイプのノードからクエリにマッチするものを検索
   */
  private findMatchingNodes(type: string, query: string): GraphNode[] {
    if (!this.graphData) return [];

    return this.graphData.nodes.filter(node => {
      if (node.type !== type) return false;
      
      // 部分一致で検索
      return node.name.toLowerCase().includes(query.toLowerCase()) ||
             query.toLowerCase().includes(node.name.toLowerCase());
    });
  }

  /**
   * エンティティからグラフを探索
   */
  private async exploreFromEntity(
    entity: string,
    options: SearchOptions
  ): Promise<GraphSearchResult> {
    const { maxDepth, maxResults, nodeTypes, relationships: relationshipTypes, minRelevanceScore } = options;
    
    // エンティティにマッチするノードを検索
    const startNodes = this.findNodesByName(entity);
    
    if (startNodes.length === 0) {
      return {
        entities: [],
        relationships: [],
        paths: [],
        relevanceScore: 0,
        query: entity
      };
    }

    const visited = new Set<string>();
    const entities: GraphNode[] = [];
    const relationships: GraphEdge[] = [];
    const paths: GraphPath[] = [];

    // BFSでグラフを探索
    for (const startNode of startNodes) {
      const queue: { node: GraphNode; depth: number; path: GraphNode[] }[] = [
        { node: startNode, depth: 0, path: [startNode] }
      ];

      while (queue.length > 0) {
        const { node, depth, path } = queue.shift()!;

        if (visited.has(node.id) || depth > maxDepth) continue;
        visited.add(node.id);

        // ノードタイプフィルタ
        if (nodeTypes.length > 0 && !nodeTypes.includes(node.type)) continue;

        entities.push(node);

        // 隣接ノードを取得
        const neighbors = this.adjacencyList.get(node.id) || [];
        
        for (const neighborId of neighbors) {
          const neighbor = this.nodeMap.get(neighborId);
          if (!neighbor || visited.has(neighborId)) continue;

          // エッジを取得
          const edges = this.edgeMap.get(node.id) || [];
          const edge = edges.find(e => e.target === neighborId);
          
          if (!edge) continue;

          // 関係性フィルタ
          if (relationshipTypes.length > 0 && !relationshipTypes.includes(edge.relationship)) continue;

          relationships.push(edge);

          // 関連性スコアを計算
          const relevanceScore = this.calculateRelevanceScore(entity, neighbor, edge);
          
          if (relevanceScore >= minRelevanceScore) {
            const newPath = [...path, neighbor];
            paths.push({
              nodes: newPath,
              edges: edges.filter(e => newPath.some(n => n.id === e.target)),
              length: newPath.length,
              relevanceScore
            });

            queue.push({
              node: neighbor,
              depth: depth + 1,
              path: newPath
            });
          }
        }
      }
    }

    // 結果をソート
    entities.sort((a, b) => this.calculateNodeRelevance(entity, b) - this.calculateNodeRelevance(entity, a));
    paths.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      entities: entities.slice(0, maxResults),
      relationships: relationships.slice(0, maxResults * 2),
      paths: paths.slice(0, maxResults),
      relevanceScore: this.calculateOverallRelevance(entity, entities),
      query: entity
    };
  }

  /**
   * ノード名でノードを検索
   */
  private findNodesByName(name: string): GraphNode[] {
    if (!this.graphData) return [];

    return this.graphData.nodes.filter(node => 
      node.name.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(node.name.toLowerCase())
    );
  }

  /**
   * 関連性スコアを計算
   */
  private calculateRelevanceScore(query: string, node: GraphNode, edge: GraphEdge): number {
    let score = 0;

    // ノードタイプによる重み付け
    const typeWeights: Record<string, number> = {
      'Function': 1.0,
      'SystemItem': 0.8,
      'Keyword': 0.6,
      'Page': 0.9,
      'Label': 0.4
    };

    score += typeWeights[node.type] || 0.5;

    // 関係性による重み付け
    const relationshipWeights: Record<string, number> = {
      'DESCRIBES': 1.0,
      'CONTAINS': 0.9,
      'ASSOCIATED_WITH': 0.8,
      'RELATES_TO': 0.7,
      'TAGGED_WITH': 0.6
    };

    score += relationshipWeights[edge.relationship] || 0.5;

    // 名前の一致度
    const nameMatch = this.calculateNameMatch(query, node.name);
    score += nameMatch * 0.3;

    return Math.min(score, 1.0);
  }

  /**
   * ノードの関連性を計算
   */
  private calculateNodeRelevance(query: string, node: GraphNode): number {
    let score = 0;

    // 名前の一致度
    score += this.calculateNameMatch(query, node.name);

    // ノードタイプによる重み付け
    const typeWeights: Record<string, number> = {
      'Function': 1.0,
      'SystemItem': 0.8,
      'Keyword': 0.6,
      'Page': 0.9,
      'Label': 0.4
    };

    score += typeWeights[node.type] || 0.5;

    return Math.min(score, 1.0);
  }

  /**
   * 名前の一致度を計算
   */
  private calculateNameMatch(query: string, name: string): number {
    const queryLower = query.toLowerCase();
    const nameLower = name.toLowerCase();

    if (queryLower === nameLower) return 1.0;
    if (nameLower.includes(queryLower)) return 0.8;
    if (queryLower.includes(nameLower)) return 0.6;

    // 部分一致
    const queryWords = queryLower.split(/\s+/);
    const nameWords = nameLower.split(/\s+/);
    
    let matchCount = 0;
    for (const queryWord of queryWords) {
      if (nameWords.some(nameWord => nameWord.includes(queryWord) || queryWord.includes(nameWord))) {
        matchCount++;
      }
    }

    return matchCount / queryWords.length;
  }

  /**
   * 全体の関連性を計算
   */
  private calculateOverallRelevance(query: string, entities: GraphNode[]): number {
    if (entities.length === 0) return 0;

    const totalRelevance = entities.reduce((sum, entity) => 
      sum + this.calculateNodeRelevance(query, entity), 0
    );

    return totalRelevance / entities.length;
  }

  /**
   * 検索結果を統合
   */
  private mergeSearchResults(results: GraphSearchResult[], query: string): GraphSearchResult {
    const entityMap = new Map<string, GraphNode>();
    const relationshipMap = new Map<string, GraphEdge>();
    const pathMap = new Map<string, GraphPath>();

    // エンティティを統合
    for (const result of results) {
      for (const entity of result.entities) {
        if (!entityMap.has(entity.id)) {
          entityMap.set(entity.id, entity);
        }
      }

      // 関係性を統合
      for (const relationship of result.relationships) {
        const key = `${relationship.source}-${relationship.target}-${relationship.relationship}`;
        if (!relationshipMap.has(key)) {
          relationshipMap.set(key, relationship);
        }
      }

      // パスを統合
      for (const path of result.paths) {
        const key = path.nodes.map(n => n.id).join('-');
        if (!pathMap.has(key)) {
          pathMap.set(key, path);
        }
      }
    }

    const entities = Array.from(entityMap.values());
    const relationships = Array.from(relationshipMap.values());
    const paths = Array.from(pathMap.values());

    // 関連性でソート
    entities.sort((a, b) => this.calculateNodeRelevance(query, b) - this.calculateNodeRelevance(query, a));
    paths.sort((a, b) => b.relevanceScore - a.relevanceScore);

    return {
      entities,
      relationships,
      paths,
      relevanceScore: this.calculateOverallRelevance(query, entities),
      query
    };
  }

  /**
   * 特定の機能に関連するページを検索
   */
  async findRelatedPages(functionName: string): Promise<GraphNode[]> {
    const result = await this.searchGraph(functionName, {
      nodeTypes: ['Page'],
      maxDepth: 2
    });

    return result.entities.filter(entity => entity.type === 'Page');
  }

  /**
   * 特定のページに関連する機能を検索
   */
  async findRelatedFunctions(pageId: string): Promise<GraphNode[]> {
    const result = await this.searchGraph(pageId, {
      nodeTypes: ['Function'],
      maxDepth: 2
    });

    return result.entities.filter(entity => entity.type === 'Function');
  }

  /**
   * グラフの統計情報を取得
   */
  getGraphStats(): any {
    if (!this.graphData) return null;

    return {
      ...this.graphData.metadata,
      averageConnections: this.graphData.metadata.totalEdges / this.graphData.metadata.totalNodes,
      nodeTypeDistribution: this.graphData.metadata.nodeTypes
    };
  }
}

// GraphSearchClient is already exported above
