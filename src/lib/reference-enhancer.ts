/**
 * 参照元拡張ユーティリティ
 * 回答内で言及されているページを参照元に追加する機能
 */

import { searchLanceDB } from './lancedb-search-client';

// getTitleSearchCacheはlancedb-search-client.ts内で定義されているため、動的インポートを使用
function getTitleSearchCache(): {
  get: (key: string) => any[] | undefined;
  set: (key: string, value: any[]) => void;
} {
  // lancedb-search-client.tsから直接インポートできないため、グローバルキャッシュにアクセス
  // 注意: この実装はlancedb-search-client.tsの実装に依存している
  if (typeof globalThis !== 'undefined' && (globalThis as any).__titleSearchCache) {
    return (globalThis as any).__titleSearchCache;
  }
  // キャッシュが存在しない場合は、searchLanceDBの呼び出し時に作成される
  // ここでは空のキャッシュを返す（実際の使用時にはキャッシュが存在する）
  return {
    get: (key: string) => undefined,
    set: (key: string, value: any[]) => {}
  };
}

export interface Reference {
  title: string;
  url?: string;
  [key: string]: any;
}

/**
 * 回答内の参照元言及を抽出
 * @param answer 回答テキスト
 * @returns 抽出されたタイトルリスト
 */
export function extractReferencedTitles(answer: string): string[] {
  const referencePattern = /（([^）]+)）/g;
  const matches = Array.from(answer.matchAll(referencePattern));
  return matches.map(m => m[1].trim()).filter(Boolean);
}

/**
 * 既存の参照元リストに含まれていないタイトルを抽出
 * @param titles 抽出されたタイトルリスト
 * @param existingReferences 既存の参照元リスト
 * @returns マッチングできないタイトルリスト
 */
export function findMissingTitles(
  titles: string[],
  existingReferences: Reference[]
): string[] {
  return titles.filter(title => {
    return !existingReferences.some(ref => {
      const refTitle = (ref.title || '').trim();
      const titleTrimmed = title.trim();
      
      // 完全一致
      if (refTitle === titleTrimmed) {
        return true;
      }
      
      // 番号部分を除いた比較
      const refWithoutNumber = refTitle.replace(/^\d+_/, '').trim();
      const titleWithoutNumber = titleTrimmed.replace(/^\d+_/, '').trim();
      
      if (refWithoutNumber && titleWithoutNumber) {
        if (refWithoutNumber === titleWithoutNumber) {
          return true;
        }
        if (refWithoutNumber.includes(titleWithoutNumber) || titleWithoutNumber.includes(refWithoutNumber)) {
          return true;
        }
      }
      
      // 部分一致
      if (refTitle.includes(titleTrimmed) || titleTrimmed.includes(refTitle)) {
        return true;
      }
      
      // キーワードベースのマッチング
      const extractKeywords = (text: string): string[] => {
        const cleaned = text.replace(/^[\d_]*[【（\(]?[A-Z]+[】）\)]?\s*/, '').trim();
        const keywords = cleaned.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]{2,}/g) || [];
        return keywords.filter((k: string) => k.length >= 2);
      };
      
      const refKeywords = extractKeywords(refTitle);
      const titleKeywords = extractKeywords(titleTrimmed);
      
      if (refKeywords.length > 0 && titleKeywords.length > 0) {
        const commonKeywords = refKeywords.filter(k => titleKeywords.includes(k));
        const longCommonKeywords = commonKeywords.filter(k => k.length >= 3);
        
        if (longCommonKeywords.length >= 1 || commonKeywords.length >= 2) {
          return true;
        }
      }
      
      return false;
    });
  });
}

/**
 * タイトルで検索して参照元を取得
 * @param titles 検索するタイトルリスト
 * @param tableName テーブル名（'confluence' または 'jira_issues'）
 * @param maxSearches 最大検索数（デフォルト: 5）
 * @param timeout 各検索のタイムアウト（ミリ秒、デフォルト: 500ms）
 * @returns 検索結果の参照元リスト
 */
export async function searchReferencesByTitles(
  titles: string[],
  tableName: string = 'confluence',
  maxSearches: number = 5,
  timeout: number = 5000 // ★★★ パフォーマンス改善: 2秒 → 5秒（BM25検索が完了するまで待つ） ★★★
): Promise<Reference[]> {
  // 検索数を制限
  const titlesToSearch = titles.slice(0, maxSearches);
  
  // キャッシュを確認
  const titleSearchCache = getTitleSearchCache();
  const cachedResults: Reference[] = [];
  const uncachedTitles: string[] = [];
  
  for (const title of titlesToSearch) {
    const cacheKey = `title-search:${title.toLowerCase().trim()}`;
    const cached = titleSearchCache.get(cacheKey);
    if (cached && cached.length > 0) {
      // キャッシュから取得した結果を参照元形式に変換
      cachedResults.push(...cached.map((doc: any) => ({
        title: doc.title || 'No Title',
        url: doc.url || '',
        distance: doc.distance || 0.5,
        source: doc.source || 'vector',
        dataSource: tableName === 'jira_issues' ? 'jira' : 'confluence',
        issue_key: doc.issue_key
      })));
    } else {
      uncachedTitles.push(title);
    }
  }
  
  // キャッシュヒットしたものは即座に返す
  if (uncachedTitles.length === 0) {
    return cachedResults;
  }
  
  // ⚡ ログ削減: デバッグ時のみ詳細ログを出力
  const DEBUG_SEARCH = process.env.NODE_ENV === 'development' && process.env.DEBUG_SEARCH === 'true';
  
  // ★★★ パフォーマンス改善: 順次実行に変更（並行実行によるリソース競合を回避） ★★★
  // 同時実行数を2件に制限してリソース競合を削減
  const MAX_CONCURRENT_SEARCHES = 2;
  const searchResults: Reference[][] = [];
  
  // バッチ処理: 最大2件ずつ順次実行
  for (let i = 0; i < uncachedTitles.length; i += MAX_CONCURRENT_SEARCHES) {
    const batch = uncachedTitles.slice(i, i + MAX_CONCURRENT_SEARCHES);
    
    // バッチ内は並列実行（最大2件）
    const batchPromises = batch.map(async (title) => {
      try {
        if (DEBUG_SEARCH) {
          console.log(`[reference-enhancer] Searching for title: "${title}"`);
        }
        
        // ★★★ 修正: Issue Key（CTJ-####形式）を除去してLunr検索エラーを回避 ★★★
        // Issue Keyパターン: 大文字2-5文字 + ハイフン + 数字
        const issueKeyPattern = /^[A-Z]{2,5}-\d+[:\s]*/;
        const cleanedTitle = title.replace(issueKeyPattern, '').trim();
        const searchQuery = cleanedTitle || title; // Issue Keyのみの場合は元のタイトルを使用
        
        const searchPromise = searchLanceDB({
          query: searchQuery,
          exactTitleCandidates: [title], // 完全一致検索には元のタイトルを使用
          topK: 3, // ★★★ 修正: 1件 → 3件（より柔軟なマッチング） ★★★
          tableName: tableName as 'confluence' | 'jira_issues'
        });
        
        const timeoutPromise = new Promise<Reference[]>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), timeout);
        });
        
        const results = await Promise.race([searchPromise, timeoutPromise]);
        
        // 検索結果のログ出力（デバッグ用）
        if (DEBUG_SEARCH) {
          if (results && results.length > 0) {
            console.log(`[reference-enhancer] Found ${results.length} results for "${title}":`, results.map(r => r.title).join(', '));
          } else {
            console.warn(`[reference-enhancer] No results found for title "${title}"`);
          }
        }
        
        // 検索結果をキャッシュに保存
        const cacheKey = `title-search:${title.toLowerCase().trim()}`;
        titleSearchCache.set(cacheKey, results);
        
        // 参照元形式に変換（最も関連性の高い1件のみを返す）
        // ただし、タイトルが完全一致または非常に近い場合は優先的に選択
        const converted = results.map((doc: any) => ({
          title: doc.title || 'No Title',
          url: doc.url || '',
          distance: doc.distance || 0.5,
          source: doc.source || 'vector',
          dataSource: tableName === 'jira_issues' ? 'jira' : 'confluence',
          issue_key: doc.issue_key,
          _originalSearchTitle: title // デバッグ用
        }));
        
        // タイトルが完全一致または非常に近いものを優先
        const exactMatch = converted.find(r => {
          const refTitle = (r.title || '').trim();
          const searchTitle = title.trim();
          return refTitle === searchTitle || 
                 refTitle.replace(/^\d+_/, '') === searchTitle.replace(/^\d+_/, '') ||
                 refTitle.includes(searchTitle) || 
                 searchTitle.includes(refTitle);
        });
        
        return exactMatch ? [exactMatch] : converted.slice(0, 1); // 完全一致があればそれを、なければ最初の1件
      } catch (error) {
        // タイムアウトやエラー時は空配列を返す
        console.warn(`[reference-enhancer] Search failed for title "${title}":`, error instanceof Error ? error.message : error);
        return [];
      }
    });
    
    // バッチの結果を待機
    const batchResults = await Promise.all(batchPromises);
    searchResults.push(...batchResults);
  }
  
  const newReferences = searchResults.flat();
  
  // キャッシュヒット分と検索結果を結合
  return [...cachedResults, ...newReferences];
}

/**
 * 回答内で言及されているページを参照元に追加
 * @param answer 回答テキスト
 * @param existingReferences 既存の参照元リスト
 * @param tableName テーブル名（'confluence' または 'jira_issues'）
 * @param options オプション
 * @returns 拡張された参照元リスト
 */
export async function enhanceReferences(
  answer: string,
  existingReferences: Reference[],
  tableName: string = 'confluence',
  options: {
    maxSearches?: number;
    timeout?: number;
    enableBackgroundSearch?: boolean;
  } = {}
): Promise<{
  immediateReferences: Reference[];
  backgroundSearchTitles: string[];
}> {
  const {
    maxSearches = 5,
    timeout = 500,
    enableBackgroundSearch = true
  } = options;
  
  // 回答内の参照元言及を抽出
  const referencedTitles = extractReferencedTitles(answer);
  
  if (referencedTitles.length === 0) {
    return {
      immediateReferences: existingReferences,
      backgroundSearchTitles: []
    };
  }
  
  // マッチングできないタイトルを抽出
  const missingTitles = findMissingTitles(referencedTitles, existingReferences);
  
  if (missingTitles.length === 0) {
    return {
      immediateReferences: existingReferences,
      backgroundSearchTitles: []
    };
  }
  
  // キャッシュヒットする参照元を即座に検索
  const immediateResults = await searchReferencesByTitles(
    missingTitles,
    tableName,
    maxSearches,
    timeout
  );
  
  // 即座に追加できる参照元（キャッシュヒット分）
  const immediateReferences = [...existingReferences, ...immediateResults];
  
  // バックグラウンドで検索する必要があるタイトル（キャッシュミス分）
  // 実際の実装では、このリストを返してクライアント側でバックグラウンド検索を実行
  const backgroundSearchTitles: string[] = []; // 現在は空（将来の拡張用）
  
  return {
    immediateReferences,
    backgroundSearchTitles
  };
}

