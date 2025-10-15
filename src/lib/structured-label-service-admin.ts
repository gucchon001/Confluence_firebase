/**
 * StructuredLabel Firestoreサービス（Admin SDK版）
 * Phase 0A-1: サーバーサイド（Node.js）での使用
 */

import * as admin from 'firebase-admin';
import type { StructuredLabel } from '@/types/structured-label';

// Firebase Admin SDK初期化（既に初期化されている場合はスキップ）
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();
const COLLECTION_NAME = 'structured_labels';

export interface StructuredLabelDocument {
  pageId: string;
  structuredLabel: StructuredLabel;
  generatedAt: admin.firestore.Timestamp;
  generatedBy: 'rule-based' | 'llm-based';
}

/**
 * StructuredLabelを保存（Admin SDK）
 */
export async function saveStructuredLabel(
  pageId: string,
  label: StructuredLabel
): Promise<void> {
  // undefinedフィールドを削除（Firestore保存前のクリーンアップ）
  const cleanedLabel: any = { ...label };
  Object.keys(cleanedLabel).forEach(key => {
    if (cleanedLabel[key] === undefined) {
      delete cleanedLabel[key];
    }
  });
  
  const docData: StructuredLabelDocument = {
    pageId,
    structuredLabel: cleanedLabel as StructuredLabel,
    generatedAt: admin.firestore.Timestamp.now(),
    generatedBy: (label.confidence && label.confidence >= 0.85) ? 'rule-based' : 'llm-based'
  };
  
  await db.collection(COLLECTION_NAME).doc(pageId).set(docData);
}

/**
 * StructuredLabelを取得（Admin SDK）
 */
export async function getStructuredLabel(
  pageId: string
): Promise<StructuredLabel | null> {
  try {
    const docSnap = await db.collection(COLLECTION_NAME).doc(pageId).get();
    
    if (!docSnap.exists) {
      return null;
    }
    
    const data = docSnap.data() as StructuredLabelDocument;
    return data.structuredLabel;
  } catch (error) {
    console.error(`Error getting structured label for ${pageId}:`, error);
    return null;
  }
}

/**
 * 複数ページのStructuredLabelを一括取得（Admin SDK）
 * Phase 0A-1.5: 空ページフィルター用
 */
export async function getStructuredLabels(
  pageIds: string[]
): Promise<Map<string, StructuredLabel>> {
  const labels = new Map<string, StructuredLabel>();
  
  if (pageIds.length === 0) {
    return labels;
  }
  
  // Firestoreの仕様: `in`クエリは最大10件まで
  // そのため、10件ずつバッチで取得
  const batchSize = 10;
  for (let i = 0; i < pageIds.length; i += batchSize) {
    const batch = pageIds.slice(i, i + batchSize);
    
    try {
      const snapshot = await db
        .collection(COLLECTION_NAME)
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get();
      
      snapshot.forEach(doc => {
        const data = doc.data() as StructuredLabelDocument;
        labels.set(doc.id, data.structuredLabel);
      });
    } catch (error) {
      console.error(`Error getting structured labels for batch:`, error);
      // エラーが発生してもスキップして続行
    }
  }
  
  return labels;
}

/**
 * 統計情報を取得（Admin SDK）
 */
export async function getStructuredLabelStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  byDomain: Record<string, number>;
  byStatus: Record<string, number>;
  averageConfidence: number;
}> {
  try {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    
    const stats = {
      total: snapshot.size,
      byCategory: {} as Record<string, number>,
      byDomain: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      averageConfidence: 0
    };
    
    let confidenceSum = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data() as StructuredLabelDocument;
      const label = data.structuredLabel;
      
      // カテゴリ集計
      stats.byCategory[label.category] = (stats.byCategory[label.category] || 0) + 1;
      
      // ドメイン集計
      stats.byDomain[label.domain] = (stats.byDomain[label.domain] || 0) + 1;
      
      // ステータス集計
      stats.byStatus[label.status] = (stats.byStatus[label.status] || 0) + 1;
      
      // 信頼度集計
      if (label.confidence) {
        confidenceSum += label.confidence;
      }
    });
    
    stats.averageConfidence = snapshot.size > 0 ? confidenceSum / snapshot.size : 0;
    
    return stats;
  } catch (error) {
    console.error('Error getting structured label stats:', error);
    return {
      total: 0,
      byCategory: {},
      byDomain: {},
      byStatus: {},
      averageConfidence: 0
    };
  }
}

