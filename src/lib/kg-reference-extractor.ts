/**
 * Knowledge Graph参照関係抽出サービス（Phase 0A-2）
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

