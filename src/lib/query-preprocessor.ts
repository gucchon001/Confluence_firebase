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

  // 1. 基本的な正規化
  let processedQuery = query.trim();
  
  // 2. 不要な文字の除去
  processedQuery = processedQuery.replace(/[「」『』（）()【】\[\]]/g, ' ');
  
  // 3. 複数スペースを単一スペースに
  processedQuery = processedQuery.replace(/\s+/g, ' ');
  
  // 4. キーワード抽出（簡単な実装）
  const keywords = extractKeywords(processedQuery);
  
  // 5. 同義語展開
  const expandedTerms = expandSynonyms(keywords);
  
  // 6. クエリ拡張
  const expandedQuery = expandQuery(processedQuery, expandedTerms);
  
  return {
    originalQuery: query,
    processedQuery: expandedQuery,
    keywords,
    expandedTerms
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
  return QUERY_STOP_WORDS_SET.has(word.toLowerCase());
}

/**
 * 同義語展開
 */
function expandSynonyms(keywords: string[]): string[] {
  const synonymMap: Record<string, string[]> = {
    '教室': ['クラス', '授業', 'レッスン'],
    '管理': ['運営', '操作', '制御'],
    '機能': ['機能', 'システム', 'ツール'],
    '登録': ['作成', '追加', '新規'],
    '編集': ['修正', '変更', '更新'],
    '削除': ['除去', '消去', '削除'],
    '検索': ['探す', '見つける', '検索'],
    '一覧': ['リスト', '目録', '一覧'],
    '詳細': ['詳細', '詳しく', '詳細情報'],
    'オファー': ['オファー', '提案', '申し出'],
    '応募': ['応募', '申し込み', '申請'],
    '求人': ['求人', '募集', '採用'],
    'ユーザー': ['ユーザー', '利用者', '会員'],
    'システム': ['システム', '仕組み', '機能'],
    '設定': ['設定', '構成', '環境設定']
  };
  
  const expandedTerms = new Set<string>();
  
  keywords.forEach(keyword => {
    expandedTerms.add(keyword);
    
    // 同義語を追加
    if (synonymMap[keyword]) {
      synonymMap[keyword].forEach(synonym => {
        expandedTerms.add(synonym);
      });
    }
    
    // 部分一致で同義語を検索
    Object.keys(synonymMap).forEach(key => {
      if (keyword.includes(key) || key.includes(keyword)) {
        synonymMap[key].forEach(synonym => {
          expandedTerms.add(synonym);
        });
      }
    });
  });
  
  return Array.from(expandedTerms);
}

/**
 * クエリ拡張
 */
function expandQuery(originalQuery: string, expandedTerms: string[]): string {
  // 元のクエリに同義語を追加
  const allTerms = [originalQuery, ...expandedTerms];
  
  // 重複を除去して結合
  const uniqueTerms = Array.from(new Set(allTerms));
  
  return uniqueTerms.join(' ');
}

/**
 * クエリの品質スコアを計算
 */
export function calculateQueryQuality(query: ProcessedQuery): number {
  let score = 0;
  
  // キーワード数のスコア
  score += Math.min(query.keywords.length * 0.2, 1.0);
  
  // 拡張語数のスコア
  score += Math.min(query.expandedTerms.length * 0.1, 0.5);
  
  // クエリ長のスコア
  score += Math.min(query.processedQuery.length / 100, 0.3);
  
  return Math.min(score, 1.0);
}
