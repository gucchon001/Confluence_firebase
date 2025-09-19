/**
 * LanceDB検索クライアント
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from './embeddings';
import { calculateKeywordScore, calculateHybridScore, calculateLabelScore, LabelFilterOptions } from './search-weights';

/**
 * LanceDB検索パラメータ
 */
export interface LanceDBSearchParams {
  query: string;
  topK?: number;
  tableName?: string;
  filter?: string;
  maxDistance?: number; // 最大距離（類似度閾値）
  useKeywordSearch?: boolean; // キーワード検索を使用するかどうか
  labelFilters?: LabelFilterOptions; // ラベルフィルタオプション
  includeLabels?: string[]; // アプリ層での包含フィルタ用ラベル
}

/**
 * LanceDB検索結果
 */
export interface LanceDBSearchResult {
  id: string;
  title: string;
  content: string;
  distance: number;
  space_key?: string;
  labels?: string[];
  url?: string;
  lastUpdated?: string;
  source?: 'vector' | 'keyword' | 'hybrid'; // 検索ソース（ベクトル検索、キーワード検索、またはハイブリッド）
  matchDetails?: {
    titleMatches?: number;
    labelMatches?: number;
    contentMatches?: number;
  }; // マッチングの詳細情報
}

/**
 * LanceDBで検索を実行する
 */
export async function searchLanceDB(params: LanceDBSearchParams): Promise<LanceDBSearchResult[]> {
  try {
    console.log(`[searchLanceDB] Starting search with query: "${params.query}"`);
    
    // デフォルト値の設定
    const topK = params.topK || 5;
    const tableName = params.tableName || 'confluence';
    
    // 埋め込みベクトルの生成
    const vector = await getEmbeddings(params.query);
    console.log(`[searchLanceDB] Generated embedding vector with ${vector.length} dimensions`);
    
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`[searchLanceDB] Connecting to LanceDB at ${dbPath}`);
    
    const db = await lancedb.connect(dbPath);
    
    // テーブル存在確認
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      console.error(`[searchLanceDB] Table '${tableName}' not found`);
      return [];
    }
    
    // テーブルを開く
    const tbl = await db.openTable(tableName);
    console.log(`[searchLanceDB] Opened table '${tableName}'`);
    
    // ハイブリッド検索の実装
    let vectorResults: any[] = [];
    let keywordResults: any[] = [];
    
    // 1. ベクトル検索の実行
    try {
      let vectorQuery = tbl.search(vector);
      if (params.filter) {
        vectorQuery = vectorQuery.where(params.filter);
      }
      vectorResults = await vectorQuery.limit(topK).toArray();
      console.log(`[searchLanceDB] Vector search found ${vectorResults.length} results`);
    } catch (err) {
      console.error(`[searchLanceDB] Vector search error: ${err}`);
      vectorResults = [];
    }

    // 1.5 フォールバック: ベクトル検索が0件でフィルタがある場合、フィルタのみで取得
    if (vectorResults.length === 0 && params.filter) {
      try {
        console.log('[searchLanceDB] Fallback to filter-only query due to 0 vector results');
        const filterOnlyResults = await tbl.query().where(params.filter).limit(topK).toArray();
        // ベクトル距離がないため、ダミーの距離を設定
        vectorResults = filterOnlyResults.map(r => ({ ...r, _distance: 1.0, _sourceType: 'filter' }));
        console.log(`[searchLanceDB] Filter-only query found ${vectorResults.length} results`);
      } catch (fallbackErr) {
        console.error('[searchLanceDB] Filter-only query error:', fallbackErr);
      }
    }
    
    // 改良版ハイブリッド検索の実装
    try {
      console.log(`[searchLanceDB] Implementing improved hybrid search`);
      
      // キーワードを抽出
      const keywords = params.query.split(/\s+/).filter(k => k.length > 1);
      console.log(`[searchLanceDB] Extracted ${keywords.length} keywords: ${keywords.join(', ')}`);
      
      // 正規化関数
      const normalize = (s: string) => s.normalize('NFKC').toLowerCase().trim();
      const includeLabelsNormalized = (params.includeLabels || []).map(l => normalize(String(l)));
      if (includeLabelsNormalized.length > 0) {
        console.log('[searchLanceDB] Applying app-level includeLabels filter:', params.includeLabels);
      }

      // 各結果にハイブリッドスコアを追加
      const resultsWithHybridScore = [];
      let keywordMatchCount = 0;
      
      // デフォルトのラベルフィルタオプション
      const defaultLabelFilters: LabelFilterOptions = {
        includeMeetingNotes: false,
        includeArchived: false
      };
      const labelFilters = params.labelFilters || defaultLabelFilters;
      console.log('[searchLanceDB] Using labelFilters:', labelFilters);
      
      // 各結果を処理
      let excludedCount = 0;
      for (let i = 0; i < vectorResults.length; i++) {
        const originalResult = vectorResults[i];
        
        // 結果のコピーを作成
        const resultWithScore = { ...originalResult };
        
        // キーワードマッチングスコアを計算
        const title = originalResult.title || '';
        const content = originalResult.content || '';
        const labels = Array.isArray(originalResult.labels)
          ? originalResult.labels
          : (originalResult.labels && typeof (originalResult.labels as any).toArray === 'function'
              ? (originalResult.labels as any).toArray()
              : []);
        
        // デバッグ情報を出力
        console.log(`[searchLanceDB] Processing result ${i+1}:`);
        console.log(`  Title: ${title}`);
        console.log(`  Labels: ${JSON.stringify(labels)}`);
        console.log(`  Content snippet: ${content.substring(0, 50)}...`);
        
        // アプリ層の包含フィルタ（任意）
        if (includeLabelsNormalized.length > 0) {
          const resultLabelsNormalized = labels.map(l => normalize(String(l)));
          const hasAny = includeLabelsNormalized.some(q => resultLabelsNormalized.includes(q));
          if (!hasAny) {
            console.log('  Excluded due to includeLabels (app-level)');
            excludedCount++;
            continue;
          }
        }

        // ラベルフィルタを適用
        const labelScoreResult = calculateLabelScore(labels, labelFilters);
        if (labelScoreResult.shouldExclude) {
          console.log(`  Excluded due to label filter`);
          excludedCount++;
          continue; // この結果をスキップ
        }
        
        // 検索重み付け関数を使用してスコアを計算
        const scoreResult = calculateKeywordScore(title, content, labels, keywords);
        const keywordScore = scoreResult.score;
        const titleMatches = scoreResult.titleMatches;
        const labelMatches = scoreResult.labelMatches;
        const contentMatches = scoreResult.contentMatches;
        
        console.log(`  Score details: keyword=${keywordScore}, title=${titleMatches}, label=${labelMatches}, content=${contentMatches}, labelScore=${labelScoreResult.score}`);
        
        // キーワードマッチがある場合はカウント
        if (keywordScore > 0) {
          keywordMatchCount++;
        }
        
        // ベクトル距離、キーワードスコア、ラベルスコアを組み合わせた複合スコア
        const hybridScore = calculateHybridScore(resultWithScore._distance, keywordScore, labelScoreResult.score);
        console.log(`  Hybrid score: ${hybridScore} (vector: ${resultWithScore._distance}, keyword: ${keywordScore}, label: ${labelScoreResult.score})`);
        
        // スコア情報を追加
        resultWithScore._keywordScore = keywordScore;
        resultWithScore._labelScore = labelScoreResult.score;
        resultWithScore._hybridScore = hybridScore;
        resultWithScore._sourceType = keywordScore > 0 ? 'hybrid' : 'vector';
        resultWithScore._matchDetails = {
          titleMatches,
          labelMatches,
          contentMatches
        };
        
        // 配列に追加
        resultsWithHybridScore.push(resultWithScore);
      }
      
      // 除外件数のログ
      console.log(`[searchLanceDB] Excluded ${excludedCount} results by label filter`);

      // 追加ブースト: 先頭チャンク（chunkIndex=0）をわずかに優遇
      for (const r of resultsWithHybridScore) {
        if (typeof r.chunkIndex === 'number' && r.chunkIndex === 0) {
          r._hybridScore = (r._hybridScore ?? r._distance) - 0.05;
        }
      }
      // ハイブリッドスコアでソート
      vectorResults = resultsWithHybridScore.sort((a, b) => a._hybridScore - b._hybridScore);
      
      console.log(`[searchLanceDB] Found ${keywordMatchCount} keyword/hybrid matches in results`);
      console.log(`[searchLanceDB] Applied hybrid scoring to ${vectorResults.length} results`);
      console.log(`[searchLanceDB] Top 3 results after sorting:`);
      for (let i = 0; i < Math.min(3, vectorResults.length); i++) {
        console.log(`  ${i+1}. ${vectorResults[i].title} (score: ${vectorResults[i]._hybridScore.toFixed(4)})`);
      }
      
    } catch (err) {
      console.error(`[searchLanceDB] Error applying hybrid search: ${err}`);
      console.error(`[searchLanceDB] Error stack: ${err.stack}`);
      // エラー時は何もしない（元のベクトル検索結果をそのまま使用）
    }
    
    // 3. 結果の結合（キーワード検索は無効化されているため、ベクトル検索結果のみ使用）
    const combinedResults = [...vectorResults];
    
    // すでにハイブリッドスコアでソート済みなので、ここではソートしない
    // 上位の結果を取得
    const finalResults = combinedResults.slice(0, topK);
    console.log(`[searchLanceDB] Returning top ${finalResults.length} results based on hybrid score`);
    
    // 結果を整形
       // 結果を整形する前に各結果の内容をログ出力
       console.log(`[searchLanceDB] Final results before formatting:`);
       finalResults.forEach((result, idx) => {
         console.log(`[searchLanceDB] Result ${idx+1}: title=${result.title}, _sourceType=${result._sourceType}`);
       });
       
       return finalResults.map(result => {
         // 各フィールドの値をログ出力
         console.log(`[searchLanceDB] Mapping result: id=${result.id}, _sourceType=${result._sourceType}`);
         
         // 結果オブジェクトを作成
         const formattedResult = {
           id: result.id,
           pageId: result.pageId, // pageIdフィールドを追加
           title: result.title || 'No Title',
           content: result.content || '',
           distance: result._distance,
           space_key: result.space_key,
           labels: (Array.isArray(result.labels)
             ? result.labels
             : (result.labels && typeof (result.labels as any).toArray === 'function'
                 ? (result.labels as any).toArray()
                 : [])),
           url: result.url || '',
           lastUpdated: result.lastUpdated || '',
           source: result._sourceType || 'vector', // hybrid, keyword, vectorのいずれか
           matchDetails: result._matchDetails || {}
         };
         
         console.log(`[searchLanceDB] Formatted result: source=${formattedResult.source}`);
         return formattedResult;
       });
  } catch (error: any) {
    console.error(`[searchLanceDB] Error: ${error.message}`);
    throw new Error(`LanceDB search failed: ${error.message}`);
  }
}

/**
 * LanceDB検索クライアントを作成する
 */
export function createLanceDBSearchClient() {
  return {
    search: async (params: LanceDBSearchParams) => searchLanceDB(params)
  };
}

/**
 * デフォルトのLanceDB検索クライアント
 */
export const defaultLanceDBSearchClient = createLanceDBSearchClient();
