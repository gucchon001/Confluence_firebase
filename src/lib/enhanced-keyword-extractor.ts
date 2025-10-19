/**
 * 強化版キーワード抽出サービス（Phase 0A-4）
 * 
 * ネガティブワードを除去し、核心キーワードを優先化
 */

import { NEGATIVE_WORDS_SET } from './common-terms-config';

/**
 * 強化版キーワード抽出
 * 
 * Phase 5改善: ハードコードパターンを完全削除
 * ドメイン知識ファイル (keyword-lists-v2.json) がメインのキーワードソース
 * 保守性を向上させるため、手動管理が必要なパターンマッチングは使用しない
 */
export class EnhancedKeywordExtractor {
  /**
   * クエリから核心キーワードを抽出（ネガティブワード除去）
   */
  public extractCoreKeywords(query: string, originalKeywords: string[]): {
    coreKeywords: string[];
    removedWords: string[];
    priorityKeywords: string[];
  } {
    // ネガティブワードを除去
    const coreKeywords = originalKeywords.filter(kw => !NEGATIVE_WORDS_SET.has(kw as any));
    const removedWords = originalKeywords.filter(kw => NEGATIVE_WORDS_SET.has(kw as any));
    
    // Phase 5改善: ハードコードパターンを削除
    // 優先キーワードはドメイン知識から抽出されたキーワードの上位3つを使用
    const priorityKeywords = coreKeywords.slice(0, 3);
    
    return {
      coreKeywords,
      removedWords,
      priorityKeywords
    };
  }
  
  /**
   * クエリを核心部分に簡素化
   */
  public simplifyQuery(query: string): string {
    // ネガティブワードを除去
    let simplified = query;
    
    for (const word of NEGATIVE_WORDS_SET) {
      simplified = simplified.replace(new RegExp(word, 'g'), '');
    }
    
    // 余分な空白を削除
    simplified = simplified.replace(/\s+/g, ' ').trim();
    
    return simplified;
  }
  
  /**
   * タイトル完全一致の判定（厳格版）
   */
  public isExactTitleMatch(title: string, coreKeywords: string[]): boolean {
    const titleLower = title.toLowerCase();
    
    // 核心キーワードが全て含まれる場合は完全一致とみなす
    const allMatch = coreKeywords.every(kw => titleLower.includes(kw.toLowerCase()));
    
    return allMatch;
  }
}

// シングルトンインスタンスをエクスポート
export const enhancedKeywordExtractor = new EnhancedKeywordExtractor();

