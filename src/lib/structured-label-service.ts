/**
 * StructuredLabel Firestoreサービス
 * Phase 0A-1: StructuredLabelの保存・取得
 * 
 * 新規Firestoreコレクション: structured_labels
 * 既存システムへの影響: なし
 */

import { getFirestore, doc, setDoc, getDoc, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { app } from './firebase';
import type { StructuredLabel } from '@/types/structured-label';

const db = getFirestore(app);
const COLLECTION_NAME = 'structured_labels';

export interface StructuredLabelDocument {
  pageId: string;
  structuredLabel: StructuredLabel;
  generatedAt: Date;
  generatedBy: 'rule-based' | 'llm-based';
}

/**
 * StructuredLabelを保存
 */
export async function saveStructuredLabel(
  pageId: string,
  label: StructuredLabel
): Promise<void> {
  const docData: StructuredLabelDocument = {
    pageId,
    structuredLabel: label,
    generatedAt: new Date(),
    generatedBy: (label.confidence && label.confidence >= 0.85) ? 'rule-based' : 'llm-based'
  };
  
  await setDoc(
    doc(db, COLLECTION_NAME, pageId),
    docData
  );
}

/**
 * StructuredLabelを取得
 */
export async function getStructuredLabel(
  pageId: string
): Promise<StructuredLabel | null> {
  try {
    const docSnap = await getDoc(doc(db, COLLECTION_NAME, pageId));
    
    if (!docSnap.exists()) {
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
 * 複数ページのStructuredLabelを一括取得
 */
export async function getStructuredLabels(
  pageIds: string[]
): Promise<Map<string, StructuredLabel>> {
  const labels = new Map<string, StructuredLabel>();
  
  if (pageIds.length === 0) {
    return labels;
  }
  
  // 並列取得で高速化（最大10件ずつ）
  const chunks = [];
  for (let i = 0; i < pageIds.length; i += 10) {
    chunks.push(pageIds.slice(i, i + 10));
  }
  
  for (const chunk of chunks) {
    await Promise.all(
      chunk.map(async (pageId) => {
        const label = await getStructuredLabel(pageId);
        if (label) {
          labels.set(pageId, label);
        }
      })
    );
  }
  
  return labels;
}

/**
 * ドメイン別にStructuredLabelを取得
 */
export async function getStructuredLabelsByDomain(
  domain: string,
  maxResults: number = 100
): Promise<StructuredLabelDocument[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('structuredLabel.domain', '==', domain),
      limit(maxResults)
    );
    
    const snapshot = await getDocs(q);
    const results: StructuredLabelDocument[] = [];
    
    snapshot.forEach(doc => {
      results.push(doc.data() as StructuredLabelDocument);
    });
    
    return results;
  } catch (error) {
    console.error(`Error querying labels by domain ${domain}:`, error);
    return [];
  }
}

/**
 * カテゴリ別にStructuredLabelを取得
 */
export async function getStructuredLabelsByCategory(
  category: string,
  maxResults: number = 100
): Promise<StructuredLabelDocument[]> {
  try {
    const q = query(
      collection(db, COLLECTION_NAME),
      where('structuredLabel.category', '==', category),
      limit(maxResults)
    );
    
    const snapshot = await getDocs(q);
    const results: StructuredLabelDocument[] = [];
    
    snapshot.forEach(doc => {
      results.push(doc.data() as StructuredLabelDocument);
    });
    
    return results;
  } catch (error) {
    console.error(`Error querying labels by category ${category}:`, error);
    return [];
  }
}

/**
 * 統計情報を取得
 */
export async function getStructuredLabelStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  byDomain: Record<string, number>;
  byStatus: Record<string, number>;
  averageConfidence: number;
}> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    
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

