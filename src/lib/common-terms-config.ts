/**
 * 汎用用語・ストップワード統一設定
 * 
 * 全てのモジュールで使用する共通用語の定義を一元管理
 * 保守性向上のため、用語の追加・削除はこのファイルのみで行う
 */

/**
 * 汎用的な機能用語
 * タイトルや機能名に含まれる一般的な単語で、検索の重要度を下げるべき用語
 */
export const GENERIC_FUNCTION_TERMS = [
  // 機能関連
  '機能',
  '仕様',
  '画面',
  'ページ',
  
  // 操作関連
  '管理',
  '一覧',
  '登録',
  '編集',
  '削除',
  '閲覧',
  '詳細',  // ← 重要：「詳細閲覧機能」などに過度に反応しないため
  '情報',
  '新規',
  '作成',
  '更新',
  
  // データ・帳票関連
  '帳票',
  'データ',
  
  // フロー・プロセス関連
  'フロー',
] as const;

/**
 * 汎用的なドキュメント用語
 * ドキュメントタイトルに含まれる一般的な単語で、スコアを減衰させるべき用語
 */
export const GENERIC_DOCUMENT_TERMS = [
  // 要件・仕様関連
  '共通要件',
  '非機能要件',
  '要件',
  'ガイドライン',
  
  // 用語・定義関連
  '用語',
  'ワード',
  'ディフィニション',
  'definition',
  
  // 一覧・まとめ
  '一覧',
  'フロー',
  
  // 詳細・閲覧（重要：「詳細閲覧機能」への過度な反応を防ぐ）
  '詳細',
  '詳細閲覧',
] as const;

/**
 * クエリのストップワード
 * 検索クエリから除外すべき一般的な助詞や接続詞
 */
export const QUERY_STOP_WORDS = [
  // 助詞
  'は', 'が', 'を', 'に', 'で', 'と', 'の', 'も', 'から', 'まで', 'へ', 'や',
  
  // 疑問詞・接続詞
  'について', 'に関して', 'に対して',
  
  // 丁寧語・語尾
  'です', 'ます', 'である', 'でしょうか',
  'ください', 'して', 'くれ',
  
  // 一般的な動詞・表現
  'とは', 'について',
] as const;

/**
 * ネガティブワード（検索ノイズとなる単語）
 * キーワード抽出時に除外すべき単語
 */
export const NEGATIVE_WORDS = [
  // 疑問詞
  '何', '何が', 'なに', 'いつ', 'どこ', 'だれ', 'どの', 'どう', 'どのように',
  '何で', 'なぜ', 'どうして',
  
  // 可否表現
  'できる', 'できない', 'できますか', 'できませんか',
  '可能', '不可能', '可能ですか', '不可能ですか',
  
  // 原因・理由・方法
  '原因', '理由', 'なぜ', 'どうして',
  '方法', 'やり方', '手順', '仕方',
  'の使い方', 'の詳細',
  
  // 丁寧語
  'ください', 'ます', 'です', 'でしょうか',
  
  // 接続詞・助詞
  'は', 'が', 'を', 'に', 'へ', 'と', 'から', 'まで', 'より',
  'の', 'や', 'など', 'か',
  
  // 一般的な動詞
  '教える', '教えて', '知る', '知りたい', '確認', '見る',
] as const;

/**
 * ペナルティ対象用語
 * ラベルやタイトルに含まれる場合、スコアを減衰させるべき用語
 */
export const PENALTY_TERMS = [
  // 議事録・メール
  '議事録',
  'ミーティング',
  'meeting',
  'メール',
  '通知',
  
  // アーカイブ・削除予定
  'アーカイブ',
  'archive',
  'バックアップ',
  '削除予定',
  '不要',
] as const;

/**
 * 汎用用語セット（Set版 - 高速検索用）
 */
export const GENERIC_FUNCTION_TERMS_SET = new Set(GENERIC_FUNCTION_TERMS);
export const GENERIC_DOCUMENT_TERMS_SET = new Set(GENERIC_DOCUMENT_TERMS);
export const QUERY_STOP_WORDS_SET = new Set(QUERY_STOP_WORDS);
export const NEGATIVE_WORDS_SET = new Set(NEGATIVE_WORDS);
export const PENALTY_TERMS_SET = new Set(PENALTY_TERMS);

/**
 * ドメイン固有キーワード（重要キーワード）
 * タイトルにこれらが含まれる場合、スコアをブーストする
 */
export const DOMAIN_SPECIFIC_KEYWORDS = [
  // 主要ドメイン
  '急募',
  '教室',
  '求人',
  '会員',
  '応募',
  '契約',
  '請求',
  '採用',
  
  // 重要機能
  '退会',
  '削除',
  'コピー',
  'オファー',
  '口コミ',
  'Q&A',
  'Q＆A',
  
  // 重要な操作・状態
  '応募不可',
  '重複',
  '自動更新',
  'バッチ',
] as const;

export const DOMAIN_SPECIFIC_KEYWORDS_SET = new Set(DOMAIN_SPECIFIC_KEYWORDS);

/**
 * 汎用用語判定ヘルパー関数
 */
export const CommonTermsHelper = {
  /**
   * 汎用的な機能用語かどうか判定
   */
  isGenericFunctionTerm(term: string): boolean {
    return GENERIC_FUNCTION_TERMS_SET.has(term as any);
  },
  
  /**
   * 汎用的なドキュメント用語かどうか判定
   */
  isGenericDocumentTerm(term: string): boolean {
    return GENERIC_DOCUMENT_TERMS_SET.has(term as any);
  },
  
  /**
   * ストップワードかどうか判定
   */
  isStopWord(term: string): boolean {
    return QUERY_STOP_WORDS_SET.has(term as any);
  },
  
  /**
   * ネガティブワードかどうか判定
   */
  isNegativeWord(term: string): boolean {
    return NEGATIVE_WORDS_SET.has(term as any);
  },
  
  /**
   * ペナルティ対象用語かどうか判定
   */
  isPenaltyTerm(term: string): boolean {
    return PENALTY_TERMS_SET.has(term as any);
  },
  
  /**
   * タイトルに汎用用語が含まれるか判定
   */
  containsGenericTerms(title: string): boolean {
    const titleLower = title.toLowerCase();
    return Array.from(GENERIC_DOCUMENT_TERMS_SET).some(term => 
      titleLower.includes(term.toLowerCase())
    );
  },
  
  /**
   * タイトルにドメイン固有キーワードが含まれるか判定
   */
  containsDomainSpecificKeyword(title: string): boolean {
    const titleLower = title.toLowerCase();
    return Array.from(DOMAIN_SPECIFIC_KEYWORDS_SET).some(keyword => 
      titleLower.includes(keyword.toLowerCase())
    );
  },
  
  /**
   * タイトルに含まれるドメイン固有キーワード数を取得
   */
  countDomainSpecificKeywords(title: string): number {
    const titleLower = title.toLowerCase();
    return Array.from(DOMAIN_SPECIFIC_KEYWORDS_SET).filter(keyword => 
      titleLower.includes(keyword.toLowerCase())
    ).length;
  },
  
  /**
   * クエリとタイトルの両方に含まれるドメイン固有キーワード数を取得
   * Phase 5改善: クエリに関連するキーワードのみをブースト対象とする
   */
  countMatchingDomainKeywords(query: string, title: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();
    
    return Array.from(DOMAIN_SPECIFIC_KEYWORDS_SET).filter(keyword => {
      const keywordLower = keyword.toLowerCase();
      return queryLower.includes(keywordLower) && titleLower.includes(keywordLower);
    }).length;
  },
  
  /**
   * 汎用用語の重み（0.0-1.0）を取得
   * より汎用的な用語ほど低い重みを返す
   */
  getGenericTermWeight(term: string): number {
    if (GENERIC_DOCUMENT_TERMS_SET.has(term as any)) return 0.3;  // 最も汎用的
    if (GENERIC_FUNCTION_TERMS_SET.has(term as any)) return 0.5;  // やや汎用的
    return 1.0;  // 汎用用語ではない
  }
};

/**
 * 統計情報
 */
export const COMMON_TERMS_STATS = {
  genericFunctionTerms: GENERIC_FUNCTION_TERMS.length,
  genericDocumentTerms: GENERIC_DOCUMENT_TERMS.length,
  queryStopWords: QUERY_STOP_WORDS.length,
  negativeWords: NEGATIVE_WORDS.length,
  penaltyTerms: PENALTY_TERMS.length,
  total: GENERIC_FUNCTION_TERMS.length + 
         GENERIC_DOCUMENT_TERMS.length + 
         QUERY_STOP_WORDS.length + 
         NEGATIVE_WORDS.length + 
         PENALTY_TERMS.length,
};

// デバッグ用：起動時に統計情報を出力
if (process.env.NODE_ENV === 'development') {
  console.log('[CommonTermsConfig] 汎用用語設定読み込み完了:', COMMON_TERMS_STATS);
}

