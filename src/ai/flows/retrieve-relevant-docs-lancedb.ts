/**
 * 関連ドキュメント検索（LanceDB版）
 */
import * as z from 'zod';
import { defaultLanceDBSearchClient } from '@/lib/lancedb-search-client';
import * as admin from 'firebase-admin';

/**
 * 検索クエリを拡張して、より具体的なキーワードを含める
 * LLM拡張に基づいた動的なクエリ拡張
 */
function expandSearchQuery(query: string): string {
  const queryLower = query.toLowerCase();
  
  // メール通知系のキーワードを除外するためのネガティブキーワードを追加
  const negativeKeywords = ['メール', 'mail', '通知', 'notification', '送信', 'send'];
  const hasNegativeKeywords = negativeKeywords.some(keyword => queryLower.includes(keyword));
  
  let expandedQuery = query;
  
  if (!hasNegativeKeywords) {
    // メール通知系を除外するためのフィルタを追加
    expandedQuery += ' -メール -mail -通知 -notification';
  }
  
  return expandedQuery.trim();
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
      projectId: 'confluence-copilot-ppjye'
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
      includeArchived: boolean;
    };
  }
): Promise<any[]> {
  try {
    console.log(`[lancedbRetrieverTool] Retrieving documents for query: ${query}`);

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

    // デバッグ: フィルタ内容を可視化
    console.log('[lancedbRetrieverTool] Filter params:', {
      spaceKey: filters?.spaceKey,
      labels: filters?.labels,
      labelFilters: filters?.labelFilters,
    });
    console.log('[lancedbRetrieverTool] Generated filterQuery:', filterQuery || '(none)');

    // 検索クエリを拡張して、より具体的なキーワードを含める
    const expandedQuery = expandSearchQuery(query);
    console.log(`[lancedbRetrieverTool] Original query: "${query}"`);
    console.log(`[lancedbRetrieverTool] Expanded query: "${expandedQuery}"`);
    console.log(`[lancedbRetrieverTool] Query expansion applied: ${expandedQuery !== query ? 'YES' : 'NO'}`);

    // 厳格一致候補（タイトル用）を抽出
    const strictTitleCandidates: string[] = [];
    const normalized = (s: string) => s.normalize('NFKC').trim();
    const base = normalized(query);
    // 単純ルール: 「ログイン機能」が含まれていれば厳格候補に追加
    if (base.includes('ログイン機能')) strictTitleCandidates.push('ログイン機能');
    if (base.includes('会員ログイン')) strictTitleCandidates.push('会員ログイン');
    if (base.toLowerCase().includes('login')) strictTitleCandidates.push('login');

    // LanceDBで検索を実行
    const searchResults = await defaultLanceDBSearchClient.search({
      query: expandedQuery,
      topK: 200, // 初期取得を200に拡大してより多くの候補を評価
      tableName: 'confluence',
      filter: filterQuery || undefined,
      labelFilters: filters?.labelFilters,
      includeLabels: filters?.labels,
      exactTitleCandidates: strictTitleCandidates,
      originalQuery: query,
      useLunrIndex: true, // Enable Lunr inverted index for BM25 candidates
    });

    console.log(`[lancedbRetrieverTool] Found ${searchResults.length} relevant documents from LanceDB`);
    
    // デバッグ: 検索結果の詳細をログ出力
    console.log(`[lancedbRetrieverTool] === ベクトル検索結果詳細 ===`);
    searchResults.forEach((result, index) => {
      console.log(`[lancedbRetrieverTool] Result ${index + 1}: title="${result.title}", pageId="${result.pageId}", distance=${result.distance}, source="${result.source || 'vector'}"`);
    });
    console.log(`[lancedbRetrieverTool] === ベクトル検索結果詳細終了 ===`);

    if (searchResults.length === 0) {
      return [];
    }

    // LanceDBの結果を整形
    const formattedResults = searchResults.map(result => ({
      id: result.id,
      pageId: result.pageId, // pageIdフィールドを追加
      content: result.content || '',
      url: result.url || '#', // URLが空の場合は'#'をデフォルト値として使用
      lastUpdated: result.lastUpdated || null,
      spaceName: result.space_key || 'Unknown', // 変更なし - フロントエンドはspaceNameを期待
      title: result.title || 'No Title',
      labels: result.labels || [],
      distance: result.distance,
      source: result.source // 検索ソース（vector/keyword）を追加
    }));

    // メール通知系ドキュメントをフィルタリング
    let filteredResults = filterEmailNotifications(formattedResults, query);
  // アプリ層の最終ゲート: 完全除外ラベル（フォルダ/スコープ外/アーカイブ/議事録）は必ず除外
  const EXCLUDE_ALWAYS = new Set(['フォルダ', 'スコープ外', 'アーカイブ', '議事録', 'meeting-notes', 'ミーティング']);
  const before = filteredResults.length;
  filteredResults = filteredResults.filter(r => {
    // ラベルベースの除外
    const hasExcludedLabel = (r.labels || []).some(l => EXCLUDE_ALWAYS.has(l));
    if (hasExcludedLabel) {
      console.log(`[lancedbRetrieverTool] App-level filter: Excluding "${r.title}" due to excluded label: ${(r.labels || []).filter(l => EXCLUDE_ALWAYS.has(l)).join(', ')}`);
      return false;
    }
    
    // タイトルベースの議事録除外
    const title = (r.title || '').toLowerCase();
    const isMeetingDoc = title.includes('議事録') || title.includes('ミーティング') || title.includes('meeting');
    if (isMeetingDoc) {
      console.log(`[lancedbRetrieverTool] App-level filter: Excluding "${r.title}" due to meeting-related title`);
      return false;
    }
    
    // タイトルベースのフォルダ除外（■マークが付いているもの）
    const isFolderDoc = title.includes('■') || title.includes('フォルダ');
    if (isFolderDoc) {
      console.log(`[lancedbRetrieverTool] App-level filter: Excluding "${r.title}" due to folder title (■ mark)`);
      return false;
    }
    
    // 短いコンテンツページを除外（参照リンクのみのページ）
    const content = r.content || '';
    if (content.length < 100) {
      console.log(`[lancedbRetrieverTool] App-level filter: Excluding "${r.title}" due to short content (${content.length} chars)`);
      return false;
    }
    
    return true;
  });
  const removed = before - filteredResults.length;
  if (removed > 0) {
    console.log(`[lancedbRetrieverTool] App-level post filter removed ${removed} results by EXCLUDE_ALWAYS labels`);
  }
    console.log(`[lancedbRetrieverTool] Filtered ${formattedResults.length - filteredResults.length} email notification documents`);
    console.log(`[lancedbRetrieverTool] Filtering applied: ${formattedResults.length !== filteredResults.length ? 'YES' : 'NO'}`);
    
    // 参照元の表示数を制限（上位10件のみ）
    const limitedResults = filteredResults.slice(0, 10);
    console.log(`[lancedbRetrieverTool] Limited results to top ${limitedResults.length} documents`);
    
    // デバッグ: フィルタリング後の結果をログ出力
    console.log(`[lancedbRetrieverTool] === フィルタリング後最終結果 ===`);
    limitedResults.forEach((result, index) => {
      console.log(`[lancedbRetrieverTool] Final ${index + 1}: title="${result.title}", pageId="${result.pageId}", distance=${result.distance}, source="${result.source || 'vector'}"`);
    });
    console.log(`[lancedbRetrieverTool] === フィルタリング後最終結果終了 ===`);
    
    return limitedResults;
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
      includeArchived: z.boolean(),
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
    includeArchived: boolean;
  };
}): Promise<any[]> {
  try {
    console.log(`[retrieveRelevantDocs] Searching for question: ${question}`);
    const results = await lancedbRetrieverTool(question, { labels, labelFilters });
    console.log(`[retrieveRelevantDocs] Found ${results.length} relevant documents`);
    return results;
  } catch (error: any) {
    console.error(`[retrieveRelevantDocs] Error: ${error.message}`);
    throw new Error(`Failed to retrieve relevant documents: ${error.message}`);
  }
}
