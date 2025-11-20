/**
 * クエリ前処理機能
 * 検索品質向上のためのクエリ拡張と正規化
 */

import { QUERY_STOP_WORDS_SET } from './common-terms-config';

export interface ProcessedQuery {
  originalQuery: string;
  processedQuery: string;
  keywords: string[];
  expandedTerms: string[];
}

/**
 * クエリの前処理を実行
 */
export function preprocessQuery(query: string): ProcessedQuery {
  if (!query || typeof query !== 'string') {
    return {
      originalQuery: query,
      processedQuery: '',
      keywords: [],
      expandedTerms: []
    };
  }

  // 0. BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  query = query.replace(/\uFEFF/g, '');

  // 1. 基本的な正規化
  let processedQuery = query.trim();
  
  // 2. 不要な文字の除去
  processedQuery = processedQuery.replace(/[「」『』（）()【】\[\]]/g, ' ');
  
  // 3. 複数スペースを単一スペースに
  processedQuery = processedQuery.replace(/\s+/g, ' ');
  
  // 4. キーワード抽出（簡単な実装）
  const keywords = extractKeywords(processedQuery);
  
  return {
    originalQuery: query,
    processedQuery: processedQuery, // 正規化後のクエリをそのまま使用
    keywords,
    expandedTerms: [] // 同義語展開は使用しない
  };
}

/**
 * キーワード抽出
 */
function extractKeywords(query: string): string[] {
  // 基本的なキーワード抽出
  const words = query.split(/\s+/)
    .filter(word => word.length > 1) // 1文字の単語を除外
    .filter(word => !isStopWord(word)); // ストップワードを除外
  
  return words;
}

/**
 * ストップワード判定（統一設定から）
 */
function isStopWord(word: string): boolean {
  return QUERY_STOP_WORDS_SET.has(word.toLowerCase() as any);
}


/**
 * クエリの品質スコアを計算
 */
export function calculateQueryQuality(query: ProcessedQuery): number {
  let score = 0;
  
  // キーワード数のスコア
  score += Math.min(query.keywords.length * 0.2, 1.0);
  
  // クエリ長のスコア
  score += Math.min(query.processedQuery.length / 100, 0.3);
  
  return Math.min(score, 1.0);
}
