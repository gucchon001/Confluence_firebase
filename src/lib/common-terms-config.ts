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
  '設定',  // 一元化: keyword-lists-loader.ts から追加
  '要件',  // 一元化: keyword-lists-loader.ts から追加
  
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
 * 
 * 注意: この配列は最小限のコアキーワードのみ（フォールバック用）
 * 実際のドメイン固有キーワードは `keyword-lists-v2.json` の `domainNames` と `functionNames` から動的に読み込む
 */
export const DOMAIN_SPECIFIC_KEYWORDS_CORE = [
  // コアドメイン（最小限のハードコーディング - フォールバック用）
  '教室',
  '求人',
  '会員',
  '応募',
  '契約',
  '請求',
  '採用',
  'オファー',
] as const;

/**
 * ドメイン固有キーワードを動的に取得する
 * keyword-lists-v2.json の domainNames と functionNames から読み込む
 * フォールバックとして、コアキーワードを使用
 */
let cachedDomainKeywords: string[] | null = null;
let cachedDomainKeywordsSet: Set<string> | null = null;

/**
 * ドメイン固有キーワードを初期化（keyword-lists-loader から動的に読み込む）
 * この関数は keyword-lists-loader が初期化された後に呼び出す必要がある
 * 
 * Phase 6改善: relatedKeywordsとsystemTermsからも重要なキーワードを抽出
 */
export function initializeDomainSpecificKeywords(
  keywordCategories: { 
    domainNames: string[]; 
    functionNames: string[]; 
    relatedKeywords?: string[]; 
    systemTerms?: string[]; 
  } | null
): void {
  if (cachedDomainKeywords) {
    return; // 既に初期化済み
  }

  const domainKeywords = new Set<string>(DOMAIN_SPECIFIC_KEYWORDS_CORE);

  if (keywordCategories) {
    // domainNames から抽出（例: "教室管理", "求人管理" → "教室", "求人"）
    for (const domainName of keywordCategories.domainNames) {
      // 単語単位で抽出（"管理"などの汎用語を除外）
      const words = domainName.split(/[管理機能情報画面設定登録編集削除一覧詳細閲覧作成更新]/);
      for (const word of words) {
        if (word.length >= 2 && !GENERIC_FUNCTION_TERMS_SET.has(word as any)) {
          domainKeywords.add(word);
        }
      }
      // 複合語も追加（例: "教室コピー", "パーソナルオファー"）
      if (domainName.length >= 4 && !domainName.includes('管理') && !domainName.includes('機能')) {
        domainKeywords.add(domainName);
      }
    }

    // functionNames から抽出（複合語を優先）
    for (const functionName of keywordCategories.functionNames) {
      // 複合語を追加（例: "教室コピー機能", "パーソナルオファー登録機能"）
      if (functionName.length >= 4 && !functionName.includes('管理')) {
        // "機能"などの汎用語を除去
        const cleanName = functionName.replace(/[機能管理情報画面設定登録編集削除一覧詳細閲覧作成更新]/g, '').trim();
        if (cleanName.length >= 2) {
          domainKeywords.add(cleanName);
        }
      }
    }

    // Phase 6改善: relatedKeywordsから重要なキーワードを抽出
    // 複合語（4文字以上）や重要な単語（例：「ログイン」「認証」）を抽出
    if (keywordCategories.relatedKeywords) {
      for (const relatedKeyword of keywordCategories.relatedKeywords) {
        // 複合語（4文字以上）は追加
        if (relatedKeyword.length >= 4) {
          // 汎用語を除去
          const cleanName = relatedKeyword.replace(/[機能管理情報画面設定登録編集削除一覧詳細閲覧作成更新]/g, '').trim();
          if (cleanName.length >= 2 && !GENERIC_FUNCTION_TERMS_SET.has(cleanName as any)) {
            domainKeywords.add(cleanName);
            // 元の複合語も追加（例：「ログイン認証」）
            if (relatedKeyword.length >= 4 && !relatedKeyword.includes('管理') && !relatedKeyword.includes('機能')) {
              domainKeywords.add(relatedKeyword);
            }
          }
        } else if (relatedKeyword.length >= 2 && relatedKeyword.length <= 5) {
          // 短いキーワード（2-5文字）は重要な概念の可能性がある（例：「ログイン」「認証」）
          // ただし汎用語は除外
          if (!GENERIC_FUNCTION_TERMS_SET.has(relatedKeyword as any)) {
            domainKeywords.add(relatedKeyword);
          }
        }
      }
    }

    // Phase 6改善: systemTermsから複合語のみを抽出
    // systemTermsはノイズが多いため、複合語（4文字以上）のみを抽出
    if (keywordCategories.systemTerms) {
      for (const systemTerm of keywordCategories.systemTerms) {
        // 複合語（4文字以上）のみ追加
        if (systemTerm.length >= 4) {
          // 汎用語を除去
          const cleanName = systemTerm.replace(/[機能管理情報画面設定登録編集削除一覧詳細閲覧作成更新]/g, '').trim();
          if (cleanName.length >= 2 && !GENERIC_FUNCTION_TERMS_SET.has(cleanName as any)) {
            domainKeywords.add(cleanName);
            // 元の複合語も追加（汎用語を含まない場合）
            if (systemTerm.length >= 4 && !systemTerm.includes('管理') && !systemTerm.includes('機能')) {
              domainKeywords.add(systemTerm);
            }
          }
        }
      }
    }
  }

  cachedDomainKeywords = Array.from(domainKeywords);
  cachedDomainKeywordsSet = new Set(cachedDomainKeywords);
  
  console.log(`[CommonTermsConfig] ドメイン固有キーワードを動的に読み込みました: ${cachedDomainKeywords.length}個`);
}

/**
 * ドメイン固有キーワードを取得（初期化済みの場合）
 * 初期化されていない場合はコアキーワードを返す
 */
export function getDomainSpecificKeywords(): string[] {
  return cachedDomainKeywords || Array.from(DOMAIN_SPECIFIC_KEYWORDS_CORE);
}

/**
 * ドメイン固有キーワードのSetを取得（初期化済みの場合）
 * 初期化されていない場合はコアキーワードのSetを返す
 */
export function getDomainSpecificKeywordsSet(): Set<string> {
  return cachedDomainKeywordsSet || new Set(DOMAIN_SPECIFIC_KEYWORDS_CORE);
}

/**
 * 同期版: ドメイン固有キーワード（初期化済みの場合は動的キーワード、未初期化の場合はコアキーワード）
 * 既存コードとの互換性のため、この変数は使用可能
 */
export let DOMAIN_SPECIFIC_KEYWORDS: readonly string[] = DOMAIN_SPECIFIC_KEYWORDS_CORE;
export let DOMAIN_SPECIFIC_KEYWORDS_SET: Set<string> = new Set(DOMAIN_SPECIFIC_KEYWORDS_CORE);

// 初期化関数が呼ばれたら、エクスポート変数も更新するラッパー関数
export function initializeDomainSpecificKeywordsWithUpdate(
  keywordCategories: { 
    domainNames: string[]; 
    functionNames: string[]; 
    relatedKeywords?: string[]; 
    systemTerms?: string[]; 
  } | null
): void {
  initializeDomainSpecificKeywords(keywordCategories);
  // エクスポート変数を更新
  DOMAIN_SPECIFIC_KEYWORDS = cachedDomainKeywords || DOMAIN_SPECIFIC_KEYWORDS_CORE;
  DOMAIN_SPECIFIC_KEYWORDS_SET = cachedDomainKeywordsSet || new Set(DOMAIN_SPECIFIC_KEYWORDS_CORE);
}

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
   * 注意: 動的キーワードが初期化されている場合はそれを使用、未初期化の場合はコアキーワードを使用
   */
  containsDomainSpecificKeyword(title: string): boolean {
    const titleLower = title.toLowerCase();
    const keywordsSet = getDomainSpecificKeywordsSet();
    return Array.from(keywordsSet).some(keyword => 
      titleLower.includes(keyword.toLowerCase())
    );
  },
  
  /**
   * タイトルに含まれるドメイン固有キーワード数を取得
   * 注意: 動的キーワードが初期化されている場合はそれを使用、未初期化の場合はコアキーワードを使用
   */
  countDomainSpecificKeywords(title: string): number {
    const titleLower = title.toLowerCase();
    const keywordsSet = getDomainSpecificKeywordsSet();
    return Array.from(keywordsSet).filter(keyword => 
      titleLower.includes(keyword.toLowerCase())
    ).length;
  },
  
  /**
   * クエリとタイトルの両方に含まれるドメイン固有キーワード数を取得
   * Phase 5改善: クエリに関連するキーワードのみをブースト対象とする
   * 注意: 動的キーワードが初期化されている場合はそれを使用、未初期化の場合はコアキーワードを使用
   */
  countMatchingDomainKeywords(query: string, title: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();
    const keywordsSet = getDomainSpecificKeywordsSet();
    
    return Array.from(keywordsSet).filter(keyword => {
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

