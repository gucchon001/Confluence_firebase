/**
 * 関連ドキュメント検索（LanceDB版）
 */
import * as z from 'zod';
import { defaultLanceDBSearchClient } from '@/lib/lancedb-search-client';
import * as admin from 'firebase-admin';

/**
 * 検索クエリを拡張して、より具体的なキーワードを含める
 */
function expandSearchQuery(query: string): string {
  const queryLower = query.toLowerCase();
  
  // ログイン機能関連のキーワードマッピング
  const keywordMappings: { [key: string]: string[] } = {
    'ログイン': ['認証', 'authentication', 'login', 'サインイン', 'ログイン機能', '認証機能'],
    '機能': ['仕様', 'specification', '要件', 'requirement', '詳細', 'detail'],
    '詳細': ['仕様', 'specification', '要件', 'requirement', '機能', 'function'],
    'パスワード': ['password', '認証', 'authentication', 'セキュリティ', 'security'],
    'アカウント': ['account', 'ユーザー', 'user', '会員', 'member'],
    'セキュリティ': ['security', '認証', 'authentication', 'パスワード', 'password']
  };
  
  let expandedQuery = query;
  
  // キーワードマッピングを適用
  for (const [key, synonyms] of Object.entries(keywordMappings)) {
    if (queryLower.includes(key)) {
      const additionalKeywords = synonyms.filter(synonym => !queryLower.includes(synonym));
      if (additionalKeywords.length > 0) {
        expandedQuery += ' ' + additionalKeywords.join(' ');
      }
    }
  }
  
  // メール通知系のキーワードを除外するためのネガティブキーワードを追加
  const negativeKeywords = ['メール', 'mail', '通知', 'notification', '送信', 'send'];
  const hasNegativeKeywords = negativeKeywords.some(keyword => queryLower.includes(keyword));
  
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
  
  // メール通知系のキーワードが含まれている場合は除外しない
  const emailKeywords = ['メール', 'mail', '通知', 'notification', '送信', 'send'];
  const hasEmailKeywords = emailKeywords.some(keyword => queryLower.includes(keyword));
  
  if (hasEmailKeywords) {
    return results; // メール関連の質問の場合は除外しない
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

    // LanceDBで検索を実行
    const searchResults = await defaultLanceDBSearchClient.search({
      query: expandedQuery,
      topK: 20, // 元の設定に戻す
      tableName: 'confluence',
      filter: filterQuery || undefined,
      labelFilters: filters?.labelFilters,
      includeLabels: filters?.labels
    });

    console.log(`[lancedbRetrieverTool] Found ${searchResults.length} relevant documents from LanceDB`);
    
    // デバッグ: 検索結果の詳細をログ出力
    searchResults.forEach((result, index) => {
      console.log(`[lancedbRetrieverTool] Result ${index + 1}: title="${result.title}", pageId="${result.pageId}", distance=${result.distance}`);
    });

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
    const filteredResults = filterEmailNotifications(formattedResults, query);
    console.log(`[lancedbRetrieverTool] Filtered ${formattedResults.length - filteredResults.length} email notification documents`);
    console.log(`[lancedbRetrieverTool] Filtering applied: ${formattedResults.length !== filteredResults.length ? 'YES' : 'NO'}`);
    
    // デバッグ: フィルタリング後の結果をログ出力
    console.log(`[lancedbRetrieverTool] Final results after filtering:`);
    filteredResults.forEach((result, index) => {
      console.log(`[lancedbRetrieverTool] Final ${index + 1}: title="${result.title}", pageId="${result.pageId}", distance=${result.distance}`);
    });
    
    return filteredResults;
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
