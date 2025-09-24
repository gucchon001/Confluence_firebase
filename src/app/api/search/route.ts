import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../../lib/embeddings';
import { initializeOnStartup } from '../../../lib/startup-initializer';
import { preprocessQuery, calculateQueryQuality } from '../../../lib/query-preprocessor';
import { hybridSearchEngine } from '../../../lib/hybrid-search-engine';
import { lunrInitializer } from '../../../lib/lunr-initializer';

/**
 * 距離値から類似度スコアを計算
 * @param distance 距離値
 * @returns 類似度スコア（0-100%）
 */
function calculateSimilarityScore(distance: number): number {
  // 距離値が1.0を超えている場合、ユークリッド距離と仮定
  if (distance > 1.0) {
    // ユークリッド距離の場合: 1 / (1 + distance) で正規化
    return (1 / (1 + distance)) * 100;
  } else {
    // コサイン距離の場合: 1 - distance で正規化
    return Math.max(0, (1 - distance)) * 100;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Lunr Indexの初期化を確実に実行
    let lunrReady = false;
    try {
      await lunrInitializer.initializeAsync();
      console.log('✅ Lunr Index initialization completed in search API');
      
      // Lunrクライアントの状態を確認
      const { lunrSearchClient } = await import('../../../lib/lunr-search-client');
      const status = lunrSearchClient.getStatus();
      console.log('Lunr client status after init:', status);
      lunrReady = status.isInitialized && status.hasIndex;
    } catch (error) {
      console.warn('⚠️ Lunr Index initialization failed in search API:', error);
      // 初期化に失敗しても検索は継続（フォールバック検索を使用）
    }

    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 5;
    const tableName: string = body?.tableName || 'confluence';
    const useHybridSearch: boolean = body?.useHybridSearch !== false; // デフォルトで有効
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });
    }

    console.log(`Search query: "${query}", topK: ${topK}, tableName: ${tableName}, hybrid: ${useHybridSearch}`);

    // ハイブリッド検索を使用する場合
    if (useHybridSearch) {
      try {
        const hybridResults = await hybridSearchEngine.search({
          query,
          topK,
          useLunrIndex: lunrReady, // Lunrの初期化状態に基づく
          labelFilters: {
            includeMeetingNotes: false,
            includeArchived: false
          },
          tableName
        });

        // 結果を整形
        const formattedResults = hybridResults.map(result => ({
          id: `${result.pageId}-0`, // 互換性のため
          title: result.title,
          content: result.content,
          distance: result.scoreRaw,
          space_key: '',
          labels: result.labels,
          url: result.url,
          lastUpdated: null,
          source: result.source,
          scoreKind: result.scoreKind,
          scoreText: result.scoreText
        }));

        return new Response(JSON.stringify({ results: formattedResults }), { 
          headers: { 'Content-Type': 'application/json' } 
        });
      } catch (hybridError: any) {
        console.error('Hybrid search failed, falling back to vector search:', hybridError);
        // フォールバック: ベクトル検索のみ
      }
    }

    // 従来のベクトル検索（フォールバックまたは明示的に無効化された場合）
    // 1. クエリ前処理
    const processedQuery = preprocessQuery(query);
    console.log(`Processed query: "${processedQuery.processedQuery}"`);
    console.log(`Keywords: [${processedQuery.keywords.join(', ')}]`);
    console.log(`Expanded terms: [${processedQuery.expandedTerms.join(', ')}]`);
    
    const queryQuality = calculateQueryQuality(processedQuery);
    console.log(`Query quality score: ${queryQuality.toFixed(3)}`);

    // 2. 処理されたクエリを埋め込みベクトルに変換
    const fullVector = await getEmbeddings(processedQuery.processedQuery);
    console.log(`Generated embedding vector (${fullVector.length} dimensions)`);
    
    // フルサイズのベクトルを使用（768次元）
    const vector = fullVector;
    console.log(`Using full vector with ${vector.length} dimensions`);

    // 3. LanceDBに接続
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

      // 4. テーブルを開いて検索
      const tbl = await db.openTable(tableName);
      console.log(`Opened table '${tableName}'`);

      // 5. 検索実行
      console.log('Executing vector search...');
      const results = await tbl.search(vector)
        .limit(topK)
        .toArray();
      console.log(`Found ${results.length} results`);
      
      // 6. 結果を整形
      const formattedResults = results.map(result => ({
        id: result.id,
        title: result.title || 'No Title',
        content: result.content || '',
        distance: result._distance,
        space_key: result.space_key || '',
        labels: result.labels || [],
        url: result.url || '#',
        lastUpdated: result.lastUpdated || null,
        source: 'vector',
        scoreKind: 'vector',
        scoreText: `Vector ${calculateSimilarityScore(result._distance).toFixed(1)}%`
      }));

      // 7. レスポンス返却
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