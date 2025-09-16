/**
 * LanceDB検索クライアント
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from './embeddings';

/**
 * LanceDB検索パラメータ
 */
export interface LanceDBSearchParams {
  query: string;
  topK?: number;
  tableName?: string;
  filter?: string;
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
    
    // 検索クエリの構築
    let query = tbl.search(vector);
    
    // フィルターがある場合は適用
    if (params.filter) {
      query = query.where(params.filter);
    }
    
    // 検索実行
    console.log(`[searchLanceDB] Executing search with topK=${topK}`);
    const results = await query.limit(topK).toArray();
    console.log(`[searchLanceDB] Found ${results.length} results`);
    
    // 結果を整形
    return results.map(result => ({
      id: result.id,
      title: result.title || 'No Title',
      content: result.content || '',
      distance: result._distance,
      space_key: result.space_key,
      labels: result.labels || [],
      url: result.url || '',
      lastUpdated: result.lastUpdated || ''
    }));
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
