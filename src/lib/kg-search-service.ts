/**
 * Knowledge Graph検索サービス（Phase 0A-2）
 */

import type { KGNode, KGEdge, KGSearchResult } from '@/types/knowledge-graph';
import { kgStorageService } from './kg-storage-service';

/**
 * Knowledge Graph検索サービス
 */
export class KGSearchService {
  /**
   * ページの関連ページを取得（1-hopのみ）
   */
  async getRelatedPages(
    pageId: string,
    options: {
      maxResults?: number;
      minWeight?: number;
      edgeTypes?: KGEdge['type'][];
    } = {}
  ): Promise<KGSearchResult> {
    const {
      maxResults = 5,
      minWeight = 0.5,
      edgeTypes
    } = options;
    
    // メインノードを取得
    const mainNode = await kgStorageService.getNode(`page-${pageId}`);
    
    if (!mainNode) {
      return {
        mainPage: {
          id: `page-${pageId}`,
          type: 'page',
          name: 'Unknown',
          pageId
        },
        relatedPages: []
      };
    }
    
    // 出ていくエッジを取得
    const outgoingEdges = await kgStorageService.getOutgoingEdges(`page-${pageId}`);
    
    // フィルタリング
    let filteredEdges = outgoingEdges.filter(edge => edge.weight >= minWeight);
    
    if (edgeTypes && edgeTypes.length > 0) {
      filteredEdges = filteredEdges.filter(edge => edgeTypes.includes(edge.type));
    }
    
    // 重みでソート
    filteredEdges.sort((a, b) => b.weight - a.weight);
    
    // 上位N件を取得
    const topEdges = filteredEdges.slice(0, maxResults);
    
    // 関連ノードを取得
    const relatedNodeIds = topEdges.map(edge => edge.to);
    const relatedNodesMap = await kgStorageService.getNodes(relatedNodeIds);
    
    // 結果を構築
    const relatedPages = topEdges.map(edge => {
      const node = relatedNodesMap.get(edge.to);
      
      if (!node) {
        return null;
      }
      
      return {
        node,
        edge,
        relevanceScore: edge.weight
      };
    }).filter(Boolean) as KGSearchResult['relatedPages'];
    
    return {
      mainPage: mainNode,
      relatedPages
    };
  }
  
  /**
   * エッジタイプ別の関連ページを取得
   */
  async getRelatedPagesByType(
    pageId: string,
    edgeType: KGEdge['type']
  ): Promise<Array<{ node: KGNode; edge: KGEdge }>> {
    const result = await this.getRelatedPages(pageId, {
      maxResults: 10,
      edgeTypes: [edgeType]
    });
    
    return result.relatedPages.map(({ node, edge }) => ({ node, edge }));
  }
  
  /**
   * ドメイン内の関連ページを取得
   */
  async getRelatedPagesInDomain(
    pageId: string,
    maxResults: number = 5
  ): Promise<KGSearchResult> {
    return this.getRelatedPages(pageId, {
      maxResults,
      edgeTypes: ['related'],
      minWeight: 0.5
    });
  }
  
  /**
   * 参照先ページを取得
   */
  async getReferencedPages(
    pageId: string,
    maxResults: number = 5
  ): Promise<KGSearchResult> {
    return this.getRelatedPages(pageId, {
      maxResults,
      edgeTypes: ['reference', 'implements'],
      minWeight: 0.7
    });
  }
}

export const kgSearchService = new KGSearchService();

