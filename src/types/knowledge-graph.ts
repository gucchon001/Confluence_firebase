/**
 * Knowledge Graph型定義（Phase 0A-2）
 */

import type { StructuredLabel } from './structured-label';

/**
 * ノードタイプ
 */
export type KGNodeType = 
  | 'page'        // Confluenceページ
  | 'domain'      // ドメイン（会員管理、求人管理等）
  | 'category'    // カテゴリ（spec、data等）
  | 'feature';    // 機能（教室コピー機能等）

/**
 * エッジタイプ
 */
export type KGEdgeType = 
  | 'reference'      // 参照関係（164 → 177）
  | 'related'        // 同一ドメイン・タグの関連
  | 'implements'     // 実装関係（168 → データ定義）
  | 'prerequisite'   // 前提条件
  | 'domain'         // ドメイン所属
  | 'category';      // カテゴリ所属

/**
 * Knowledge Graphノード
 */
export interface KGNode {
  /**
   * ノードID（例: "page-164", "domain-会員管理"）
   */
  id: string;
  
  /**
   * ノードタイプ
   */
  type: KGNodeType;
  
  /**
   * ノード名（表示用）
   */
  name: string;
  
  /**
   * pageId（ページノードの場合）
   */
  pageId?: string;
  
  /**
   * StructuredLabel（ページノードの場合）
   */
  structuredLabel?: StructuredLabel;
  
  /**
   * 重要度スコア（PageRank等）
   */
  importance?: number;
  
  /**
   * 追加プロパティ
   */
  properties?: Record<string, any>;
}

/**
 * Knowledge Graphエッジ
 */
export interface KGEdge {
  /**
   * エッジID
   */
  id: string;
  
  /**
   * 始点ノードID
   */
  from: string;
  
  /**
   * 終点ノードID
   */
  to: string;
  
  /**
   * エッジタイプ
   */
  type: KGEdgeType;
  
  /**
   * 重み（0.0 - 1.0）
   */
  weight: number;
  
  /**
   * 抽出元
   */
  extractedFrom: 'content' | 'structured-label' | 'manual';
  
  /**
   * 抽出時のメタデータ
   */
  metadata?: {
    /**
     * コンテンツ抽出時の一致パターン
     */
    matchPattern?: string;
    
    /**
     * タグ類似度（tag-basedの場合）
     */
    tagSimilarity?: number;
    
    /**
     * ドメイン（domain-basedの場合）
     */
    domain?: string;
  };
}

/**
 * Knowledge Graph検索結果
 */
export interface KGSearchResult {
  /**
   * メインページ
   */
  mainPage: KGNode;
  
  /**
   * 関連ページ（重要度順）
   */
  relatedPages: Array<{
    node: KGNode;
    edge: KGEdge;
    relevanceScore: number;
  }>;
  
  /**
   * グラフパス（メイン → 関連）
   */
  paths?: Array<{
    nodes: KGNode[];
    edges: KGEdge[];
    pathWeight: number;
  }>;
}

