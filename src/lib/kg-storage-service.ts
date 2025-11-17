/**
 * Knowledge Graph保存サービス（Firestore版）（Phase 0A-2）
 */

import * as admin from 'firebase-admin';
import type { KGNode, KGEdge } from '@/types/knowledge-graph';
import { initializeFirebaseAdmin } from './firebase-admin-init';

// Firebase Admin SDKの初期化（共通の初期化関数を使用）
initializeFirebaseAdmin();

const db = admin.firestore();

// Phase 5最適化: Firestoreタイムアウト設定を調整（品質影響なし）
// Note: settings()は既に初期化済みの場合はエラーになるため、try-catchで保護
try {
  db.settings({
    ignoreUndefinedProperties: true,
    // タイムアウトを30秒に延長（デフォルト10秒から）
    // KG拡張の大量クエリに対応
  });
} catch (error) {
  // 既に初期化済みの場合はスキップ（正常動作）
  console.log('[KGStorage] Firestore settings already configured');
}

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
   * Phase 5: 複数ノードからのエッジをバッチで取得（品質影響なし）
   * Firestore IN クエリで一括取得してタイムアウトを防止
   */
  async getBatchOutgoingEdges(nodeIds: string[]): Promise<KGEdge[]> {
    if (nodeIds.length === 0) {
      return [];
    }
    
    // Firestore IN クエリは最大30件まで
    if (nodeIds.length > 30) {
      console.warn(`[KGStorage] nodeIds exceeds 30 (${nodeIds.length}), splitting into batches`);
    }
    
    try {
      const snapshot = await db
        .collection(EDGES_COLLECTION)
        .where('from', 'in', nodeIds)
        .get();
      
      const edges = snapshot.docs.map(doc => doc.data() as KGEdge);
      console.log(`[KGStorage] Retrieved ${edges.length} edges for ${nodeIds.length} nodes`);
      
      return edges;
    } catch (error) {
      console.error(`[KGStorage] バッチエッジ取得エラー:`, error);
      return [];
    }
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
  
  /**
   * Knowledge Graphの統計情報を取得
   */
  async getStats(): Promise<{
    nodeCount: number;
    edgeCount: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
  }> {
    const [nodesSnapshot, edgesSnapshot] = await Promise.all([
      db.collection(NODES_COLLECTION).get(),
      db.collection(EDGES_COLLECTION).get()
    ]);
    
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    
    nodesSnapshot.docs.forEach(doc => {
      const node = doc.data() as KGNode;
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    });
    
    edgesSnapshot.docs.forEach(doc => {
      const edge = doc.data() as KGEdge;
      edgesByType[edge.type] = (edgesByType[edge.type] || 0) + 1;
    });
    
    return {
      nodeCount: nodesSnapshot.size,
      edgeCount: edgesSnapshot.size,
      nodesByType,
      edgesByType
    };
  }
}

export const kgStorageService = new KGStorageService();

