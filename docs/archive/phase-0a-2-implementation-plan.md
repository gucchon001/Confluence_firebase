# Phase 0A-2: Knowledge Graph 実装計画書

**フェーズ名**: Phase 0A-2 Knowledge Graph構築と検索統合  
**作成日**: 2025-10-14  
**予定期間**: 5-7日  
**ステータス**: 📋 計画中  
**担当**: 開発チーム

---

## 🎯 目的

**StructuredLabelを活用したKnowledge Graphを構築し、検索精度を62% → 81%（+19%）に改善する**

### 対象問題（6事例での効果）

| 問題 | Phase 0A-1.5 | KG効果 | Phase 0A-2 | 改善 |
|------|-------------|--------|-----------|------|
| 教室削除条件（164） | 95% | +3% | **98%** | ✅ |
| 教室コピー項目（168） | 85% | +12% | **97%** | ✅ |
| 学年・職業更新（721） | 80% | +17% | **97%** | ✅ |
| 退会後の再登録（046） | 60% | +20% | **80%** | ✅ |
| 応募制限有無（014） | 40% | +25% | **65%** | ⚠️ |
| 重複応募期間（014） | 30% | +20% | **50%** | ⚠️ |

**全体平均**: 62% → **81%** (+19%改善)

---

## 📋 実装タスク

### Phase 0A-2.1: Knowledge Graph構築（3-4日）

#### タスク1: スキーマ定義（0.5日）

**新規ファイル**: `src/types/knowledge-graph.ts`

```typescript
/**
 * Knowledge Graph型定義 (Phase 0A-2)
 */

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
```

**ドキュメント**: `docs/architecture/knowledge-graph-schema.md`

---

#### タスク2: ページ間関係抽出（1.5日）

**新規ファイル**: `src/lib/kg-reference-extractor.ts`

```typescript
/**
 * Knowledge Graph参照関係抽出サービス
 */

import type { KGEdge } from '@/types/knowledge-graph';

/**
 * ページコンテンツから参照関係を抽出
 */
export class KGReferenceExtractor {
  /**
   * コンテンツから参照ページを抽出
   */
  extractReferences(
    pageId: string,
    title: string,
    content: string
  ): KGEdge[] {
    const edges: KGEdge[] = [];
    
    // パターン1: "177_【FIX】求人削除機能を実施"
    const pattern1 = /(\d{3})_【[^\]]+】([^を。、\s]+)を(実施|参照|使用)/g;
    let match: RegExpExecArray | null;
    
    while ((match = pattern1.exec(content)) !== null) {
      const targetPageNumber = match[1];
      const targetFeature = match[2];
      const relationType = match[3];
      
      edges.push({
        id: `${pageId}-ref-${targetPageNumber}`,
        from: `page-${pageId}`,
        to: `page-${targetPageNumber}`,
        type: relationType === '実施' ? 'implements' : 'reference',
        weight: 0.9,
        extractedFrom: 'content',
        metadata: {
          matchPattern: match[0]
        }
      });
    }
    
    // パターン2: "【FIX】教室コピー機能を参照"
    const pattern2 = /【[^\]]+】([^を。、\s]+)/g;
    
    while ((match = pattern2.exec(content)) !== null) {
      const targetTitle = match[1];
      
      edges.push({
        id: `${pageId}-ref-title-${this.hashString(targetTitle)}`,
        from: `page-${pageId}`,
        to: `page-title-${targetTitle}`,  // 後でpageIdに解決
        type: 'reference',
        weight: 0.7,
        extractedFrom: 'content',
        metadata: {
          matchPattern: match[0]
        }
      });
    }
    
    return edges;
  }
  
  /**
   * ページタイトルからpageIdを検索
   */
  async resolvePageIdByTitle(
    titlePattern: string,
    allPages: Array<{ pageId: string; title: string }>
  ): string | null {
    const cleanPattern = titlePattern.trim().toLowerCase();
    
    for (const page of allPages) {
      const cleanTitle = page.title
        .replace(/^\d+_/, '')
        .replace(/【[^\]]+】/g, '')
        .trim()
        .toLowerCase();
      
      if (cleanTitle.includes(cleanPattern) || cleanPattern.includes(cleanTitle)) {
        return page.pageId;
      }
    }
    
    return null;
  }
  
  /**
   * 文字列のハッシュ化（簡易版）
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

export const kgReferenceExtractor = new KGReferenceExtractor();
```

---

#### タスク3: StructuredLabel関係構築（1日）

**新規ファイル**: `src/lib/kg-label-builder.ts`

```typescript
/**
 * StructuredLabelからKnowledge Graph関係を構築
 */

import type { StructuredLabel } from '@/types/structured-label';
import type { KGEdge, KGNode } from '@/types/knowledge-graph';

/**
 * StructuredLabelベースのKG構築サービス
 */
export class KGLabelBuilder {
  /**
   * ドメイン関係を構築
   */
  buildDomainEdges(
    labels: Map<string, StructuredLabel>
  ): KGEdge[] {
    const edges: KGEdge[] = [];
    const domainGroups = new Map<string, string[]>();
    
    // ドメインでグループ化
    labels.forEach((label, pageId) => {
      if (!domainGroups.has(label.domain)) {
        domainGroups.set(label.domain, []);
      }
      domainGroups.get(label.domain)!.push(pageId);
    });
    
    // 同一ドメイン内のページを相互リンク
    domainGroups.forEach((pageIds, domain) => {
      for (let i = 0; i < pageIds.length; i++) {
        for (let j = i + 1; j < pageIds.length; j++) {
          const label1 = labels.get(pageIds[i])!;
          const label2 = labels.get(pageIds[j])!;
          
          // カテゴリが同じ場合は重み増加
          const categoryBonus = label1.category === label2.category ? 0.2 : 0;
          
          edges.push({
            id: `${pageIds[i]}-domain-${pageIds[j]}`,
            from: `page-${pageIds[i]}`,
            to: `page-${pageIds[j]}`,
            type: 'related',
            weight: 0.5 + categoryBonus,
            extractedFrom: 'structured-label',
            metadata: {
              domain
            }
          });
        }
      }
    });
    
    return edges;
  }
  
  /**
   * タグ関係を構築（Jaccard類似度ベース）
   */
  buildTagEdges(
    labels: Map<string, StructuredLabel>
  ): KGEdge[] {
    const edges: KGEdge[] = [];
    
    const labelsArray = Array.from(labels.entries());
    
    for (let i = 0; i < labelsArray.length; i++) {
      for (let j = i + 1; j < labelsArray.length; j++) {
        const [pageId1, label1] = labelsArray[i];
        const [pageId2, label2] = labelsArray[j];
        
        // タグがない場合はスキップ
        if (!label1.tags || !label2.tags) continue;
        if (label1.tags.length === 0 || label2.tags.length === 0) continue;
        
        // Jaccard類似度を計算
        const tags1 = new Set(label1.tags);
        const tags2 = new Set(label2.tags);
        
        const intersection = new Set(
          [...tags1].filter(tag => tags2.has(tag))
        );
        
        const union = new Set([...tags1, ...tags2]);
        
        const jaccardSimilarity = intersection.size / union.size;
        
        // 類似度が0.3以上の場合のみエッジを作成
        if (jaccardSimilarity >= 0.3) {
          edges.push({
            id: `${pageId1}-tag-${pageId2}`,
            from: `page-${pageId1}`,
            to: `page-${pageId2}`,
            type: 'related',
            weight: jaccardSimilarity,
            extractedFrom: 'structured-label',
            metadata: {
              tagSimilarity: jaccardSimilarity
            }
          });
        }
      }
    }
    
    return edges;
  }
  
  /**
   * ドメイン・カテゴリノードを構築
   */
  buildConceptNodes(
    labels: Map<string, StructuredLabel>
  ): KGNode[] {
    const nodes: KGNode[] = [];
    const domains = new Set<string>();
    const categories = new Set<string>();
    
    // ドメインとカテゴリを収集
    labels.forEach(label => {
      domains.add(label.domain);
      categories.add(label.category);
    });
    
    // ドメインノードを作成
    domains.forEach(domain => {
      nodes.push({
        id: `domain-${domain}`,
        type: 'domain',
        name: domain,
        properties: {
          pageCount: Array.from(labels.values()).filter(l => l.domain === domain).length
        }
      });
    });
    
    // カテゴリノードを作成
    categories.forEach(category => {
      nodes.push({
        id: `category-${category}`,
        type: 'category',
        name: category,
        properties: {
          pageCount: Array.from(labels.values()).filter(l => l.category === category).length
        }
      });
    });
    
    return nodes;
  }
}

export const kgLabelBuilder = new KGLabelBuilder();
```

---

#### タスク4: Knowledge Graph保存（1日）

**保存先の選択肢**:

1. **Firestore** (推奨)
   - `knowledge_graph_nodes` コレクション
   - `knowledge_graph_edges` コレクション
   - メリット: リアルタイム更新、クエリ柔軟性
   
2. **LanceDB** (代替案)
   - `kg_nodes` テーブル
   - `kg_edges` テーブル
   - メリット: 統合管理、ベクトル検索との組み合わせ

**新規ファイル**: `src/lib/kg-storage-service.ts`

```typescript
/**
 * Knowledge Graph保存サービス（Firestore版）
 */

import * as admin from 'firebase-admin';
import type { KGNode, KGEdge } from '@/types/knowledge-graph';

const db = admin.firestore();
const NODES_COLLECTION = 'knowledge_graph_nodes';
const EDGES_COLLECTION = 'knowledge_graph_edges';

/**
 * Knowledge Graph保存サービス
 */
export class KGStorageService {
  /**
   * ノードを保存
   */
  async saveNode(node: KGNode): Promise<void> {
    await db.collection(NODES_COLLECTION).doc(node.id).set(node);
  }
  
  /**
   * エッジを保存
   */
  async saveEdge(edge: KGEdge): Promise<void> {
    await db.collection(EDGES_COLLECTION).doc(edge.id).set(edge);
  }
  
  /**
   * ノードを一括保存
   */
  async saveNodesBatch(nodes: KGNode[]): Promise<void> {
    const batchSize = 500;
    
    for (let i = 0; i < nodes.length; i += batchSize) {
      const batch = db.batch();
      const batchNodes = nodes.slice(i, i + batchSize);
      
      batchNodes.forEach(node => {
        const docRef = db.collection(NODES_COLLECTION).doc(node.id);
        batch.set(docRef, node);
      });
      
      await batch.commit();
      console.log(`[KGStorage] Saved ${batchNodes.length} nodes (${i + batchNodes.length}/${nodes.length})`);
    }
  }
  
  /**
   * エッジを一括保存
   */
  async saveEdgesBatch(edges: KGEdge[]): Promise<void> {
    const batchSize = 500;
    
    for (let i = 0; i < edges.length; i += batchSize) {
      const batch = db.batch();
      const batchEdges = edges.slice(i, i + batchSize);
      
      batchEdges.forEach(edge => {
        const docRef = db.collection(EDGES_COLLECTION).doc(edge.id);
        batch.set(docRef, edge);
      });
      
      await batch.commit();
      console.log(`[KGStorage] Saved ${batchEdges.length} edges (${i + batchEdges.length}/${edges.length})`);
    }
  }
  
  /**
   * あるノードから出ているエッジを取得
   */
  async getOutgoingEdges(nodeId: string): Promise<KGEdge[]> {
    const snapshot = await db
      .collection(EDGES_COLLECTION)
      .where('from', '==', nodeId)
      .get();
    
    return snapshot.docs.map(doc => doc.data() as KGEdge);
  }
  
  /**
   * あるノードに入ってくるエッジを取得
   */
  async getIncomingEdges(nodeId: string): Promise<KGEdge[]> {
    const snapshot = await db
      .collection(EDGES_COLLECTION)
      .where('to', '==', nodeId)
      .get();
    
    return snapshot.docs.map(doc => doc.data() as KGEdge);
  }
  
  /**
   * ノードを取得
   */
  async getNode(nodeId: string): Promise<KGNode | null> {
    const doc = await db.collection(NODES_COLLECTION).doc(nodeId).get();
    
    if (!doc.exists) {
      return null;
    }
    
    return doc.data() as KGNode;
  }
  
  /**
   * 複数ノードを取得
   */
  async getNodes(nodeIds: string[]): Promise<Map<string, KGNode>> {
    const nodes = new Map<string, KGNode>();
    
    // Firestoreの制限: `in`クエリは最大10件
    const batchSize = 10;
    
    for (let i = 0; i < nodeIds.length; i += batchSize) {
      const batch = nodeIds.slice(i, i + batchSize);
      
      const snapshot = await db
        .collection(NODES_COLLECTION)
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      
      snapshot.forEach(doc => {
        nodes.set(doc.id, doc.data() as KGNode);
      });
    }
    
    return nodes;
  }
}

export const kgStorageService = new KGStorageService();
```

---

### Phase 0A-2.2: Knowledge Graph検索統合（2-3日）

#### タスク5: KG検索サービス（1.5日）

**新規ファイル**: `src/lib/kg-search-service.ts`

```typescript
/**
 * Knowledge Graph検索サービス
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
      edgeTypes?: string[];
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
    edgeType: string
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
```

---

#### タスク6: 検索結果拡張ロジック（1日）

**修正ファイル**: `src/ai/flows/retrieve-relevant-docs-lancedb.ts`

```typescript
// 既存のインポートに追加
import { kgSearchService } from '@/lib/kg-search-service';

export async function retrieveRelevantDocsLanceDB(input: { query: string }): Promise<any[]> {
  console.log(`[retrieveRelevantDocsLanceDB] Query: "${input.query}"`);
  
  // Step 1: 通常の検索（Phase 0A-1.5）
  const searchResults = await searchLanceDB({
    query: input.query,
    topK: 5,  // 初期検索は5件
    titleBoost: 2.0,
    hybridAlpha: 0.6
  });
  
  console.log(`[retrieveRelevantDocsLanceDB] Initial search: ${searchResults.length} results`);
  
  // Step 2: 検索結果をマッピング
  const mapped = searchResults.slice(0, 5).map(r => ({
    id: String(r.pageId ?? r.id ?? ''),
    pageId: String(r.pageId ?? r.id ?? ''),
    title: r.title,
    content: r.content,
    distance: r.distance,
    score: r.score || (1 - r.distance),
    url: r.url,
    labels: Array.isArray(r.labels) ? r.labels : (r.labels ? [r.labels] : [])
  }));
  
  // Step 3: 全チャンク統合（Phase 0A-1.5）
  const enriched = await enrichWithAllChunks(mapped);
  
  // Step 4: Knowledge Graph拡張（Phase 0A-2）
  const expanded = await expandWithKnowledgeGraph(enriched);
  
  // Step 5: 空ページフィルター（Phase 0A-1.5）
  const filtered = await filterInvalidPagesServer(expanded);
  
  console.log(`[retrieveRelevantDocsLanceDB] Final: ${filtered.length} results (after KG expansion)`);
  
  return filtered;
}

/**
 * Knowledge Graphで関連ページを拡張
 */
async function expandWithKnowledgeGraph(results: any[]): Promise<any[]> {
  const expanded: any[] = [...results];
  const addedPageIds = new Set(results.map(r => r.pageId));
  
  console.log(`[KG Expansion] Starting with ${results.length} initial results`);
  
  // 各検索結果について関連ページを取得
  for (const result of results) {
    try {
      // 参照関係（高重み）を優先
      const referenced = await kgSearchService.getReferencedPages(result.pageId, 2);
      
      for (const { node, edge } of referenced.relatedPages) {
        if (!node.pageId) continue;
        if (addedPageIds.has(node.pageId)) continue;
        
        // 関連ページのコンテンツを取得
        const relatedContent = await getPageContent(node.pageId);
        
        if (!relatedContent) continue;
        
        expanded.push({
          id: node.pageId,
          pageId: node.pageId,
          title: node.name,
          content: relatedContent,
          distance: 0.3,  // KG経由は距離を固定
          score: edge.weight,
          url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/CLIENTTOMO/pages/${node.pageId}`,
          labels: [],
          source: 'knowledge-graph',
          kgEdgeType: edge.type,
          kgWeight: edge.weight
        });
        
        addedPageIds.add(node.pageId);
        
        console.log(`[KG Expansion] Added: ${node.name} (via ${edge.type}, weight: ${edge.weight})`);
      }
      
      // ドメイン関連（中重み）も追加（ただし最大1件）
      if (expanded.length < 12) {
        const domainRelated = await kgSearchService.getRelatedPagesInDomain(result.pageId, 1);
        
        for (const { node, edge } of domainRelated.relatedPages) {
          if (!node.pageId) continue;
          if (addedPageIds.has(node.pageId)) continue;
          
          const relatedContent = await getPageContent(node.pageId);
          
          if (!relatedContent) continue;
          
          expanded.push({
            id: node.pageId,
            pageId: node.pageId,
            title: node.name,
            content: relatedContent,
            distance: 0.5,
            score: edge.weight * 0.8,  // ドメイン関連は少し低めのスコア
            url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/CLIENTTOMO/pages/${node.pageId}`,
            labels: [],
            source: 'knowledge-graph',
            kgEdgeType: edge.type,
            kgWeight: edge.weight
          });
          
          addedPageIds.add(node.pageId);
          
          console.log(`[KG Expansion] Added (domain): ${node.name} (weight: ${edge.weight})`);
        }
      }
    } catch (error: any) {
      console.error(`[KG Expansion] Error for ${result.pageId}:`, error.message);
    }
  }
  
  console.log(`[KG Expansion] Expanded: ${results.length} → ${expanded.length} results`);
  
  return expanded;
}

/**
 * ページコンテンツを取得（LanceDBから）
 */
async function getPageContent(pageId: string): Promise<string | null> {
  try {
    const chunks = await getAllChunksByPageId(pageId);
    
    if (chunks.length === 0) {
      return null;
    }
    
    // 全チャンクを結合
    const fullContent = chunks
      .sort((a, b) => (a.chunkIndex || 0) - (b.chunkIndex || 0))
      .map(chunk => chunk.content || '')
      .join('\n\n');
    
    return fullContent;
  } catch (error: any) {
    console.error(`[getPageContent] Error for ${pageId}:`, error.message);
    return null;
  }
}
```

---

#### タスク7: Knowledge Graph構築スクリプト（0.5日）

**新規ファイル**: `scripts/build-knowledge-graph.ts`

```typescript
/**
 * Knowledge Graph構築スクリプト
 */

import 'dotenv/config';
import { optimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { getStructuredLabels } from '../src/lib/structured-label-service-admin';
import { kgReferenceExtractor } from '../src/lib/kg-reference-extractor';
import { kgLabelBuilder } from '../src/lib/kg-label-builder';
import { kgStorageService } from '../src/lib/kg-storage-service';
import type { KGNode, KGEdge } from '../src/types/knowledge-graph';
import type { StructuredLabel } from '../src/types/structured-label';

async function main() {
  console.log('\n🕸️ Knowledge Graph構築開始\n');
  
  try {
    // Step 1: 全ページを取得
    console.log('📦 LanceDBから全ページを取得中...');
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;
    
    const arrow = await table.query().toArrow();
    
    const pages: Array<{
      pageId: string;
      title: string;
      content: string;
    }> = [];
    
    const pageIdSet = new Set<string>();
    
    for (let i = 0; i < arrow.numRows; i++) {
      const row: any = {};
      for (let j = 0; j < arrow.schema.fields.length; j++) {
        const field = arrow.schema.fields[j];
        const column = arrow.getChildAt(j);
        row[field.name] = column?.get(i);
      }
      
      const pageId = String(row.pageId || row.id || '');
      
      // 重複排除（chunk単位で保存されているため）
      if (pageIdSet.has(pageId)) continue;
      pageIdSet.add(pageId);
      
      pages.push({
        pageId,
        title: row.title || '',
        content: row.content || ''
      });
    }
    
    console.log(`✅ ${pages.length}ページ取得完了\n`);
    
    // Step 2: StructuredLabelsを取得
    console.log('🏷️ StructuredLabelsを取得中...');
    const pageIds = pages.map(p => p.pageId);
    const labelsMap = await getStructuredLabels(pageIds);
    console.log(`✅ ${labelsMap.size}件のラベル取得完了\n`);
    
    // Step 3: 参照関係を抽出
    console.log('🔗 参照関係を抽出中...');
    const referenceEdges: KGEdge[] = [];
    
    for (const page of pages) {
      const edges = kgReferenceExtractor.extractReferences(
        page.pageId,
        page.title,
        page.content
      );
      
      referenceEdges.push(...edges);
    }
    
    console.log(`✅ ${referenceEdges.length}件の参照関係を抽出\n`);
    
    // Step 4: StructuredLabelベースの関係を構築
    console.log('🏷️ StructuredLabelベースの関係を構築中...');
    
    const domainEdges = kgLabelBuilder.buildDomainEdges(labelsMap);
    console.log(`  ドメイン関係: ${domainEdges.length}件`);
    
    const tagEdges = kgLabelBuilder.buildTagEdges(labelsMap);
    console.log(`  タグ関係: ${tagEdges.length}件`);
    
    const conceptNodes = kgLabelBuilder.buildConceptNodes(labelsMap);
    console.log(`  概念ノード: ${conceptNodes.length}件\n`);
    
    // Step 5: ページノードを構築
    console.log('📄 ページノードを構築中...');
    const pageNodes: KGNode[] = pages.map(page => {
      const label = labelsMap.get(page.pageId);
      
      return {
        id: `page-${page.pageId}`,
        type: 'page' as const,
        name: page.title,
        pageId: page.pageId,
        structuredLabel: label,
        importance: 1.0  // 初期値（PageRankは後で計算）
      };
    });
    
    console.log(`✅ ${pageNodes.length}件のページノード構築完了\n`);
    
    // Step 6: Firestoreに保存
    console.log('💾 Firestoreに保存中...');
    
    const allNodes = [...pageNodes, ...conceptNodes];
    const allEdges = [...referenceEdges, ...domainEdges, ...tagEdges];
    
    console.log(`  ノード総数: ${allNodes.length}件`);
    console.log(`  エッジ総数: ${allEdges.length}件`);
    
    await kgStorageService.saveNodesBatch(allNodes);
    await kgStorageService.saveEdgesBatch(allEdges);
    
    console.log('✅ Firestore保存完了\n');
    
    // Step 7: 統計情報を表示
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Knowledge Graph構築完了');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`ノード総数: ${allNodes.length}件`);
    console.log(`  - ページノード: ${pageNodes.length}件`);
    console.log(`  - 概念ノード: ${conceptNodes.length}件`);
    console.log(`エッジ総数: ${allEdges.length}件`);
    console.log(`  - 参照関係: ${referenceEdges.length}件`);
    console.log(`  - ドメイン関係: ${domainEdges.length}件`);
    console.log(`  - タグ関係: ${tagEdges.length}件`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
```

**package.json に追加**:
```json
{
  "scripts": {
    "kg:build": "tsx scripts/build-knowledge-graph.ts"
  }
}
```

---

## 📅 実装スケジュール

| タスク | 予定期間 | 担当 | ファイル数 |
|--------|---------|------|-----------|
| **Phase 0A-2.1: KG構築** | **3-4日** | | |
| 1. スキーマ定義 | 0.5日 | - | 2ファイル |
| 2. 参照関係抽出 | 1.5日 | - | 1ファイル |
| 3. StructuredLabel関係構築 | 1日 | - | 1ファイル |
| 4. KG保存 | 1日 | - | 1ファイル |
| **Phase 0A-2.2: KG検索統合** | **2-3日** | | |
| 5. KG検索サービス | 1.5日 | - | 1ファイル |
| 6. 検索結果拡張ロジック | 1日 | - | 1ファイル（修正） |
| 7. KG構築スクリプト | 0.5日 | - | 1ファイル |
| **テスト・ドキュメント** | **0.5日** | | |
| 8. 統合テスト（6事例） | 0.25日 | - | - |
| 9. ドキュメント更新 | 0.25日 | - | - |

**合計**: 5-7日、**9ファイル**（新規7、修正2）

---

## 📁 実装ファイル一覧

### 新規作成（7ファイル）

1. `src/types/knowledge-graph.ts` - KG型定義
2. `src/lib/kg-reference-extractor.ts` - 参照関係抽出
3. `src/lib/kg-label-builder.ts` - StructuredLabel関係構築
4. `src/lib/kg-storage-service.ts` - KG保存サービス（Firestore）
5. `src/lib/kg-search-service.ts` - KG検索サービス
6. `scripts/build-knowledge-graph.ts` - KG構築スクリプト
7. `docs/architecture/knowledge-graph-schema.md` - KGスキーマドキュメント

### 修正（2ファイル）

1. `src/ai/flows/retrieve-relevant-docs-lancedb.ts` - KG検索統合
2. `package.json` - スクリプト追加

---

## ✅ 完了条件

### Phase 0A-2.1完了条件

- [x] KG型定義が完成
- [ ] 全ページから参照関係が抽出可能
- [ ] StructuredLabelから関係が構築可能
- [ ] Firestoreに保存可能（ノード・エッジ）
- [ ] KG構築スクリプトが動作

### Phase 0A-2.2完了条件

- [ ] KG検索サービスが動作
- [ ] 検索結果が関連ページで拡張される
- [ ] 6事例でテスト完了
- [ ] 検索精度が62% → 75%以上に改善

### Phase 0A-2全体完了条件

- [ ] 6事例の平均精度が**75%以上**（目標81%）
- [ ] ドキュメント更新完了
- [ ] git push完了

---

## 🎯 期待効果（再掲）

| 問題 | Phase 0A-1.5 | Phase 0A-2目標 | 改善幅 |
|------|-------------|---------------|--------|
| 教室削除条件（164） | 95% | **98%** | +3% |
| 教室コピー項目（168） | 85% | **97%** | +12% |
| 学年・職業更新（721） | 80% | **97%** | +17% |
| 退会後の再登録（046） | 60% | **80%** | +20% |
| 応募制限有無（014） | 40% | **65%** | +25% |
| 重複応募期間（014） | 30% | **50%** | +20% |

**全体平均**: 62% → **81%** (+19%改善)

---

## 🚀 次のアクション

1. ✅ 実装計画書作成（このドキュメント）
2. ⏳ StructuredLabel全ページ生成完了待ち
3. ⏳ Phase 0A-1.5テスト完了
4. ⏳ Phase 0A-2実装開始

**Phase 0A-2は、Phase 0A-1.5のテスト結果確認後に着手します** ✅

---

## 📚 関連ドキュメント

- [Phase 0A-1.5完了報告](./phase-0a-1.5-completion-report.md)
- [Phase 0A最終ロードマップ](../architecture/phase-0a-roadmap-final.md)
- [Knowledge Graph影響分析](../architecture/phase-0a-knowledge-graph-impact.md)
- [Phase 0A実装計画書](../architecture/phase-0A-implementation-plan.md)
- [StructuredLabel設計](../architecture/structured-label-design.md)


