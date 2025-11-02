/**
 * タイトル検索サービス（Phase 0A-4: Enhanced Hybrid Search）
 * 
 * タイトル検索を最優先化し、Early Exit機能を実装
 * 参考: https://zenn.dev/yumefuku/articles/llm-neo4j-hybrid
 */

/**
 * タイトル類似度計算（Levenshtein距離ベース）
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const s1 = title1.toLowerCase().replace(/[、。！？\s_【】\(\)]/g, '');
  const s2 = title2.toLowerCase().replace(/[、。！？\s_【】\(\)]/g, '');
  
  // Levenshtein距離を計算
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return len2 === 0 ? 1.0 : 0.0;
  if (len2 === 0) return 0.0;
  
  const matrix: number[][] = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 削除
        matrix[i][j - 1] + 1,      // 挿入
        matrix[i - 1][j - 1] + cost // 置換
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  
  return 1.0 - (distance / maxLen);
}

/**
 * タイトル厳格一致検索結果
 */
export interface TitleExactSearchResult {
  id: string;
  pageId: string;
  title: string;
  content: string;
  similarity: number;
  source: 'title-exact';
}

/**
 * タイトル部分一致検索結果
 */
export interface TitlePartialSearchResult {
  id: string;
  pageId: string;
  title: string;
  content: string;
  matchedKeywords: string[];
  matchRatio: number;
  source: 'title-partial';
}

/**
 * タイトル検索サービス
 */
export class TitleSearchService {
  private static instance: TitleSearchService;
  
  private constructor() {}
  
  public static getInstance(): TitleSearchService {
    if (!TitleSearchService.instance) {
      TitleSearchService.instance = new TitleSearchService();
    }
    return TitleSearchService.instance;
  }
  
  /**
   * タイトル厳格一致検索（Early Exit）
   * 
   * クエリとタイトルの類似度が85%以上の場合、即座に返す
   */
  public searchTitleExact(
    query: string,
    allRecords: any[],
    threshold: number = 0.85
  ): TitleExactSearchResult[] {
    const startTime = Date.now();
    
    const normalizedQuery = query.toLowerCase().replace(/[、。！？\s]/g, '');
    
    const exactMatches = allRecords
      .map(record => {
        const title = String(record.title || '');
        const similarity = calculateTitleSimilarity(title, query);
        
        return {
          ...record,
          similarity
        };
      })
      .filter(r => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity);
    
    const elapsed = Date.now() - startTime;
    
    if (exactMatches.length > 0) {
      console.log(`[TitleExactSearch] Found ${exactMatches.length} exact matches in ${elapsed}ms`);
      exactMatches.slice(0, 3).forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match.title} (similarity: ${(match.similarity * 100).toFixed(1)}%)`);
      });
    }
    
    // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
    const { getPageIdFromRecord } = await import('./pageid-migration-helper');
    return exactMatches.map(r => {
      const pageId = getPageIdFromRecord(r) || r.pageId || r.id;
      return {
        id: r.id,
        pageId: pageId,
        title: r.title,
        content: r.content,
        similarity: r.similarity,
        source: 'title-exact' as const
      };
    });
  }
  
  /**
   * タイトル部分一致検索（キーワードベース）
   * 
   * 抽出されたキーワードがタイトルに含まれるかチェック
   */
  public searchTitlePartial(
    keywords: string[],
    allRecords: any[],
    minMatchRatio: number = 0.33
  ): TitlePartialSearchResult[] {
    const startTime = Date.now();
    
    const partialMatches = allRecords
      .map(record => {
        const title = String(record.title || '').toLowerCase();
        
        // キーワードマッチング
        const matchedKeywords = keywords.filter(kw => 
          title.includes(kw.toLowerCase())
        );
        
        const matchRatio = keywords.length > 0 
          ? matchedKeywords.length / keywords.length 
          : 0;
        
        return {
          ...record,
          matchedKeywords,
          matchRatio
        };
      })
      .filter(r => r.matchRatio >= minMatchRatio)
      .sort((a, b) => b.matchRatio - a.matchRatio);
    
    const elapsed = Date.now() - startTime;
    
    if (partialMatches.length > 0) {
      console.log(`[TitlePartialSearch] Found ${partialMatches.length} partial matches in ${elapsed}ms`);
      partialMatches.slice(0, 5).forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match.title}`);
        console.log(`     Matched keywords: [${match.matchedKeywords.join(', ')}] (${(match.matchRatio * 100).toFixed(0)}%)`);
      });
    }
    
    // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
    return partialMatches.map(r => {
      const pageId = getPageIdFromRecord(r) || r.pageId || r.id;
      return {
        id: r.id,
        pageId: pageId,
        title: r.title,
        content: r.content,
        matchedKeywords: r.matchedKeywords,
        matchRatio: r.matchRatio,
        source: 'title-partial' as const
      };
    });
  }
  
  /**
   * ラベル一致検索
   * 
   * domain/category/tagに基づいてページを検索
   */
  public async searchByLabel(
    keywords: string[],
    allRecords: any[],
    minScore: number = 0.3
  ): Promise<any[]> {
    const startTime = Date.now();
    
    // StructuredLabel情報を使用してフィルタリング
    const labelMatches = allRecords
      .map(record => {
        let labelScore = 0;
        let matchDetails: string[] = [];
        
        // domainマッチング
        const title = String(record.title || '').toLowerCase();
        
        // タイトルからドメインを推定
        if (keywords.some(kw => title.includes(kw))) {
          labelScore += 0.5;
          matchDetails.push('title-keyword');
        }
        
        // labelsフィールドをチェック
        const labels = Array.isArray(record.labels) ? record.labels : [];
        const labelKeywordMatch = labels.some((label: string) =>
          keywords.some(kw => label.toLowerCase().includes(kw.toLowerCase()))
        );
        
        if (labelKeywordMatch) {
          labelScore += 0.5;
          matchDetails.push('label-keyword');
        }
        
        return {
          ...record,
          labelScore,
          matchDetails
        };
      })
      .filter(r => r.labelScore >= minScore)
      .sort((a, b) => b.labelScore - a.labelScore);
    
    const elapsed = Date.now() - startTime;
    
    if (labelMatches.length > 0) {
      console.log(`[LabelSearch] Found ${labelMatches.length} label matches in ${elapsed}ms`);
      labelMatches.slice(0, 3).forEach((match, idx) => {
        console.log(`  ${idx + 1}. ${match.title} (score: ${match.labelScore.toFixed(2)}, ${match.matchDetails.join(', ')})`);
      });
    }
    
    return labelMatches.map(r => ({
      ...r,
      source: 'label-match'
    }));
  }
  
  /**
   * 統合タイトル検索（厳格一致 + 部分一致 + ラベル一致）
   */
  public async searchTitleCombined(
    query: string,
    keywords: string[],
    allRecords: any[]
  ): Promise<any[]> {
    console.log('\n[TitleSearchService] Starting combined title search...');
    console.log(`  Query: "${query}"`);
    console.log(`  Keywords: [${keywords.join(', ')}]`);
    console.log(`  Total records: ${allRecords.length}\n`);
    
    const startTime = Date.now();
    
    // 1. タイトル厳格一致検索（Early Exit）
    const exactMatches = this.searchTitleExact(query, allRecords, 0.85);
    
    if (exactMatches.length > 0) {
      console.log(`[TitleSearchService] Early Exit: ${exactMatches.length} exact matches found\n`);
      return exactMatches;
    }
    
    // 2. タイトル部分一致検索（キーワードベース）
    const partialMatches = this.searchTitlePartial(keywords, allRecords, 0.33);
    
    // 3. ラベル一致検索
    const labelMatches = await this.searchByLabel(keywords, allRecords, 0.3);
    
    // 4. 結果を統合（重複排除）
    const combinedResults = new Map<string, any>();
    
    // 優先度順に追加（早いものが優先）
    [...partialMatches, ...labelMatches].forEach(result => {
      const pageId = result.pageId || result.id;
      if (!combinedResults.has(pageId)) {
        combinedResults.set(pageId, result);
      }
    });
    
    const finalResults = Array.from(combinedResults.values());
    
    const elapsed = Date.now() - startTime;
    console.log(`\n[TitleSearchService] Combined search completed in ${elapsed}ms`);
    console.log(`  Results: ${finalResults.length} candidates\n`);
    
    return finalResults;
  }
}

// シングルトンインスタンスをエクスポート
export const titleSearchService = TitleSearchService.getInstance();

