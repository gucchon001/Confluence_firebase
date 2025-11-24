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
  // メモリ使用量の監視: リクエスト受信時
  const { logMemoryUsage } = await import('../../../lib/memory-monitor');
  logMemoryUsage('Search API request received');
  
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
    const source: string = body?.source || (body?.tableName === 'jira_issues' ? 'jira' : 'confluence'); // sourceパラメータを追加
    const tableName: string = body?.tableName || (source === 'jira' ? 'jira_issues' : 'confluence');
    const useHybridSearch: boolean = body?.useHybridSearch !== false; // デフォルトで有効
    
    if (!query) {
      return APIErrorHandler.validationError('query is required');
    }

    const effectiveSource = source; // sourceを確定
    console.log(`Search query: "${query}", topK: ${topK}, source: ${effectiveSource}, tableName: ${tableName}, hybrid: ${useHybridSearch}`);
    screenTestLogger.info('search', `Search request received: "${query}"`, { topK, source: effectiveSource, tableName, useHybridSearch });

    // ハイブリッド検索を使用する場合
    if (useHybridSearch) {
      try {
        const searchStartTime = performance.now();
        
        // Jiraの場合はLunrインデックスの初期化状態を確認
        let jiraLunrReady = false;
        if (effectiveSource === 'jira') {
          const { lunrInitializer } = await import('../../../lib/lunr-initializer');
          jiraLunrReady = lunrInitializer.isReady('jira_issues');
        }
        
        const hybridResults = await hybridSearchEngine.search({
          query,
          topK,
          useLunrIndex: effectiveSource === 'jira' ? jiraLunrReady : lunrReady, // Jiraの場合はJira用Lunrインデックスの状態を使用
          labelFilters: {
            excludeMeetingNotes: true,
            excludeArchived: true
          },
          tableName
        });

        const searchEndTime = performance.now();
        const searchTime = searchEndTime - searchStartTime;

        // URLを再構築（共通ユーティリティを使用）
        const { buildConfluenceUrl } = await import('@/lib/url-utils');
        const { buildJiraUrl } = await import('@/lib/jira-url-utils');
        
        // 結果を整形（10件に制限）
        const formattedResults = hybridResults
          .slice(0, 10) // 参照元を10件に統一
          .map(result => {
            // Jiraの場合はissue_keyを使用
            const id = effectiveSource === 'jira' 
              ? (result.id || result.pageId?.toString() || '')
              : `${result.pageId}-0`;
            
            // JiraとConfluenceでURL構築を分離
            const issueKey = (result as any).issue_key || result.id;
            let url: string;
            if (effectiveSource === 'jira') {
              url = buildJiraUrl(issueKey, result.url);
            } else {
              url = buildConfluenceUrl(result.pageId, result.space_key, result.url);
            }
            
            const baseResult: any = {
              id,
              title: result.title,
              content: result.content,
              distance: result.scoreRaw,
              space_key: result.space_key || '',
              labels: result.labels,
              url: url, // URLを再構築
              lastUpdated: null,
              source: effectiveSource,
              scoreKind: result.scoreKind,
              scoreText: result.scoreText
            };
            
            // Jira特有のフィールドを追加（hybridResultsから取得可能な場合）
            if (effectiveSource === 'jira' && result.id) {
              baseResult.issueKey = result.id;
            }
            
            return baseResult;
          });

        // Firestoreから追加情報を取得して補完（Jira検索の場合のみ）
        let enrichedResults = formattedResults;
        if (effectiveSource === 'jira') {
          try {
            const { JiraFirestoreEnrichmentService } = await import('@/lib/jira-firestore-enrichment-service');
            const enrichmentService = JiraFirestoreEnrichmentService.getInstance();
            enrichedResults = await enrichmentService.enrichSearchResults(
              formattedResults.map(r => ({
                id: r.id,
                issue_key: r.issueKey || r.id,
                title: r.title,
                content: r.content,
                status: (r as any).status || '',
                status_category: (r as any).statusCategory || '',
                priority: (r as any).priority || '',
                assignee: (r as any).assignee || '',
                issue_type: (r as any).issueType || ''
              })),
              10 // 最大10件まで補完
            ) as any[];

            // 補完されたデータをレスポンスに反映
            enrichedResults = enrichedResults.map((enriched, index) => {
              const original = formattedResults[index];
              return {
                ...original,
                // カスタムフィールドを追加
                ...(enriched.customFields && { customFields: enriched.customFields }),
                // コメント履歴を追加
                ...(enriched.comments && { comments: enriched.comments })
              };
            });
          } catch (error) {
            // エラーが発生した場合、LanceDBのデータのみを返す（フォールバック）
            console.warn('[Search API] Failed to enrich results from Firestore:', error);
          }
        }

        // パフォーマンスログを記録
        screenTestLogger.logSearchPerformance(query, searchTime, enrichedResults.length, {
          source: 'hybrid',
          useLunrIndex: lunrReady,
          results: enrichedResults.slice(0, 3).map(r => ({ title: r.title, source: r.source }))
        });

        return NextResponse.json({ results: enrichedResults });
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
      
      // URLを再構築（共通ユーティリティを使用）
      const { buildConfluenceUrl } = await import('@/lib/url-utils');
      const { buildJiraUrl } = await import('@/lib/jira-url-utils');
      
      // 6. 結果を整形（10件に制限）
      const formattedResults = results
        .slice(0, 10) // 参照元を10件に統一
        .map(result => {
          const pageId = result.page_id || result.pageId;
          const spaceKey = result.space_key || result.spaceKey;
          const issueKey = result.issue_key || result.id; // Jiraの場合はissue_keyを使用
          
          // JiraとConfluenceでURL構築を分離
          let url: string;
          if (effectiveSource === 'jira') {
            url = buildJiraUrl(issueKey, result.url);
          } else {
            url = buildConfluenceUrl(pageId, spaceKey, result.url);
          }
          
          const baseResult: any = {
            id: effectiveSource === 'jira' ? (issueKey || result.id) : result.id,
            title: result.title || 'No Title',
            content: result.content || '',
            distance: result._distance,
            space_key: spaceKey || '',
            labels: result.labels || [],
            url: url, // URLを再構築
            lastUpdated: result.lastUpdated || result.updated_at || null,
            source: effectiveSource,
            scoreKind: 'vector',
            scoreText: `Vector ${calculateSimilarityScore(result._distance).toFixed(1)}%`
          };
          
          // Jira特有のフィールドを追加
          if (effectiveSource === 'jira') {
            baseResult.issueKey = issueKey;
            baseResult.status = result.status || '';
            baseResult.statusCategory = result.status_category || '';
            baseResult.priority = result.priority || '';
            baseResult.assignee = result.assignee || '';
            baseResult.issueType = result.issue_type || '';
          }
          
          return baseResult;
        });

      // 7. Firestoreから追加情報を取得して補完（Jira検索の場合のみ）
      let enrichedResults = formattedResults;
      if (effectiveSource === 'jira') {
        try {
          const { JiraFirestoreEnrichmentService } = await import('@/lib/jira-firestore-enrichment-service');
          const enrichmentService = JiraFirestoreEnrichmentService.getInstance();
          enrichedResults = await enrichmentService.enrichSearchResults(
            formattedResults.map(r => ({
              id: r.id,
              issue_key: r.issueKey || r.id,
              title: r.title,
              content: r.content,
              status: r.status,
              status_category: r.statusCategory,
              priority: r.priority,
              assignee: r.assignee,
              issue_type: r.issueType
            })),
            10 // 最大10件まで補完
          ) as any[];

          // 補完されたデータをレスポンスに反映
          enrichedResults = enrichedResults.map((enriched, index) => {
            const original = formattedResults[index];
            return {
              ...original,
              // カスタムフィールドを追加
              ...(enriched.customFields && { customFields: enriched.customFields }),
              // コメント履歴を追加
              ...(enriched.comments && { comments: enriched.comments })
            };
          });
        } catch (error) {
          // エラーが発生した場合、LanceDBのデータのみを返す（フォールバック）
          console.warn('[Search API] Failed to enrich results from Firestore:', error);
        }
      }

      // 8. レスポンス返却
      return NextResponse.json({ results: enrichedResults });
    } catch (lanceDbError: any) {
      console.error('LanceDB error:', lanceDbError);
      return APIErrorHandler.internalServerError(
        `LanceDB error: ${lanceDbError.message}`,
        lanceDbError.stack
      );
    }
});