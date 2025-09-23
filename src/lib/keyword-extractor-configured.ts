/*
 * 設定値化されたキーワード抽出ライブラリ
 * keyword-lists-v2.jsonを活用した高精度キーワード抽出
 */

import { KeywordListsLoader } from './keyword-lists-loader';

type ExtractResult = {
  keywords: string[];
  highPriority: Set<string>;
  mediumPriority: Set<string>;
  lowPriority: Set<string>;
  criticalPriority: Set<string>;
  metadata: {
    query: string;
    processingTime: number;
    keywordSource: 'keyword-lists' | 'fallback';
    statistics: {
      totalExtracted: number;
      byCategory: {
        domainNames: number;
        functionNames: number;
        operationNames: number;
        systemFields: number;
        systemTerms: number;
        relatedKeywords: number;
      };
    };
  };
};

const STOPWORDS = new Set<string>([
  'こと','もの','ため','など','これ','それ','あれ','について','の','は','が','を','に','で','と','や','から','まで','より','へ','も','な','だ','です','ます','ください','教えて','件','ですか','とは'
]);

/**
 * 設定値化されたキーワード抽出関数
 */
export async function extractKeywordsConfigured(query: string): Promise<ExtractResult> {
  const startTime = Date.now();
  
  try {
    const keywordListsLoader = KeywordListsLoader.getInstance();
    
    // キーワードリストが読み込まれていない場合は初期化
    if (!keywordListsLoader.isLoaded()) {
      await keywordListsLoader.loadKeywordLists();
    }
    
    // キーワードリストからキーワードを抽出
    const extractedKeywords = keywordListsLoader.extractKeywords(query);
    
    // フォールバック: 基本的なキーワード抽出も追加
    const fallbackKeywords = extractFallbackKeywords(query);
    
    // 全キーワードを結合
    const allKeywords = [...extractedKeywords.allKeywords, ...fallbackKeywords];
    const uniqueKeywords = [...new Set(allKeywords)];
    
    // 優先度別に分類（動的優先順位を使用）
    const prioritySets = categorizeByPriority(uniqueKeywords, keywordListsLoader, query);
    
    // 最終的なキーワード選択（最大12個）
    const finalKeywords = selectFinalKeywords(prioritySets, 12);
    
    const processingTime = Date.now() - startTime;
    
    return {
      keywords: finalKeywords,
      criticalPriority: prioritySets.critical,
      highPriority: prioritySets.high,
      mediumPriority: prioritySets.medium,
      lowPriority: prioritySets.low,
      metadata: {
        query,
        processingTime,
        keywordSource: extractedKeywords.allKeywords.length > 0 ? 'keyword-lists' : 'fallback',
        statistics: {
          totalExtracted: finalKeywords.length,
          byCategory: {
            domainNames: extractedKeywords.domainNames.length,
            functionNames: extractedKeywords.functionNames.length,
            operationNames: extractedKeywords.operationNames.length,
            systemFields: extractedKeywords.systemFields.length,
            systemTerms: extractedKeywords.systemTerms.length,
            relatedKeywords: extractedKeywords.relatedKeywords.length
          }
        }
      }
    };
    
  } catch (error) {
    console.error('[extractKeywordsConfigured] エラー:', error);
    
    // エラー時はフォールバック
    const fallbackKeywords = extractFallbackKeywords(query);
    const processingTime = Date.now() - startTime;
    
    return {
      keywords: fallbackKeywords,
      criticalPriority: new Set(),
      highPriority: new Set(fallbackKeywords.map(k => k.toLowerCase())),
      mediumPriority: new Set(),
      lowPriority: new Set(),
      metadata: {
        query,
        processingTime,
        keywordSource: 'fallback',
        statistics: {
          totalExtracted: fallbackKeywords.length,
          byCategory: {
            domainNames: 0,
            functionNames: 0,
            operationNames: 0,
            systemFields: 0,
            systemTerms: 0,
            relatedKeywords: 0
          }
        }
      }
    };
  }
}

/**
 * フォールバック用のキーワード抽出
 */
function extractFallbackKeywords(query: string): string[] {
  const keywords: string[] = [];
  
  // 助詞・記号で分割
  const parts = query.split(/[の・・、は？]/g).filter(part => part.trim().length > 0);
  
  for (const part of parts) {
    const words = part.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9_.-]+/gu) || [];
    
    for (const word of words) {
      if (word.length >= 2 && word.length <= 6 && !STOPWORDS.has(word)) {
        keywords.push(word);
      }
    }
  }
  
  return [...new Set(keywords)];
}

/**
 * 優先度別にキーワードを分類（動的優先順位対応版）
 */
function categorizeByPriority(
  keywords: string[], 
  keywordListsLoader: KeywordListsLoader,
  query: string
): {
  critical: Set<string>;
  high: Set<string>;
  medium: Set<string>;
  low: Set<string>;
} {
  const prioritySets = {
    critical: new Set<string>(),
    high: new Set<string>(),
    medium: new Set<string>(),
    low: new Set<string>()
  };
  
  for (const keyword of keywords) {
    const priority = keywordListsLoader.getKeywordPriority(keyword, query);
    prioritySets[priority].add(keyword.toLowerCase());
  }
  
  return prioritySets;
}

/**
 * 最終的なキーワードを選択
 */
function selectFinalKeywords(
  prioritySets: {
    critical: Set<string>;
    high: Set<string>;
    medium: Set<string>;
    low: Set<string>;
  },
  maxKeywords: number
): string[] {
  const selectedKeywords: string[] = [];
  
  // 優先度順に選択
  const priorities = [
    { set: prioritySets.critical, name: 'critical' },
    { set: prioritySets.high, name: 'high' },
    { set: prioritySets.medium, name: 'medium' },
    { set: prioritySets.low, name: 'low' }
  ];
  
  for (const { set } of priorities) {
    for (const keyword of set) {
      if (selectedKeywords.length < maxKeywords && !selectedKeywords.includes(keyword)) {
        selectedKeywords.push(keyword);
      }
    }
  }
  
  return selectedKeywords;
}

/**
 * キーワード抽出の詳細分析
 */
export async function analyzeKeywordExtraction(query: string): Promise<{
  query: string;
  result: ExtractResult;
  analysis: {
    totalKeywords: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    hasDomainKeywords: boolean;
    hasFunctionKeywords: boolean;
    qualityScore: number;
    coverage: {
      domainNames: number;
      functionNames: number;
      operationNames: number;
      systemFields: number;
      systemTerms: number;
      relatedKeywords: number;
    };
  };
}> {
  const result = await extractKeywordsConfigured(query);
  
  const analysis = {
    totalKeywords: result.keywords.length,
    criticalCount: result.criticalPriority.size,
    highCount: result.highPriority.size,
    mediumCount: result.mediumPriority.size,
    lowCount: result.lowPriority.size,
    hasDomainKeywords: result.criticalPriority.size > 0,
    hasFunctionKeywords: result.highPriority.size > 0,
    qualityScore: 0,
    coverage: result.metadata.statistics.byCategory
  };
  
  // 品質スコア計算
  let score = 0;
  if (analysis.totalKeywords >= 3) score += 20;
  if (analysis.hasDomainKeywords) score += 30;
  if (analysis.hasFunctionKeywords) score += 30;
  if (analysis.totalKeywords > 0) {
    const diversityScore = Math.min(20, (analysis.totalKeywords / 12) * 20);
    score += diversityScore;
  }
  analysis.qualityScore = score;
  
  return {
    query,
    result,
    analysis
  };
}

/**
 * 複数クエリの一括分析
 */
export async function batchAnalyzeKeywordExtraction(queries: string[]): Promise<{
  queries: string[];
  results: Array<{
    query: string;
    result: ExtractResult;
    analysis: any;
  }>;
  summary: {
    totalQueries: number;
    averageQualityScore: number;
    successRate: number;
    averageProcessingTime: number;
    keywordSourceDistribution: {
      keywordLists: number;
      fallback: number;
    };
  };
}> {
  const results = [];
  let totalScore = 0;
  let successCount = 0;
  let totalProcessingTime = 0;
  let keywordListsCount = 0;
  let fallbackCount = 0;
  
  for (const query of queries) {
    try {
      const analysis = await analyzeKeywordExtraction(query);
      results.push(analysis);
      totalScore += analysis.analysis.qualityScore;
      totalProcessingTime += analysis.result.metadata.processingTime;
      
      if (analysis.result.metadata.keywordSource === 'keyword-lists') {
        keywordListsCount++;
      } else {
        fallbackCount++;
      }
      
      if (analysis.analysis.qualityScore >= 70) {
        successCount++;
      }
    } catch (error) {
      console.error(`[batchAnalyzeKeywordExtraction] クエリ "${query}" の分析に失敗:`, error);
    }
  }
  
  const summary = {
    totalQueries: queries.length,
    averageQualityScore: results.length > 0 ? totalScore / results.length : 0,
    successRate: queries.length > 0 ? (successCount / queries.length) * 100 : 0,
    averageProcessingTime: results.length > 0 ? totalProcessingTime / results.length : 0,
    keywordSourceDistribution: {
      keywordLists: keywordListsCount,
      fallback: fallbackCount
    }
  };
  
  return {
    queries,
    results,
    summary
  };
}
