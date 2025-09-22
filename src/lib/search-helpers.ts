/**
 * 検索処理のヘルパー関数群
 */
import { LanceDBSearchParams, LanceDBSearchResult } from './lancedb-search-client';
import { LabelFilterOptions } from './search-weights';
import { lunrSearchClient } from './lunr-search-client';
import { lunrInitializer } from './lunr-initializer';
import { calculateKeywordScore, calculateHybridScore } from './search-weights';
import { getLabelsAsArray } from './label-utils';
import { labelManager } from './label-manager';

/**
 * ベクトル検索を実行する
 */
export async function executeVectorSearch(
  tbl: any,
  vector: number[],
  params: LanceDBSearchParams,
  excludeLabels: string[]
): Promise<any[]> {
  try {
    let vectorQuery = tbl.search(vector);
    if (params.filter) {
      vectorQuery = vectorQuery.where(params.filter);
    }
    
    // 除外される可能性を考慮して多めに取得
    const topK = params.topK || 5;
    let vectorResults = await vectorQuery.limit(topK * 2).toArray();
    console.log(`[executeVectorSearch] Vector search found ${vectorResults.length} results before filtering`);
    
    // ラベルフィルタリングを適用（統一されたLabelManagerを使用）
    if (excludeLabels.length > 0) {
      const beforeCount = vectorResults.length;
      vectorResults = vectorResults.filter(result => {
        if (labelManager.isExcluded(result.labels, excludeLabels)) {
          console.log(`[executeVectorSearch] Excluded result due to label filter: ${result.title}`);
          return false;
        }
        return true;
      });
      console.log(`[executeVectorSearch] Vector search filtered from ${beforeCount} to ${vectorResults.length} results`);
    }
    
    return vectorResults;
  } catch (error) {
    console.error('[executeVectorSearch] Vector search failed:', error);
    return [];
  }
}

/**
 * キーワード検索を実行する
 */
export async function executeKeywordSearch(
  tbl: any,
  keywords: string[],
  highPriority: string[],
  lowPriority: string[],
  params: LanceDBSearchParams,
  excludeLabels: string[]
): Promise<any[]> {
  try {
    const topK = params.topK || 5;
    let keywordResults: any[] = [];
    
    if (keywords.length > 0) {
      // キーワード検索の実行
      const keywordConditions = keywords.map(keyword => 
        `title LIKE '%${keyword}%' OR content LIKE '%${keyword}%'`
      ).join(' OR ');
      
      let keywordQuery = tbl.query().where(keywordConditions);
      if (params.filter) {
        keywordQuery = keywordQuery.where(params.filter);
      }
      
      keywordResults = await keywordQuery.limit(topK * 2).toArray();
      console.log(`[executeKeywordSearch] Keyword search found ${keywordResults.length} results`);
      
      // ラベルフィルタリングを適用
      if (excludeLabels.length > 0) {
        const beforeCount = keywordResults.length;
        keywordResults = keywordResults.filter(result => {
          return !labelManager.isExcluded(result.labels, excludeLabels);
        });
        console.log(`[executeKeywordSearch] Keyword search filtered from ${beforeCount} to ${keywordResults.length} results`);
      }
    }
    
    return keywordResults;
  } catch (error) {
    console.error('[executeKeywordSearch] Keyword search failed:', error);
    return [];
  }
}

/**
 * BM25検索を実行する
 */
export async function executeBM25Search(
  params: LanceDBSearchParams,
  keywords: string[],
  excludeLabels: string[]
): Promise<any[]> {
  try {
    const topK = params.topK || 5;
    let bm25Results: any[] = [];
    
    console.log(`[executeBM25Search] Debug - useLunrIndex: ${params.useLunrIndex}, isReady: ${lunrInitializer.isReady()}, keywords.length: ${keywords.length}`);
    
    if (params.useLunrIndex && lunrInitializer.isReady() && keywords.length > 0) {
      console.log('[executeBM25Search] Using Lunr BM25 search');
      
      // Lunr BM25検索の実行（候補検索）
      const lunrResults = excludeLabels.length > 0
        ? await lunrSearchClient.searchWithFilters(params.query, { excludeLabels }, topK * 2)
        : await lunrSearchClient.searchCandidates(params.query, topK * 2);
      
      if (lunrResults.length > 0) {
        // pageIdでLanceDBから詳細情報を取得（インライン接続）
        const pageIds = lunrResults.map(r => r.pageId).filter(Boolean);
        if (pageIds.length > 0) {
          const lancedb = await import('@lancedb/lancedb');
          const db = await lancedb.connect('.lancedb');
          const tbl = await db.openTable('confluence');

          const detailedResults: any[] = [];
          for (const pid of pageIds) {
            const lower = pid;
            const upper = pid + 1;
            const where = `"pageId" >= ${lower} AND "pageId" < ${upper}`;
            const rows = await (tbl as any).query().where(where).toArray();
            if (rows && rows.length > 0) {
              // BM25スコアを紐付け
              const match = lunrResults.find(x => x.pageId === pid);
              const score = match ? match.score : 0;
              rows.forEach((r: any) => {
                r.source = 'bm25';
                r.scoreRaw = score;
                r.scoreKind = 'bm25';
                r.scoreText = `BM25 ${Number(score).toFixed(2)}`;
              });
              detailedResults.push(...rows);
            }
          }
          
          // ラベルフィルタリング（保険）
          if (excludeLabels.length > 0) {
            bm25Results = detailedResults.filter(result => {
              return !labelManager.isExcluded(result.labels, excludeLabels);
            });
          } else {
            bm25Results = detailedResults;
          }
          
          console.log(`[executeBM25Search] BM25 search found ${bm25Results.length} results after filtering`);
        }
      }
    } else {
      console.log('[executeBM25Search] BM25 search skipped (Lunr not ready or no keywords)');
    }
    
    return bm25Results;
  } catch (error) {
    console.error('[executeBM25Search] BM25 search failed:', error);
    return [];
  }
}

/**
 * タイトル厳格一致検索を実行する
 */
export async function executeTitleExactSearch(
  tbl: any,
  params: LanceDBSearchParams,
  excludeLabels: string[]
): Promise<any[]> {
  try {
    const topK = params.topK || 5;
    let titleExactResults: any[] = [];
    
    if (params.exactTitleCandidates && params.exactTitleCandidates.length > 0) {
      console.log('[executeTitleExactSearch] Executing title exact match search');
      
      const titleConditions = params.exactTitleCandidates.map(title => 
        `title = '${title.replace(/'/g, "''")}'`
      ).join(' OR ');
      
      let titleQuery = tbl.query().where(titleConditions);
      if (params.filter) {
        titleQuery = titleQuery.where(params.filter);
      }
      
      titleExactResults = await titleQuery.limit(topK).toArray();
      console.log(`[executeTitleExactSearch] Title exact search found ${titleExactResults.length} results`);
      
      // ラベルフィルタリングを適用
      if (excludeLabels.length > 0) {
        const beforeCount = titleExactResults.length;
        titleExactResults = titleExactResults.filter(result => {
          return !labelManager.isExcluded(result.labels, excludeLabels);
        });
        console.log(`[executeTitleExactSearch] Title exact search filtered from ${beforeCount} to ${titleExactResults.length} results`);
      }
    }
    
    return titleExactResults;
  } catch (error) {
    console.error('[executeTitleExactSearch] Title exact search failed:', error);
    return [];
  }
}

/**
 * 検索結果にスコアを計算して追加する
 */
export function calculateSearchScores(
  results: any[],
  params: LanceDBSearchParams,
  keywords: string[],
  highPriority: string[],
  lowPriority: string[],
  labelFilters: LabelFilterOptions
): any[] {
  return results.map(result => {
    // ラベルスコアの計算
    const labels = getLabelsAsArray(result.labels);
    
    // キーワードスコアの計算
    const keywordScoreInfo = calculateKeywordScore(
      result.title || '',
      result.content || '',
      labels,
      keywords,
      { 
        highPriority: new Set(highPriority), 
        lowPriority: new Set(lowPriority) 
      }
    );
    
    // ハイブリッドスコアの計算（ラベルスコアは0に固定）
    const hybridScore = calculateHybridScore(
      result._distance || 0,
      keywordScoreInfo.score,
      0  // ラベルスコアは使用しない
    );
    
    return {
      ...result,
      _keywordScore: keywordScoreInfo.score,
      _labelScore: 0,  // ラベルスコアは使用しない
      _hybridScore: hybridScore
    };
  });
}

/**
 * 重複検索結果を除去する
 */
export function deduplicateResults(results: any[]): any[] {
  const uniqueResults = new Map<string, any>();
  
  for (const result of results) {
    const title = String(result.title || '').trim();
    if (title && !uniqueResults.has(title)) {
      uniqueResults.set(title, result);
    }
  }
  
  const deduplicatedResults = Array.from(uniqueResults.values());
  console.log(`[deduplicateResults] Removed ${results.length - deduplicatedResults.length} duplicate results`);
  
  return deduplicatedResults;
}
