/**
 * 関連ドキュメント検索（LanceDB版）
 */
// Force re-build
import * as z from 'zod';
import { searchLanceDB } from '@/lib/lancedb-search-client';
import * as admin from 'firebase-admin';
import { getStructuredLabels } from '@/lib/structured-label-service-admin';
import { optimizedLanceDBClient } from '@/lib/optimized-lancedb-client';
import { getLanceDBCache } from '@/lib/lancedb-cache';

/**
 * 検索クエリを拡張して、より具体的なキーワードを含める（メモ）
 * LLM拡張に基づいた動的なクエリ拡張
 */
function expandSearchQuery(query: string): string {
  // 自動的な否定キーワード追加を無効化（検索精度を向上させるため）
  return query.trim();
}

/**
 * メール通知系ドキュメントをフィルタリングする
 */
function filterEmailNotifications(results: any[], query: string): any[] {
  const queryLower = query.toLowerCase();
  // クエリ中の負のトークン（-メール など）は検索意図では除外を意味するため、
  // メール系を残す理由には使わない（=無視）
  const tokens = queryLower.split(/\s+/).filter(Boolean);
  const positiveTokens = tokens.filter(t => !t.startsWith('-'));
  
  // メール通知系のキーワードが正のトークンに含まれている場合のみ、除外しない
  const emailKeywords = ['メール', 'mail', '通知', 'notification', '送信', 'send'];
  const hasEmailKeywordsPositive = emailKeywords.some(keyword => 
    positiveTokens.some(t => t.includes(keyword))
  );
  
  if (hasEmailKeywordsPositive) {
    return results; // メール関連の質問（正の意図）の場合は除外しない
  }
  
  // メール通知系ドキュメントのパターン
  const emailPatterns = [
    /メール.*通知/,
    /通知.*メール/,
    /mail.*notification/i,
    /notification.*mail/i,
    /送信.*メール/,
    /メール.*送信/,
    /email.*template/i,
    /template.*email/i,
    /メール.*テンプレート/,
    /テンプレート.*メール/
  ];
  
  // フィルタリング実行
  const filteredResults = results.filter(result => {
    const title = result.title || '';
    const content = result.content || '';
    
  // NOTE: ログイン固有の例外は撤去（辞書・個別例外に依存しない）
    
    // タイトルまたはコンテンツにメール通知系のパターンが含まれているかチェック
    const isEmailNotification = emailPatterns.some(pattern => 
      pattern.test(title) || pattern.test(content)
    );
    
    return !isEmailNotification;
  });
  
  return filteredResults;
}

// Firebase Admin SDKの初期化（サーバーサイドでのみ実行）
if (typeof window === 'undefined' && !admin.apps.length) {
  try {
    // Next.jsのサーバーサイドレンダリング環境ではrequireが動作しないため、
    // applicationDefaultCredential()を使用する
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
    });
    
    console.log('[Firebase Admin] Successfully initialized with application default credentials');
  } catch (error) {
    console.error('[Firebase Admin] Initialization error:', error);
  }
}

/**
 * LanceDBを使用したConfluenceドキュメント検索ツール
 */
async function lancedbRetrieverTool(
  query: string,
  filters?: {
    spaceKey?: string;
    labels?: string[];
    labelFilters?: {
      includeMeetingNotes: boolean;
    };
  }
): Promise<any[]> {
  const searchStartTime = Date.now();
  try {
    // 開発環境のみログ
    if (process.env.NODE_ENV === 'development') {
      console.log(`[lancedbRetrieverTool] 🔍 Search started for query: "${query}"`);
    }

    // モックデータの使用を無効化（本番データを使用）
    if (false) {
      // この部分は実行されません
      return [];
    }

    // フィルターの構築
    let filterQuery = '';
    if (filters?.spaceKey) {
      filterQuery = `space_key = '${filters.spaceKey}'`;
    }
    // DBレイヤのラベルWHEREは不使用（アプリ層でフィルタ）

    // デバッグ: フィルタ内容を可視化（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('[lancedbRetrieverTool] Filter params:', {
        spaceKey: filters?.spaceKey,
        labels: filters?.labels,
        labelFilters: filters?.labelFilters,
      });
      console.log('[lancedbRetrieverTool] Generated filterQuery:', filterQuery || '(none)');
    }

    // 検索クエリを最適化（オファー関連の検索精度を向上）
    let optimizedQuery = query;
    if (query.includes('オファー機能')) {
      // 「オファー機能の種類は」→「オファー」に最適化
      optimizedQuery = 'オファー';
    }
    
    const expandedQuery = expandSearchQuery(optimizedQuery);
    // クエリ最適化ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[lancedbRetrieverTool] Original query: "${query}"`);
      console.log(`[lancedbRetrieverTool] Optimized query: "${optimizedQuery}"`);
      console.log(`[lancedbRetrieverTool] Expanded query: "${expandedQuery}"`);
      console.log(`[lancedbRetrieverTool] Query optimization applied: ${optimizedQuery !== query ? 'YES' : 'NO'}`);
    }

    // 厳格一致候補（タイトル用）を抽出
    const strictTitleCandidates: string[] = [];
    const normalized = (s: string) => s.normalize('NFKC').trim();
    const base = normalized(query);
    // 単純ルール: 「ログイン機能」が含まれていれば厳格候補に追加
    if (base.includes('ログイン機能')) strictTitleCandidates.push('ログイン機能');
    if (base.includes('会員ログイン')) strictTitleCandidates.push('会員ログイン');
    if (base.toLowerCase().includes('login')) strictTitleCandidates.push('login');

    // Phase 0A-4: 詳細な検索パフォーマンス計測
    const searchLanceDBStartTime = Date.now();
    const unifiedResults = await searchLanceDB({
      query: optimizedQuery, // 最適化されたクエリを使用
      topK: 8,
      useLunrIndex: true, // Phase 6修正: BM25検索を有効化（品質向上）
      titleWeight: 3.0, // Phase 0A-3 FIX: タイトルマッチングを有効化
      labelFilters: filters?.labelFilters || {
        includeMeetingNotes: false
      },
    });
    const searchLanceDBDuration = Date.now() - searchLanceDBStartTime;
    
    // Phase 0A-4 ROLLBACK: ログ出力を開発環境のみに制限（前のバージョンと同じ）
    if (process.env.NODE_ENV === 'development' && searchLanceDBDuration > 10000) {
      console.warn(`⚠️ [lancedbRetrieverTool] SLOW searchLanceDB: ${searchLanceDBDuration}ms for query: "${optimizedQuery}"`);
    }
    
    // 検索結果ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('[lancedbRetrieverTool] Raw search results count:', unifiedResults.length);
      console.log('[lancedbRetrieverTool] Raw search results titles:', unifiedResults.map(r => r.title));
    }
    
    // 検索処理時間の計測（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      const searchDuration = Date.now() - searchStartTime;
      if (searchDuration > 10000) {
        console.warn(`⚠️ [lancedbRetrieverTool] SLOW TOTAL search: ${searchDuration}ms for query: "${query}"`);
      }
    }

    // UIが期待する形へ最小変換（scoreText, source を保持）
    const mapped = unifiedResults.slice(0, 12).map(r => ({
      id: String(r.pageId ?? r.id ?? ''),
      pageId: String(r.pageId ?? r.id ?? ''), // Phase 0A-1.5: チャンク統合用
      content: r.content || '',
      url: r.url || '',
      lastUpdated: (r as any).lastUpdated || null,
      spaceName: (r as any).space_key || 'Unknown',
      title: r.title || 'No Title',
      labels: r.labels || [],
      distance: (r as any).distance,
      source: r.source as any,
      scoreText: r.scoreText,
    }));

    // Phase 0A-1.5: 全チャンク統合（サーバー側で実装）
    const enriched = await enrichWithAllChunks(mapped);
    
    // Phase 0A-1.5: 空ページフィルター（サーバー側で実装）
    const filterStartTime = Date.now();
    const filtered = await filterInvalidPagesServer(enriched);
    const filterDuration = Date.now() - filterStartTime;
    
    // 2秒以上かかった場合のみログ（パフォーマンス問題の検知）
    if (filterDuration > 2000) {
      console.warn(`⚠️ [lancedbRetrieverTool] Slow filterInvalidPagesServer: ${filterDuration}ms (${(filterDuration / 1000).toFixed(2)}s) for ${enriched.length} results`);
    }

    return filtered;
  } catch (error: any) {
    console.error(`[lancedbRetrieverTool] Error retrieving documents: ${error.message}`);
    throw new Error(`Failed to retrieve documents: ${error.message}`);
  }
}

// 入力/出力スキーマ（必要に応じてAPI側で検証に使用）
export const RetrieveDocsInputSchema = z.object({
  question: z.string(),
  labels: z.array(z.string()).optional(),
  labelFilters: z
    .object({
      includeMeetingNotes: z.boolean(),
    })
    .optional(),
});

export const DocumentOutputSchema = z.object({
  id: z.string(),
  content: z.string(),
  url: z.string(),
  lastUpdated: z.string().nullable(),
  spaceName: z.string(),
  title: z.string(),
  labels: z.array(z.string()),
  distance: z.number().optional(),
  source: z.enum(['vector','keyword','bm25','hybrid']).optional(),
  scoreText: z.string().optional(),
});

export const RetrieveDocsOutputSchema = z.array(DocumentOutputSchema);

// プレーン関数としてエクスポート
export async function retrieveRelevantDocs({
  question,
  labels,
  labelFilters,
}: {
  question: string;
  labels?: string[];
  labelFilters?: {
    includeMeetingNotes: boolean;
  };
}): Promise<any[]> {
  try {
    // 検索処理ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(`[retrieveRelevantDocs] Searching for question: ${question}`);
    }
    const results = await lancedbRetrieverTool(question, { labels, labelFilters });
    if (process.env.NODE_ENV === 'development') {
      console.log(`[retrieveRelevantDocs] Found ${results.length} relevant documents`);
    }
    return results;
  } catch (error: any) {
    console.error(`[retrieveRelevantDocs] Error: ${error.message}`);
    throw new Error(`Failed to retrieve relevant documents: ${error.message}`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 0A-1.5: 検索品質改善関数（サーバー側）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * 全チャンク統合（Phase 0A-1.5 + Phase 0A-3最適化）
 * 各ページの全チャンクを取得して、コンテンツを統合
 * Phase 0A-3: isChunkedフラグによる条件分岐で66.3%のページでスキップ
 */
export async function enrichWithAllChunks(results: any[]): Promise<any[]> {
  if (results.length === 0) {
    return results;
  }

  // ★★★ PERF LOG: ドキュメント取得全体の時間計測 ★★★
  const enrichStartTime = Date.now();
  console.log(`[PERF] 📚 enrichWithAllChunks started for ${results.length} results`);

  // Phase 0A-4 ROLLBACK: ログ削除（前のバージョンと同じ）
  let skippedCount = 0;
  let mergedCount = 0;

  const enriched = await Promise.all(
    results.map(async (result, index) => {
      try {
        const pageStartTime = Date.now();
        const pageId = result.pageId || result.id;
        if (!pageId) {
          console.warn(`[ChunkMerger] Skipping result without pageId`);
          return result;
        }

        // Phase 0A-3最適化: isChunkedフラグによる条件分岐
        if (result.isChunked === false) {
          // チャンク分割されていないページ → 統合不要（66.3%）
          skippedCount++;
          return result;
        }

        // ★★★ PERF LOG: 個別ページのチャンク取得時間 ★★★
        const chunkFetchStart = Date.now();
        const allChunks = await getAllChunksByPageId(String(pageId));
        const chunkFetchDuration = Date.now() - chunkFetchStart;
        
        if (chunkFetchDuration > 1000) {
          console.warn(`[PERF] ⚠️ Slow chunk fetch for pageId ${pageId}: ${chunkFetchDuration}ms (${allChunks.length} chunks)`);
        }

        if (allChunks.length <= 1) {
          // チャンクが1つ以下の場合は統合不要
          return result;
        }

        // Phase 5緊急修正: 大量チャンクの効率的処理（品質維持）
        let mergedContent: string;
        
        if (allChunks.length > 10) {
          // 大量チャンクの場合: 並列処理で高速化
          if (process.env.NODE_ENV === 'development') {
            console.log(`[ChunkMerger] Large chunk set detected: ${allChunks.length} chunks, using parallel processing`);
          }
          
          const contentPromises = allChunks.map(async (chunk) => {
            return chunk.content || '';
          });
          
          const contents = await Promise.all(contentPromises);
          mergedContent = contents.filter(Boolean).join('\n\n');
        } else {
          // 少量チャンクの場合: 従来の処理
          mergedContent = allChunks
            .map((chunk) => chunk.content || '')
            .filter(Boolean)
            .join('\n\n');
        }

        mergedCount++;
        if (allChunks.length > 1) { // 複数チャンクの場合のみログ出力
          console.log(
            `[ChunkMerger] Merged ${allChunks.length} chunks for "${result.title}" (${result.content?.length || 0} → ${mergedContent.length} chars)`
          );
        }

        return {
          ...result,
          content: mergedContent,
          chunkCount: allChunks.length,
          originalContentLength: result.content?.length || 0,
        };
      } catch (error: any) {
        console.error(`[ChunkMerger] Error enriching result "${result.title}":`, error.message);
        return result; // エラー時は元の結果を返す
      }
    })
  );

  // ★★★ PERF LOG: ドキュメント取得全体の完了時間 ★★★
  const enrichDuration = Date.now() - enrichStartTime;
  console.log(`[PERF] ✅ enrichWithAllChunks completed in ${enrichDuration}ms (${(enrichDuration / 1000).toFixed(2)}s)`);
  console.log(`[PERF]    - Total results: ${results.length}`);
  console.log(`[PERF]    - Skipped (not chunked): ${skippedCount}`);
  console.log(`[PERF]    - Merged: ${mergedCount}`);
  
  if (enrichDuration > 10000) {
    console.warn(`[PERF] ⚠️ Slow enrichment detected: ${enrichDuration}ms`);
  }

  // Phase 0A-4 ROLLBACK: サマリーログを開発環境のみに
  if (process.env.NODE_ENV === 'development' && mergedCount > 0) {
    const totalChunks = enriched.reduce((sum, r) => sum + (r.chunkCount || 1), 0);
    console.log(`[ChunkMerger] ⚡ Enrichment complete. Skipped: ${skippedCount}, Merged: ${mergedCount}, Total chunks: ${totalChunks}`);
  }

  return enriched;
}

/**
 * pageIdで全チャンクを取得（Phase 0A-4 緊急パフォーマンス修正）
 * 
 * **Phase 0A-4 FIX**: 10,000行スキャンを避けて、効率的な検索を実装
 * - まず完全一致で検索を試行
 * - 見つからない場合は前方一致で検索（制限付き）
 */
async function getAllChunksByPageId(pageId: string): Promise<any[]> {
  // Phase 0A-4 Cache: メモリキャッシュ優先
  const cache = getLanceDBCache();
  const cached = cache.getChunks(pageId);
  
  if (cached) {
    // キャッシュヒット: 即座に返す（DBアクセスなし）
    return cached;
  }
  
  // キャッシュミス: DBから取得してキャッシュに保存
  const chunks = await getAllChunksByPageIdInternal(pageId);
  cache.setChunks(pageId, chunks);
  
  return chunks;
}

async function getAllChunksByPageIdInternal(pageId: string): Promise<any[]> {
  try {
    const scanStartTime = Date.now();
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;

    // ★★★ CRITICAL PERF FIX: 単純なpageId完全一致のみを使用 ★★★
    // LIKEやORを含むクエリはインデックスを効率よく使えず、フルスキャンになる可能性がある
    // 完全一致の単純クエリが最も高速
    // ★★★ MULTI-ENV FIX: ローカル(String型)と本番(Float64型)の両対応 ★★★
    let results: any[] = [];
    let queryType = '';
    
    // 方法1: 文字列比較（ローカル環境、String型の場合）
    try {
      const stringResults = await table
        .query()
        .where(`\`pageId\` = '${pageId}'`)
        .limit(1000)
        .toArray();
      
      if (stringResults.length > 0) {
        results = stringResults;
        queryType = 'string';
        const scanDuration = Date.now() - scanStartTime;
        console.log(`[getAllChunksByPageIdInternal] Query completed (string) in ${scanDuration}ms, found ${results.length} results for pageId: ${pageId}`);
      }
    } catch (stringError) {
      // 文字列比較が失敗した場合、数値として比較を試行（本番環境、Float64型）
      console.log(`[getAllChunksByPageIdInternal] String comparison failed, trying numeric comparison`);
    }
    
    // 方法2: 数値比較（本番環境、Float64型の場合）- 方法1が失敗または0件の場合のみ
    if (results.length === 0) {
      try {
        const numericResults = await table
          .query()
          .where(`\`pageId\` = ${pageId}`)  // クォートなしで数値型として扱う
          .limit(1000)
          .toArray();
        
        if (numericResults.length > 0) {
          results = numericResults;
          queryType = 'numeric';
          const scanDuration = Date.now() - scanStartTime;
          console.log(`[getAllChunksByPageIdInternal] Query completed (numeric) in ${scanDuration}ms, found ${results.length} results for pageId: ${pageId}`);
        }
      } catch (numericError) {
        console.error(`[getAllChunksByPageIdInternal] Both string and numeric comparisons failed`);
        throw numericError;
      }
    }
    
    if (results.length === 0 && queryType === '') {
      // どちらの方法も試行されたが結果が0件
      console.log(`[getAllChunksByPageIdInternal] No chunks found for pageId: ${pageId}`);
    }
    
    if (results.length > 0) {
      // chunkIndexでソート
      results.sort((a: any, b: any) => {
        const aIndex = a.chunkIndex || 0;
        const bIndex = b.chunkIndex || 0;
        return aIndex - bIndex;
      });
      
      if (scanDuration > 100) { // 100ms以上の場合のみログ出力
        console.log(`[getAllChunksByPageId] ⚡ Phase 5最適化: ${results.length} chunks in ${scanDuration}ms for pageId: ${pageId}`);
      } else if (process.env.NODE_ENV === 'development') {
        console.log(`[getAllChunksByPageId] ⚡ Phase 5最適化: ${results.length} chunks in ${scanDuration}ms for pageId: ${pageId}`);
      }
      
      return results;
    }
    
    // 見つからない場合は空配列を返す
    if (scanDuration > 100) {
      console.log(`[getAllChunksByPageId] ⚠️ No chunks found in ${scanDuration}ms for pageId: ${pageId}`);
    }
    
    return [];
    
  } catch (error: any) {
    console.error(`[getAllChunksByPageId] ❌ Error fetching chunks for pageId ${pageId}:`, error.message);
    console.error('   Stack:', error.stack);
    return [];
  }
}

/**
 * 空ページフィルター（Phase 0A-1.5、サーバー側）
 * is_valid: false のページや、コンテンツが極端に短いページを除外
 */
export async function filterInvalidPagesServer(results: any[]): Promise<any[]> {
  if (results.length === 0) {
    return results;
  }

  // StructuredLabelを一括取得（Admin SDK使用）
  const pageIds = results.map((r) => String(r.pageId || r.id || 'unknown'));
  const labels = await getStructuredLabels(pageIds);

  const validResults = [];

  for (const result of results) {
    const pageId = String(result.pageId || result.id || 'unknown');
    const label = labels.get(pageId);

    // StructuredLabelがある場合: is_validで判定
    if (label) {
      if (label.is_valid === false) {
        // 無効ページ除外ログ（開発環境のみ）
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[EmptyPageFilter] Excluded: ${result.title} (is_valid: false, content_length: ${label.content_length || 0}chars)`
          );
        }
        continue;
      }
    } else {
      // StructuredLabelがない場合: コンテンツ長で直接判定
      const contentLength = result.content?.length || 0;
      if (contentLength < 100) {
        // 短いコンテンツ除外ログ（開発環境のみ）
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[EmptyPageFilter] Excluded: ${result.title} (no label, content too short: ${contentLength}chars)`
          );
        }
        continue;
      }
    }

    validResults.push(result);
  }

  if (validResults.length < results.length) {
    // フィルタ結果ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[EmptyPageFilter] Filtered: ${results.length} → ${validResults.length} results (removed ${results.length - validResults.length} invalid pages)`
      );
    }
  }

  return validResults;
}
