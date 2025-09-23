/*
 * デバッグ用キーワード抽出ライブラリ
 * 詳細なログ出力とテスト機能付き
 */

import { extractKeywordsHybrid as productionExtract } from './keyword-extractor-production';

type ExtractResult = {
  keywords: string[];
  highPriority: Set<string>;
  lowPriority: Set<string>;
};

/**
 * デバッグ用キーワード抽出関数
 */
export async function extractKeywordsHybrid(query: string): Promise<ExtractResult> {
  console.log('[keyword-extractor] extractKeywordsHybrid called with:', query);
  
  try {
    // 本番用関数を呼び出し
    const result = await productionExtract(query);
    
    // デバッグ情報を出力
    console.log('[keyword-extractor] Final result:', {
      keywords: result.keywords,
      highPriority: Array.from(result.highPriority),
      lowPriority: Array.from(result.lowPriority),
      query: query
    });
    
    return result;
    
  } catch (error) {
    console.error('[keyword-extractor] Error in extractKeywordsHybrid:', error);
    throw error;
  }
}

/**
 * キーワード抽出の詳細分析
 */
export async function analyzeKeywordExtraction(query: string): Promise<{
  query: string;
  result: ExtractResult;
  analysis: {
    totalKeywords: number;
    highPriorityCount: number;
    lowPriorityCount: number;
    hasEntityKeywords: boolean;
    hasFunctionKeywords: boolean;
    qualityScore: number;
  };
}> {
  const result = await extractKeywordsHybrid(query);
  
  const analysis = {
    totalKeywords: result.keywords.length,
    highPriorityCount: result.highPriority.size,
    lowPriorityCount: result.lowPriority.size,
    hasEntityKeywords: result.keywords.some(kw => 
      kw.length >= 2 && kw.length <= 4 && /[\p{Script=Han}]{2,4}/u.test(kw)
    ),
    hasFunctionKeywords: result.keywords.some(kw => 
      /[一覧閲覧登録編集削除コピー機能管理詳細仕様情報データ制限条件方法手順問題原因エラー]/u.test(kw)
    ),
    qualityScore: 0
  };
  
  // 品質スコア計算
  let score = 0;
  if (analysis.totalKeywords >= 3) score += 30;
  if (analysis.hasEntityKeywords) score += 30;
  if (analysis.hasFunctionKeywords) score += 30;
  if (analysis.totalKeywords > 0) {
    const diversityScore = (analysis.totalKeywords / (analysis.totalKeywords + 1)) * 10;
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
  };
}> {
  const results = [];
  let totalScore = 0;
  let successCount = 0;
  
  for (const query of queries) {
    try {
      const analysis = await analyzeKeywordExtraction(query);
      results.push(analysis);
      totalScore += analysis.analysis.qualityScore;
      if (analysis.analysis.qualityScore >= 70) {
        successCount++;
      }
    } catch (error) {
      console.error(`[keyword-extractor] Error analyzing query "${query}":`, error);
    }
  }
  
  const summary = {
    totalQueries: queries.length,
    averageQualityScore: results.length > 0 ? totalScore / results.length : 0,
    successRate: queries.length > 0 ? (successCount / queries.length) * 100 : 0
  };
  
  return {
    queries,
    results,
    summary
  };
}
