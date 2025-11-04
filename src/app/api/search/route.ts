import { NextRequest, NextResponse } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../../lib/embeddings';
import { preprocessQuery, calculateQueryQuality } from '../../../lib/query-preprocessor';
import { hybridSearchEngine } from '../../../lib/hybrid-search-engine';
import { lunrInitializer } from '../../../lib/lunr-initializer';
import { calculateSimilarityScore } from '../../../lib/score-utils';
import { APIErrorHandler, withAPIErrorHandling } from '../../../lib/api-error-handler';
import { screenTestLogger } from '@/lib/screen-test-logger';

export const POST = withAPIErrorHandling(async (req: NextRequest) => {
  // 統一初期化サービスを使用
  const lunrReady = await APIErrorHandler.handleUnifiedInitialization();
  
  // Lunrクライアントの状態を確認
  if (lunrReady) {
    try {
      const { lunrSearchClient } = await import('../../../lib/lunr-search-client');
      const status = lunrSearchClient.getStatus();
      console.log('Lunr client status after init:', status);
    } catch (error) {
      console.warn('⚠️ Lunr client status check failed:', error);
    }
  }

    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 10; // 参照元を10件に統一
    const tableName: string = body?.tableName || 'confluence';
    const useHybridSearch: boolean = body?.useHybridSearch !== false; // デフォルトで有効
    
    if (!query) {
      return APIErrorHandler.validationError('query is required');
    }

    console.log(`Search query: "${query}", topK: ${topK}, tableName: ${tableName}, hybrid: ${useHybridSearch}`);
    screenTestLogger.info('search', `Search request received: "${query}"`, { topK, tableName, useHybridSearch });

    // ハイブリッド検索を使用する場合
    if (useHybridSearch) {
      try {
        const searchStartTime = performance.now();
        
        const hybridResults = await hybridSearchEngine.search({
          query,
          topK,
          useLunrIndex: lunrReady, // Lunrの初期化状態に基づく
          labelFilters: {
            excludeMeetingNotes: true,
            excludeArchived: true
          },
          tableName
        });

        const searchEndTime = performance.now();
        const searchTime = searchEndTime - searchStartTime;

        // URLを再構築するヘルパー関数
        const buildUrl = (pageId: number | undefined, spaceKey: string | undefined, existingUrl: string | undefined): string => {
          const baseUrl = process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
          if (existingUrl && existingUrl !== '#' && existingUrl.startsWith('http')) {
            return existingUrl;
          }
          if (pageId && spaceKey) {
            return `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageId}`;
          }
          return existingUrl || '#';
        };
        
        // 結果を整形（10件に制限）
        const formattedResults = hybridResults
          .slice(0, 10) // 参照元を10件に統一
          .map(result => ({
            id: `${result.pageId}-0`, // 互換性のため
            title: result.title,
            content: result.content,
            distance: result.scoreRaw,
            space_key: result.space_key || '',
            labels: result.labels,
            url: buildUrl(result.pageId, result.space_key, result.url), // URLを再構築
            lastUpdated: null,
            source: result.source,
            scoreKind: result.scoreKind,
            scoreText: result.scoreText
          }));

        // パフォーマンスログを記録
        screenTestLogger.logSearchPerformance(query, searchTime, formattedResults.length, {
          source: 'hybrid',
          useLunrIndex: lunrReady,
          results: formattedResults.slice(0, 3).map(r => ({ title: r.title, source: r.source }))
        });

        return NextResponse.json({ results: formattedResults });
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
        return APIErrorHandler.internalServerError(`Vector database table '${tableName}' not found`);
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
      
      // URLを再構築するヘルパー関数
      const buildUrl = (pageId: number | undefined, spaceKey: string | undefined, existingUrl: string | undefined): string => {
        const baseUrl = process.env.CONFLUENCE_BASE_URL || 'https://giginc.atlassian.net';
        if (existingUrl && existingUrl !== '#' && existingUrl.startsWith('http')) {
          return existingUrl;
        }
        if (pageId && spaceKey) {
          return `${baseUrl}/wiki/spaces/${spaceKey}/pages/${pageId}`;
        }
        return existingUrl || '#';
      };
      
      // 6. 結果を整形（10件に制限）
      const formattedResults = results
        .slice(0, 10) // 参照元を10件に統一
        .map(result => {
          const pageId = result.page_id || result.pageId;
          const spaceKey = result.space_key || result.spaceKey;
          return {
            id: result.id,
            title: result.title || 'No Title',
            content: result.content || '',
            distance: result._distance,
            space_key: spaceKey || '',
            labels: result.labels || [],
            url: buildUrl(pageId, spaceKey, result.url), // URLを再構築
            lastUpdated: result.lastUpdated || null,
            source: 'vector',
            scoreKind: 'vector',
            scoreText: `Vector ${calculateSimilarityScore(result._distance).toFixed(1)}%`
          };
        });

      // 7. レスポンス返却
      return NextResponse.json({ results: formattedResults });
    } catch (lanceDbError: any) {
      console.error('LanceDB error:', lanceDbError);
      return APIErrorHandler.internalServerError(
        `LanceDB error: ${lanceDbError.message}`,
        lanceDbError.stack
      );
    }
});