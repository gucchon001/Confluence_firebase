import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../../lib/embeddings';
import { initializeOnStartup } from '../../../lib/startup-initializer';

export async function POST(req: NextRequest) {
  try {
    // Lunr Indexの初期化を確実に実行
    try {
      await initializeOnStartup();
      console.log('✅ Lunr Index initialization completed in search API');
    } catch (error) {
      console.warn('⚠️ Lunr Index initialization failed in search API:', error);
      // 初期化に失敗しても検索は継続（フォールバック検索を使用）
    }

    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 5;
    const tableName: string = body?.tableName || 'confluence';
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    console.log(`Search query: "${query}", topK: ${topK}, tableName: ${tableName}`);

    // 1. クエリを埋め込みベクトルに変換
    const fullVector = await getEmbeddings(query);
    console.log(`Generated embedding vector (${fullVector.length} dimensions)`);
    
    // フルサイズのベクトルを使用（384次元）
    const vector = fullVector;
    console.log(`Using full vector with ${vector.length} dimensions`);

    // 2. LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`Connecting to LanceDB at ${dbPath}`);
    
    try {
      const db = await lancedb.connect(dbPath);
      
      // テーブル存在確認
      const tableNames = await db.tableNames();
      if (!tableNames.includes(tableName)) {
        console.error(`Table '${tableName}' not found`);
        return new Response(JSON.stringify({ error: `Vector database table '${tableName}' not found` }), { status: 500 });
      }

      // 3. テーブルを開いて検索
      const tbl = await db.openTable(tableName);
      console.log(`Opened table '${tableName}'`);

      // 4. 検索実行
      console.log('Executing search...');
      const results = await tbl.search(vector).limit(topK).toArray();
      console.log(`Found ${results.length} results`);
      
      // 5. 結果を整形
      const formattedResults = results.map(result => ({
        id: result.id,
        title: result.title || 'No Title',
        content: result.content || '',
        distance: result._distance,
        space_key: result.space_key || '',
        labels: result.labels || [],
        url: result.url || '#',
        lastUpdated: result.lastUpdated || null
      }));

      // 6. レスポンス返却
      return new Response(JSON.stringify({ results: formattedResults }), { 
        headers: { 'Content-Type': 'application/json' } 
      });
    } catch (lanceDbError: any) {
      console.error('LanceDB error:', lanceDbError);
      return new Response(JSON.stringify({ 
        error: `LanceDB error: ${lanceDbError.message}`,
        details: lanceDbError.stack
      }), { status: 500 });
    }
  } catch (e: any) {
    console.error('Search API error:', e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}