/**
 * 強化版キーワード抽出サービス（Phase 0A-4）
 * 
 * ネガティブワードを除去し、核心キーワードを優先化
 */

/**
 * ネガティブワード（検索ノイズとなる単語）
 */
const NEGATIVE_WORDS = new Set([
  // 疑問詞
  '何', '何が', 'なに', 'いつ', 'どこ', 'だれ', 'どの', 'どう', 'どのように',
  '何で', 'なぜ', 'どうして',
  
  // 可否表現
  'できる', 'できない', 'できますか', 'できませんか',
  '可能', '不可能', '可能ですか', '不可能ですか',
  
  // 原因・理由
  '原因', '理由', 'なぜ', 'どうして',
  
  // 方法
  '方法', 'やり方', '手順', '仕方',
  
  // 丁寧語
  'ください', 'ます', 'です', 'でしょうか',
  
  // 接続詞・助詞
  'は', 'が', 'を', 'に', 'へ', 'と', 'から', 'まで', 'より',
  'の', 'や', 'など', 'か',
  
  // 一般的な動詞
  '教える', '教えて', '知る', '知りたい', '確認', '見る',
]);

/**
 * 核心キーワードのパターン（優先的に抽出）
 */
const CORE_KEYWORD_PATTERNS = [
  // 番号_機能名パターン
  /(\d+_[^、。！？\s]+)/g,
  
  // 機能名パターン
  /(会員|教室|求人|応募|契約|請求|オファー|記事|口コミ|採用|退会|登録|削除|編集|検索|一覧|詳細|管理|設定|更新)/g,
  
  // 属性パターン
  /(学年|職業|プロフィール|メール|パスワード|アカウント|情報|データ|期間|日時|番号)/g,
];

/**
 * 強化版キーワード抽出
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
    const coreKeywords = originalKeywords.filter(kw => !NEGATIVE_WORDS.has(kw));
    const removedWords = originalKeywords.filter(kw => NEGATIVE_WORDS.has(kw));
    
    // 核心キーワードを抽出
    const priorityKeywords: string[] = [];
    
    for (const pattern of CORE_KEYWORD_PATTERNS) {
      const matches = query.matchAll(pattern);
      for (const match of matches) {
        const keyword = match[1];
        if (keyword && !priorityKeywords.includes(keyword)) {
          priorityKeywords.push(keyword);
        }
      }
    }
    
    return {
      coreKeywords,
      removedWords,
      priorityKeywords: priorityKeywords.length > 0 ? priorityKeywords : coreKeywords.slice(0, 3)
    };
  }
  
  /**
   * クエリを核心部分に簡素化
   */
  public simplifyQuery(query: string): string {
    // ネガティブワードを除去
    let simplified = query;
    
    for (const word of NEGATIVE_WORDS) {
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

