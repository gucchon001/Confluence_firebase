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
import * as fs from 'fs';
import * as path from 'path';

/**
 * ログファイルへの書き込みヘルパー関数
 */
function writeLogToFile(level: 'info' | 'warn' | 'error', category: string, message: string, data?: any): void {
  try {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const logFile = path.join(logsDir, `retrieve-docs-${timestamp}.jsonl`);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    fs.appendFileSync(logFile, logLine, 'utf8');
  } catch (error) {
    // ログファイルへの書き込みに失敗しても処理は継続
    console.error('[writeLogToFile] Failed to write log:', error);
  }
}

/**
 * BOM文字（U+FEFF）を確実に削除するヘルパー関数
 * 本番環境でLanceDBから取得したデータにBOMが含まれている場合に備える
 */
function removeBOM(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  // 複数の方法でBOMを除去して確実性を高める
  let cleanText = text;
  // 1. 文字列全体からBOMを削除
  cleanText = cleanText.replace(/\uFEFF/g, '');
  // 2. 文字列の先頭からBOMを削除（念のため）
  if (cleanText.length > 0 && cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }
  // 3. trim()の前に再度BOMを削除
  cleanText = cleanText.replace(/^\uFEFF+|\uFEFF+$/g, '').trim();
  return cleanText;
}

/**
 * 検索クエリを拡張して、より具体的なキーワードを含める（メモ）
 * LLM拡張に基づいた動的なクエリ拡張
 */
function expandSearchQuery(query: string): string {
  // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
  query = removeBOM(query);
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
    // ログファイルに検索開始を記録
    writeLogToFile('info', 'search_start', 'Search started', {
      query,
      filters,
      timestamp: new Date().toISOString(),
    });
    
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
      writeLogToFile('info', 'filter_params', 'Filter parameters', {
        spaceKey: filters?.spaceKey,
        labels: filters?.labels,
        labelFilters: filters?.labelFilters,
        filterQuery: filterQuery || '(none)'
      });
    }

    // BOM文字（U+FEFF）を確実に削除（埋め込み生成エラーを防ぐため）
    query = removeBOM(query);

    // Phase 0A-4: 詳細な検索パフォーマンス計測
    const searchLanceDBStartTime = Date.now();
    const unifiedResults = await searchLanceDB({
      query: query, // 元のクエリを使用
      topK: 10, // 参照元を10件に統一
      useLunrIndex: true, // Phase 6修正: BM25検索を有効化（品質向上）
      titleWeight: 3.0, // Phase 0A-3 FIX: タイトルマッチングを有効化
      labelFilters: filters?.labelFilters || {
        includeMeetingNotes: false
      },
    });
    const searchLanceDBDuration = Date.now() - searchLanceDBStartTime;
    
    // Phase 0A-4 ROLLBACK: ログ出力を開発環境のみに制限（前のバージョンと同じ）
    if (process.env.NODE_ENV === 'development' && searchLanceDBDuration > 10000) {
      console.warn(`⚠️ [lancedbRetrieverTool] SLOW searchLanceDB: ${searchLanceDBDuration}ms for query: "${query}"`);
      writeLogToFile('warn', 'slow_search', 'Slow searchLanceDB detected', {
        query,
        duration: searchLanceDBDuration,
        threshold: 10000,
      });
    }
    
    // 検索結果ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      writeLogToFile('info', 'search_results', 'Raw search results stats', {
        count: unifiedResults.length,
        titles: unifiedResults.map(r => r.title)
      });
    }
    
    // 検索処理時間の計測（開発環境のみ）
    const searchDuration = Date.now() - searchStartTime;
    if (process.env.NODE_ENV === 'development') {
      if (searchDuration > 10000) {
        console.warn(`⚠️ [lancedbRetrieverTool] SLOW TOTAL search: ${searchDuration}ms for query: "${query}"`);
      }
    }
    
    // ログファイルに検索結果を記録
    writeLogToFile('info', 'search_results', 'Search completed', {
      query,
      resultCount: unifiedResults.length,
      searchLanceDBDuration,
      totalDuration: searchDuration,
      titles: unifiedResults.slice(0, 10).map(r => r.title),
    });

    // UIが期待する形へ最小変換（scoreText, source を保持）
    // ★★★ MIGRATION: page_idフィールドのみを使用（フォールバックなし） ★★★
    // LLMに渡すcontextの件数を制限（実際に使用される参照元のみを表示）
    const MAX_CONTEXT_DOCS = 10; // LLMに渡すドキュメント数（回答生成に実際に使用される件数、参照元の表示数）
    const { getPageIdFromRecord } = await import('../../lib/pageid-migration-helper');
    const { buildConfluenceUrl } = await import('../../lib/url-utils');
    const mapped = unifiedResults.slice(0, MAX_CONTEXT_DOCS).map(r => {
      // page_idフィールドのみを使用（唯一の信頼できる情報源）
      const pageId = getPageIdFromRecord(r);
      if (!pageId) {
        console.error(`[lancedbRetrieverTool] ❌ page_id not found for result: ${r.title}. This is a data integrity issue.`);
        // page_idが存在しない場合はエラーとして扱う（フォールバックしない）
      }
      // page_idを数値として使用（データベース形式）
      const pageIdValue = pageId ? String(pageId) : '';
      // 🔍 原因特定: LanceDBから取得したデータにBOMが含まれているか確認
      const originalContentHasBOM = (r.content || '').includes('\uFEFF') || ((r.content || '').length > 0 && (r.content || '').charCodeAt(0) === 0xFEFF);
      const originalTitleHasBOM = (r.title || '').includes('\uFEFF') || ((r.title || '').length > 0 && (r.title || '').charCodeAt(0) === 0xFEFF);
      
      if (originalContentHasBOM || originalTitleHasBOM) {
        console.error(`🚨 [BOM DETECTED IN LANCEDB DATA] LanceDBから取得したデータにBOMが含まれています:`, {
          pageId: pageIdValue,
          title: r.title?.substring(0, 50),
          contentHasBOM: originalContentHasBOM,
          titleHasBOM: originalTitleHasBOM,
          contentFirstCharCode: (r.content || '').length > 0 ? (r.content || '').charCodeAt(0) : -1,
          titleFirstCharCode: (r.title || '').length > 0 ? (r.title || '').charCodeAt(0) : -1,
        });
      }
      
      return {
        id: pageIdValue, // API互換性のため、idフィールドも設定（page_idから生成）
        pageId: pageIdValue, // Phase 0A-1.5: チャンク統合用（page_idから生成）
        page_id: r.page_id, // データベース形式（内部処理用、唯一の信頼できる情報源）
        content: removeBOM(r.content || ''), // 本番環境でLanceDBから取得したデータにBOMが含まれている場合に備える
        url: buildConfluenceUrl(r.page_id || (pageId ? Number(pageId) : undefined), (r as any).space_key, r.url),
        lastUpdated: (r as any).lastUpdated || null,
        spaceName: (r as any).space_key || 'Unknown',
        title: removeBOM(r.title || 'No Title'), // タイトルにもBOMが含まれる可能性がある
        labels: r.labels || [],
        distance: (r as any).distance,
        source: r.source as any,
        scoreText: r.scoreText,
      };
    });

    // Phase 0A-1.5: 全チャンク統合（サーバー側で実装）
    const enriched = await enrichWithAllChunks(mapped);
    
    // Phase 0A-1.5: 空ページフィルター（サーバー側で実装）
    const filterStartTime = Date.now();
    const filtered = await filterInvalidPagesServer(enriched);
    const filterDuration = Date.now() - filterStartTime;
    
    // 2秒以上かかった場合のみログ（パフォーマンス問題の検知）
    if (filterDuration > 2000) {
      console.warn(`⚠️ [lancedbRetrieverTool] Slow filterInvalidPagesServer: ${filterDuration}ms (${(filterDuration / 1000).toFixed(2)}s) for ${enriched.length} results`);
      writeLogToFile('warn', 'slow_filter', 'Slow filterInvalidPagesServer detected', {
        duration: filterDuration,
        resultCount: enriched.length,
        filteredCount: filtered.length,
      });
    }

    // ログファイルに最終結果を記録
    const totalDuration = Date.now() - searchStartTime;
    writeLogToFile('info', 'search_complete', 'Search completed successfully', {
      query,
      totalDuration,
      finalResultCount: filtered.length,
      enrichedCount: enriched.length,
      rawResultCount: unifiedResults.length,
    });

    return filtered;
  } catch (error: any) {
    // エラーログをファイルに記録
    writeLogToFile('error', 'search_error', 'Error retrieving documents', {
      query,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
    
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
    // BOM文字（U+FEFF）を確実に削除（埋め込み生成エラーを防ぐため）
    question = removeBOM(question);
    
    // 検索処理ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      writeLogToFile('info', 'retrieve_query', 'Searching for question', { question });
    }
    const results = await lancedbRetrieverTool(question, { labels, labelFilters });
    if (process.env.NODE_ENV === 'development') {
      writeLogToFile('info', 'retrieve_results', 'Retrieve completed', {
        count: results.length
      });
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
  writeLogToFile('info', 'enrich_start', 'Enriching chunks started', {
    resultCount: results.length,
  });

  // Phase 0A-4 ROLLBACK: ログ削除（前のバージョンと同じ）
  let skippedCount = 0;
  let mergedCount = 0;

  const enriched = await Promise.all(
    results.map(async (result, index) => {
      try {
        const pageStartTime = Date.now();
        // ★★★ MIGRATION: page_idフィールドのみを使用（フォールバックなし） ★★★
        const { getPageIdFromRecord } = await import('../../lib/pageid-migration-helper');
        const pageId = getPageIdFromRecord(result);
        if (!pageId) {
          console.error(`[ChunkMerger] ❌ page_id not found for result: ${result.title}. Skipping chunk enrichment.`);
          // pageIdが見つからない場合もBOM除去は適用する
          return {
            ...result,
            content: removeBOM(result.content || ''),
            title: removeBOM(result.title || ''),
          };
        }

        // Phase 0A-3最適化: isChunkedフラグによる条件分岐
        if (result.isChunked === false) {
          // チャンク分割されていないページ → 統合不要（66.3%）
          // ただし、本番環境でLanceDBから取得したデータにBOMが含まれている場合に備える
          skippedCount++;
          return {
            ...result,
            content: removeBOM(result.content || ''),
            title: removeBOM(result.title || ''),
          };
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
          // ただし、本番環境でLanceDBから取得したデータにBOMが含まれている場合に備える
          return {
            ...result,
            content: removeBOM(result.content || ''),
            title: removeBOM(result.title || ''),
          };
        }

        // Phase 5緊急修正: 大量チャンクの効率的処理（品質維持）
        let mergedContent: string;
        
        if (allChunks.length > 10) {
          // 大量チャンクの場合: 並列処理で高速化
          if (process.env.NODE_ENV === 'development') {
            writeLogToFile('info', 'chunk_merger', 'Large chunk set detected', {
              chunkCount: allChunks.length,
              strategy: 'parallel'
            });
          }
          
          const contentPromises = allChunks.map(async (chunk) => {
            // 本番環境でLanceDBから取得したデータにBOMが含まれている場合に備える
            return removeBOM(chunk.content || '');
          });
          
          const contents = await Promise.all(contentPromises);
          mergedContent = contents.filter(Boolean).join('\n\n');
        } else {
          // 少量チャンクの場合: 従来の処理
          mergedContent = allChunks
            .map((chunk) => removeBOM(chunk.content || ''))
            .filter(Boolean)
            .join('\n\n');
        }

        mergedCount++;
        if (process.env.NODE_ENV === 'development' && allChunks.length > 1) {
          writeLogToFile('info', 'chunk_merger', 'Chunks merged', {
            title: result.title,
            chunkCount: allChunks.length,
            originalLength: result.content?.length || 0,
            mergedLength: mergedContent.length
          });
        }

        return {
          ...result,
          content: removeBOM(mergedContent), // マージされたコンテンツにもBOM除去を適用（念のため）
          title: removeBOM(result.title || ''), // タイトルにもBOM除去を適用
          chunkCount: allChunks.length,
          originalContentLength: result.content?.length || 0,
        };
      } catch (error: any) {
        console.error(`[ChunkMerger] Error enriching result "${result.title}":`, error.message);
        // エラー時も元の結果を返すが、BOM除去は適用する
        return {
          ...result,
          content: removeBOM(result.content || ''),
          title: removeBOM(result.title || ''),
        };
      }
    })
  );

  // ★★★ PERF LOG: ドキュメント取得全体の完了時間 ★★★
  const enrichDuration = Date.now() - enrichStartTime;
  
  // ログファイルにチャンク統合完了を記録
  writeLogToFile('info', 'enrich_complete', 'Enriching chunks completed', {
    duration: enrichDuration,
    totalResults: results.length,
    skippedCount,
    mergedCount,
  });
  
  if (enrichDuration > 10000) {
    console.warn(`[PERF] ⚠️ Slow enrichment detected: ${enrichDuration}ms`);
    writeLogToFile('warn', 'slow_enrich', 'Slow enrichment detected', {
      duration: enrichDuration,
      threshold: 10000,
    });
  }

  if (process.env.NODE_ENV === 'development' && mergedCount > 0) {
    const totalChunks = enriched.reduce((sum, r) => sum + (r.chunkCount || 1), 0);
    writeLogToFile('info', 'chunk_merger', 'Enrichment summary', {
      skipped: skippedCount,
      merged: mergedCount,
      totalChunks
    });
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

    // ★★★ CRITICAL PERF FIX: スカラーインデックスを活用した最適化 ★★★
    // Phase 2では .search().where() が推奨されていましたが、
    // テスト結果では .query().where() の方が正しく動作することが確認されました
    // スカラーインデックス（pageId）が作成されていれば、.query().where() でも高速です
    
    // ★★★ FIX: pageIdが "718373062-0" のような形式の場合、"-0"を削除して数値としてパース ★★★
    // APIレスポンスのidフィールドが `${pageId}-0` という形式になっているため
    let cleanedPageId = pageId;
    if (pageId.includes('-')) {
      // "718373062-0" のような形式の場合、最初の部分（数値部分）を抽出
      const parts = pageId.split('-');
      cleanedPageId = parts[0];
    }
    
    const numericPageId = Number(cleanedPageId);
    if (isNaN(numericPageId)) {
      console.error(`[getAllChunksByPageIdInternal] Invalid pageId (not a number): ${pageId} (cleaned: ${cleanedPageId})`);
      return [];
    }
    
    // スカラーインデックスを使用した数値型での完全一致検索
    // スカラーインデックス（B-Tree）が作成されていれば、O(log n)で高速
    // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
    const results = await table
      .query()
      .where(`\`page_id\` = ${numericPageId}`)
      .limit(1000)
      .toArray();
    
    const scanDuration = Date.now() - scanStartTime;

    // 詳細ログ: クエリ時間と結果数
    if (scanDuration > 100 || process.env.NODE_ENV === 'development') {
      writeLogToFile('info', 'chunks_query', 'Query completed', {
        pageId,
        durationMs: scanDuration,
        resultCount: results.length
      });
    }
    
    if (scanDuration > 1000) {
      console.warn(`[getAllChunksByPageIdInternal] ⚠️ Slow query: ${scanDuration}ms (expected < 100ms with indexes)`);
    }
    
    if (results.length > 0) {
      // chunkIndexでソート
      results.sort((a: any, b: any) => {
        const aIndex = a.chunkIndex || 0;
        const bIndex = b.chunkIndex || 0;
        return aIndex - bIndex;
      });
      
      // ★★★ MIGRATION: データベースのpage_idをpageIdに変換（API互換性） ★★★
      // 内部処理ではpage_idを使用、APIレスポンスではpageIdを維持
      const { mapLanceDBRecordsToAPI } = await import('../../lib/pageid-migration-helper');
      const mappedResults = mapLanceDBRecordsToAPI(results);
      
      // 本番環境でLanceDBから取得したデータにBOMが含まれている場合に備える
      // チャンクのコンテンツとタイトルにBOM除去を適用
      const cleanedResults = mappedResults.map((chunk: any) => ({
        ...chunk,
        content: removeBOM(chunk.content || ''),
        title: removeBOM(chunk.title || ''),
      }));
      
      if (scanDuration > 100 || process.env.NODE_ENV === 'development') {
        writeLogToFile('info', 'chunks_query', 'Chunks fetched', {
          pageId,
          durationMs: scanDuration,
          chunkCount: results.length
        });
      }
      
      return cleanedResults;
    }
    
    // 見つからない場合は空配列を返す
    if (scanDuration > 100) {
      writeLogToFile('warn', 'chunks_query', 'No chunks found', {
        pageId,
        durationMs: scanDuration
      });
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
  // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
  const { getPageIdFromRecord } = await import('../../lib/pageid-migration-helper');
  const pageIds = results.map((r) => {
    const pageId = getPageIdFromRecord(r);
    return String(pageId || r.id || 'unknown');
  });
  const labels = await getStructuredLabels(pageIds);

  const validResults = [];

  for (const result of results) {
    const pageId = getPageIdFromRecord(result);
    const pageIdStr = String(pageId || result.id || 'unknown');
    const label = labels.get(pageIdStr);

    // StructuredLabelがある場合: is_validで判定
    if (label) {
      if (label.is_valid === false) {
        // 無効ページ除外ログ（開発環境のみ）
        if (process.env.NODE_ENV === 'development') {
          writeLogToFile('info', 'empty_page_filter', 'Excluded invalid page', {
            title: result.title,
            reason: 'is_valid:false',
            contentLength: label.content_length || 0
          });
        }
        continue;
      }
    } else {
      // StructuredLabelがない場合: コンテンツ長で直接判定
      const contentLength = result.content?.length || 0;
      if (contentLength < 100) {
        // 短いコンテンツ除外ログ（開発環境のみ）
        if (process.env.NODE_ENV === 'development') {
          writeLogToFile('info', 'empty_page_filter', 'Excluded short content page', {
            title: result.title,
            reason: 'content_short',
            contentLength
          });
        }
        continue;
      }
    }

    validResults.push(result);
  }

  if (validResults.length < results.length) {
    // フィルタ結果ログ（開発環境のみ）
    if (process.env.NODE_ENV === 'development') {
      writeLogToFile('info', 'empty_page_filter', 'Filter summary', {
        before: results.length,
        after: validResults.length,
        removed: results.length - validResults.length
      });
    }
  }

  return validResults;
}

