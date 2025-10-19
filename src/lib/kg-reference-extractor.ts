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
    
    // パターン0: Confluence内部リンク（最優先）
    const urlPattern = /\/pages\/(\d+)/g;
    let urlMatch: RegExpExecArray | null;
    
    while ((urlMatch = urlPattern.exec(content)) !== null) {
      const targetPageId = urlMatch[1];
      
      // 自己参照は除外
      if (targetPageId === pageId) continue;
      
      edges.push({
        id: `${pageId}-ref-url-${targetPageId}`,
        from: `page-${pageId}`,
        to: `page-${targetPageId}`,
        type: 'reference',
        weight: 1.0, // URLリンクは高信頼度
        extractedFrom: 'content',
        metadata: {
          matchPattern: `URL link to page ${targetPageId}`
        }
      });
    }
    
    // パターン1: ページ番号参照（「177_【FIX】...」のパターン）
    // 全ての「NNN_」を参照として抽出
    const pageNumberPattern = /(\d{3})_/g;
    let pageNumMatch: RegExpExecArray | null;
    const extractedPageNumbers = new Set<string>();
    
    while ((pageNumMatch = pageNumberPattern.exec(content)) !== null) {
      const targetPageNumber = pageNumMatch[1];
      
      // 自己参照は除外（pageIdは3桁または9桁）
      if (targetPageNumber === pageId || targetPageNumber === pageId.slice(-3)) continue;
      
      // 重複除外
      if (extractedPageNumbers.has(targetPageNumber)) continue;
      extractedPageNumbers.add(targetPageNumber);
      
      edges.push({
        id: `${pageId}-ref-page-${targetPageNumber}`,
        from: `page-${pageId}`,
        to: `page-${targetPageNumber}`,
        type: 'reference',
        weight: 0.7,
        extractedFrom: 'content',
        metadata: {
          matchPattern: `${targetPageNumber}_`
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
  ): Promise<string | null> {
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

