/**
 * キーワード重複削除ユーティリティ
 * 効率的なキーワード管理のための重複削除機能
 */

export interface DeduplicationOptions {
  caseSensitive?: boolean;
  trimWhitespace?: boolean;
  normalizeSimilar?: boolean;
  preserveOrder?: boolean;
  minLength?: number;
  maxLength?: number;
}

export interface DeduplicationResult {
  uniqueKeywords: string[];
  removedDuplicates: string[];
  removedSimilar: string[];
  statistics: {
    originalCount: number;
    uniqueCount: number;
    duplicateCount: number;
    similarCount: number;
    reductionRate: number;
  };
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
 * 類似キーワードの検出
 */
function findSimilarKeywords(keyword: string, keywords: string[], options: DeduplicationOptions): string[] {
  if (!options.normalizeSimilar) return [];
  
  const normalized = normalizeKeyword(keyword, options);
  const similar: string[] = [];
  
  for (const other of keywords) {
    if (other === keyword) continue;
    
    const otherNormalized = normalizeKeyword(other, options);
    
    // 部分一致チェック（長い方に短い方が含まれる）
    if (normalized.length > otherNormalized.length) {
      if (normalized.includes(otherNormalized) && otherNormalized.length >= 3) {
        similar.push(other);
      }
    } else if (otherNormalized.length > normalized.length) {
      if (otherNormalized.includes(normalized) && normalized.length >= 3) {
        similar.push(other);
      }
    }
  }
  
  return similar;
}

/**
 * キーワードの重複削除
 */
export function deduplicateKeywords(
  keywords: string[], 
  options: DeduplicationOptions = {}
): DeduplicationResult {
  const {
    caseSensitive = false,
    trimWhitespace = true,
    normalizeSimilar = true,
    preserveOrder = true,
    minLength = 1,
    maxLength = 100
  } = options;
  
  // フィルタリング
  const filteredKeywords = keywords.filter(keyword => {
    const normalized = normalizeKeyword(keyword, options);
    return normalized.length >= minLength && normalized.length <= maxLength;
  });
  
  const seen = new Set<string>();
  const uniqueKeywords: string[] = [];
  const removedDuplicates: string[] = [];
  const removedSimilar: string[] = [];
  
  // 重複削除
  for (const keyword of filteredKeywords) {
    const normalized = normalizeKeyword(keyword, options);
    
    if (seen.has(normalized)) {
      removedDuplicates.push(keyword);
      continue;
    }
    
    // 類似キーワードのチェック
    if (normalizeSimilar) {
      const similar = findSimilarKeywords(keyword, uniqueKeywords, options);
      if (similar.length > 0) {
        // より具体的なキーワードを優先
        const isMoreSpecific = keyword.length > similar[0].length;
        if (isMoreSpecific) {
          // 現在のキーワードがより具体的
          const index = uniqueKeywords.findIndex(k => k === similar[0]);
          if (index !== -1) {
            removedSimilar.push(uniqueKeywords[index]);
            uniqueKeywords[index] = keyword;
            seen.add(normalized);
          }
        } else {
          // 既存のキーワードがより具体的
          removedSimilar.push(keyword);
        }
        continue;
      }
    }
    
    seen.add(normalized);
    uniqueKeywords.push(keyword);
  }
  
  // 統計計算
  const originalCount = keywords.length;
  const uniqueCount = uniqueKeywords.length;
  const duplicateCount = removedDuplicates.length;
  const similarCount = removedSimilar.length;
  const reductionRate = ((originalCount - uniqueCount) / originalCount) * 100;
  
  return {
    uniqueKeywords: preserveOrder ? uniqueKeywords : uniqueKeywords.sort(),
    removedDuplicates,
    removedSimilar,
    statistics: {
      originalCount,
      uniqueCount,
      duplicateCount,
      similarCount,
      reductionRate
    }
  };
}

/**
 * 機能別キーワードの重複削除
 */
export function deduplicateFunctionKeywords(
  functions: Record<string, { keywords: string[] }>,
  options: DeduplicationOptions = {}
): Record<string, { keywords: string[]; deduplicationStats: DeduplicationResult['statistics'] }> {
  const result: Record<string, { keywords: string[]; deduplicationStats: DeduplicationResult['statistics'] }> = {};
  
  for (const [functionName, functionData] of Object.entries(functions)) {
    const deduplicationResult = deduplicateKeywords(functionData.keywords, options);
    
    result[functionName] = {
      keywords: deduplicationResult.uniqueKeywords,
      deduplicationStats: deduplicationResult.statistics
    };
  }
  
  return result;
}

/**
 * グローバル重複削除（全機能を横断）
 */
export function deduplicateGlobalKeywords(
  functions: Record<string, { keywords: string[] }>,
  options: DeduplicationOptions = {}
): DeduplicationResult {
  // 全キーワードを収集
  const allKeywords: string[] = [];
  Object.values(functions).forEach(func => {
    allKeywords.push(...func.keywords);
  });
  
  return deduplicateKeywords(allKeywords, options);
}
