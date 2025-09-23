/**
 * データドリブンなキーワード重複削除ユーティリティ
 * 実際のConfluenceデータの特徴に基づいた重複削除機能
 */

export interface DeduplicationOptions {
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
  preserveOrder?: boolean;
  minLength?: number;
  maxLength?: number;
  protectDomainNames?: boolean; // ドメイン名を保護
}

export interface DeduplicationResult {
  uniqueKeywords: string[];
  removedDuplicates: string[];
  removedSimilar: string[];
  protectedKeywords: string[]; // 保護されたキーワード
  statistics: {
    originalCount: number;
    uniqueCount: number;
    duplicateCount: number;
    similarCount: number;
    protectedCount: number;
    reductionRate: number;
  };
}

/**
 * ドメイン名のパターン定義
 * 実際のConfluenceデータから抽出されたパターン
 */
const DOMAIN_PATTERNS = [
  // 管理系ドメイン
  /教室管理/,
  /企業管理/,
  /オファー管理/,
  /応募管理/,
  /採用管理/,
  /口コミ管理/,
  /記事管理/,
  /アカウント管理/,
  /サイト設定管理/,
  /契約管理/,
  /請求管理/,
  /メッセージ管理/,
  /急募管理/,
  /オシゴトQ&A管理/,
  /パーソナルオファー管理/,
  // プロジェクト固有ドメイン（削除：これらはドメイン名ではない）
  /自動オファー管理/,
  /採用確認管理/,
  /採用お祝い申請管理/,
  /企業別採用管理/,
  /応募履歴管理/,
  /その他管理/,
  /metaタグ管理/,
  /問合せ管理/,
  /メール送信履歴管理/,
  /請求書明細管理/,
  /請求書PDF管理/,
  /アクセス集計管理/,
  /全アカウント管理/,
  /管理者管理/,
  /企業担当者管理/,
  /マイページ各種管理/,
  /証跡管理/,
  /GoogleAds管理/,
  /ピックアップ記事管理/,
  
  // 機能系ドメイン
  /求人・教室管理機能/,
  /教室管理機能/,
  /教室管理-求人管理機能/,
  /オファー管理機能/,
  /応募管理機能/,
  /採用確認管理機能/,
  /記事管理機能/,
  /口コミ管理機能/,
  /アカウント管理機能/,
  /サイト設定管理機能/,
  /契約管理機能/,
  /請求管理機能/,
  /メッセージ管理機能/,
  /急募管理機能/,
  /オシゴトQ&A管理機能/,
  /パーソナルオファー管理機能/,
  /自動オファー管理機能/,
  /採用確認管理機能/,
  /採用お祝い申請管理機能/,
  /企業別採用管理機能/,
  /応募履歴管理機能/,
  /その他管理機能/,
  /metaタグ管理機能/,
  /問合せ管理機能/,
  /メール送信履歴管理機能/,
  /請求書明細管理機能/,
  /請求書PDF管理機能/,
  /アクセス集計管理機能/,
  /全アカウント管理機能/,
  /管理者管理機能/,
  /企業担当者管理機能/,
  /マイページ各種管理機能/,
  /証跡管理機能/,
  /GoogleAds管理機能/,
  /ピックアップ記事管理機能/,
  
  // バッチ系ドメイン
  /教室・求人情報関連バッチ/,
  /契約関連バッチ/,
  /採用・採用お祝い関連バッチ/,
  /応募・面接関連バッチ/,
  /記事関連バッチ/,
  /請求関連バッチ/,
  /会員情報関連バッチ/,
  /オファー関連バッチ/,
  /システム内部処理関連バッチ/,
  /外部システム連携用バッチ/,
  /分析用データ生成バッチ/,
  
  // その他のドメイン
  /求人・応募・採用/,
  /企業・教室/,
  /会員/,
  /記事・バナー/,
  /請求/,
  /オファー/,
  /全体管理/,
  /サービスサイト/,
  /クライアント企業向け管理画面/,
  /全体管理画面/,
  /要件定義/,
  /ワークフロー/,
  /データ移行処理バッチ/
];

/**
 * ドメイン名かどうかを判定
 */
function isDomainName(keyword: string): boolean {
  return DOMAIN_PATTERNS.some(pattern => pattern.test(keyword));
}

/**
 * キーワードの正規化
 */
function normalizeKeyword(keyword: string, options: DeduplicationOptions): string {
  let normalized = keyword;
  
  if (options.trimWhitespace !== false) {
    normalized = normalized.trim();
  }
  
  if (!options.caseSensitive) {
    normalized = normalized.toLowerCase();
  }
  
  return normalized;
}

/**
 * 類似キーワードの検出（完全一致のみ版）
 */
function findSimilarKeywords(keyword: string, keywords: string[], options: DeduplicationOptions): string[] {
  const normalized = normalizeKeyword(keyword, options);
  const similar: string[] = [];
  
  for (const other of keywords) {
    if (other === keyword) continue;
    
    const otherNormalized = normalizeKeyword(other, options);
    
    // 完全一致のみを検出（部分一致は削除）
    if (normalized === otherNormalized) {
      similar.push(other);
    }
  }
  
  return similar;
}

/**
 * キーワードの重複削除（改善版）
 */
export function deduplicateKeywords(
  keywords: string[], 
  options: DeduplicationOptions = {}
): DeduplicationResult {
  const {
    caseSensitive = false,
    trimWhitespace = true,
    preserveOrder = true,
    minLength = 1,
    maxLength = 100,
    protectDomainNames = true
  } = options;
  
  // フィルタリング（空文字列も除外）
  const filteredKeywords = keywords.filter(keyword => {
    const normalized = normalizeKeyword(keyword, options);
    return normalized.length >= minLength && 
           normalized.length <= maxLength && 
           normalized.trim() !== ''; // 空文字列を除外
  });
  
  const seen = new Set<string>();
  const uniqueKeywords: string[] = [];
  const removedDuplicates: string[] = [];
  const removedSimilar: string[] = [];
  const protectedKeywords: string[] = [];
  
  // ドメイン名を優先的に処理
  const domainKeywords = filteredKeywords.filter(isDomainName);
  const nonDomainKeywords = filteredKeywords.filter(kw => !isDomainName(kw));
  
  // ドメイン名の重複削除
  for (const keyword of domainKeywords) {
    const normalized = normalizeKeyword(keyword, options);
    
    if (seen.has(normalized)) {
      removedDuplicates.push(keyword);
      continue;
    }
    
    seen.add(normalized);
    uniqueKeywords.push(keyword);
    if (protectDomainNames) {
      protectedKeywords.push(keyword);
    }
  }
  
  // 非ドメイン名の重複削除
  for (const keyword of nonDomainKeywords) {
    const normalized = normalizeKeyword(keyword, options);
    
    if (seen.has(normalized)) {
      removedDuplicates.push(keyword);
      continue;
    }
    
    // 完全一致の重複のみをチェック（部分一致統合は削除）
    const similar = findSimilarKeywords(keyword, uniqueKeywords, options);
    if (similar.length > 0) {
      // 完全一致の場合は重複として削除
      removedSimilar.push(keyword);
      continue;
    }
    
    seen.add(normalized);
    uniqueKeywords.push(keyword);
  }
  
  // 統計計算
  const originalCount = keywords.length;
  const uniqueCount = uniqueKeywords.length;
  const duplicateCount = removedDuplicates.length;
  const similarCount = removedSimilar.length;
  const protectedCount = protectedKeywords.length;
  const reductionRate = ((originalCount - uniqueCount) / originalCount) * 100;
  
  return {
    uniqueKeywords: preserveOrder ? uniqueKeywords : uniqueKeywords.sort(),
    removedDuplicates,
    removedSimilar,
    protectedKeywords,
    statistics: {
      originalCount,
      uniqueCount,
      duplicateCount,
      similarCount,
      protectedCount,
      reductionRate
    }
  };
}

/**
 * 機能別キーワードの重複削除（改善版）
 */
export function deduplicateFunctionKeywords(
  functions: Record<string, { 
    domainNames?: string[];
    functionNames?: string[];
    operationNames?: string[];
    relatedKeywords?: string[];
  }>,
  options: DeduplicationOptions = {}
): Record<string, { 
  domainNames: string[];
  functionNames: string[];
  operationNames: string[];
  relatedKeywords: string[];
  deduplicationStats: DeduplicationResult['statistics'];
}> {
  const result: Record<string, any> = {};
  
  for (const [functionName, functionData] of Object.entries(functions)) {
    const allKeywords = [
      ...(functionData.domainNames || []),
      ...(functionData.functionNames || []),
      ...(functionData.operationNames || []),
      ...(functionData.relatedKeywords || [])
    ];
    
    const deduplicationResult = deduplicateKeywords(allKeywords, options);
    
    // カテゴリ別に再分類
    const domainNames = deduplicationResult.uniqueKeywords.filter(isDomainName);
    const functionNames = deduplicationResult.uniqueKeywords.filter(kw => 
      !isDomainName(kw) && (kw.includes('機能') || kw.includes('閲覧') || kw.includes('登録') || kw.includes('編集'))
    );
    const operationNames = deduplicationResult.uniqueKeywords.filter(kw => 
      !isDomainName(kw) && !functionNames.includes(kw) && 
      (kw.includes('閲覧') || kw.includes('登録') || kw.includes('編集') || kw.includes('削除') || kw.includes('一覧'))
    );
    const relatedKeywords = deduplicationResult.uniqueKeywords.filter(kw => 
      !isDomainName(kw) && !functionNames.includes(kw) && !operationNames.includes(kw)
    );
    
    result[functionName] = {
      domainNames,
      functionNames,
      operationNames,
      relatedKeywords,
      deduplicationStats: deduplicationResult.statistics
    };
  }
  
  return result;
}

/**
 * グローバル重複削除（改善版）
 */
export function deduplicateGlobalKeywords(
  functions: Record<string, { 
    domainNames?: string[];
    functionNames?: string[];
    operationNames?: string[];
    relatedKeywords?: string[];
  }>,
  options: DeduplicationOptions = {}
): DeduplicationResult {
  // 全キーワードを収集
  const allKeywords: string[] = [];
  Object.values(functions).forEach(func => {
    allKeywords.push(...(func.domainNames || []));
    allKeywords.push(...(func.functionNames || []));
    allKeywords.push(...(func.operationNames || []));
    allKeywords.push(...(func.relatedKeywords || []));
  });
  
  return deduplicateKeywords(allKeywords, options);
}
