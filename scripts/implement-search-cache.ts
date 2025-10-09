/**
 * 検索結果キャッシュ実装スクリプト
 * よく検索されるクエリに対する応答速度を向上させるため、メモリキャッシュを実装します。
 */

import { searchLanceDB } from './src/lib/lancedb-search-client';

// 簡単なメモリキャッシュ
const searchCache = new Map<string, any>();
const CACHE_SIZE_LIMIT = 1000; // キャッシュサイズ制限
const CACHE_TTL = 5 * 60 * 1000; // 5分間のTTL

interface CacheEntry {
  results: any[];
  timestamp: number;
  ttl: number;
}

/**
 * キャッシュキーを生成
 */
function generateCacheKey(query: string, params: any): string {
  const normalizedQuery = query.toLowerCase().trim();
  const paramString = JSON.stringify({
    topK: params.topK || 3,
    labelFilters: params.labelFilters || { includeMeetingNotes: false, includeArchived: false }
  });
  return `${normalizedQuery}_${Buffer.from(paramString).toString('base64').slice(0, 20)}`;
}

/**
 * キャッシュから検索結果を取得
 */
function getFromCache(cacheKey: string): any[] | null {
  const entry = searchCache.get(cacheKey);
  if (!entry) {
    return null;
  }

  // TTLチェック
  if (Date.now() - entry.timestamp > entry.ttl) {
    searchCache.delete(cacheKey);
    return null;
  }

  console.log(`🎯 キャッシュヒット: "${cacheKey}"`);
  return entry.results;
}

/**
 * キャッシュに検索結果を保存
 */
function setToCache(cacheKey: string, results: any[]): void {
  // キャッシュサイズ制限
  if (searchCache.size >= CACHE_SIZE_LIMIT) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }

  searchCache.set(cacheKey, {
    results,
    timestamp: Date.now(),
    ttl: CACHE_TTL
  });

  console.log(`💾 キャッシュ保存: "${cacheKey}" (${results.length}件)`);
}

/**
 * キャッシュ付き検索関数
 */
async function cachedSearch(query: string, params: any = {}): Promise<any[]> {
  const cacheKey = generateCacheKey(query, params);
  
  // キャッシュから取得を試行
  const cachedResults = getFromCache(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  // キャッシュミスの場合、実際の検索を実行
  console.log(`🔍 キャッシュミス: "${query}"`);
  const results = await searchLanceDB({
    query,
    ...params
  });

  // 結果をキャッシュに保存
  setToCache(cacheKey, results);
  
  return results;
}

/**
 * キャッシュ統計を表示
 */
function showCacheStats(): void {
  console.log('\n📊 キャッシュ統計:');
  console.log(`  キャッシュサイズ: ${searchCache.size}/${CACHE_SIZE_LIMIT}`);
  console.log(`  TTL: ${CACHE_TTL / 1000}秒`);
  
  // キャッシュの内容を表示（デバッグ用）
  if (searchCache.size > 0) {
    console.log('\n🔍 キャッシュ内容:');
    for (const [key, entry] of searchCache.entries()) {
      const age = Math.round((Date.now() - entry.timestamp) / 1000);
      console.log(`  - "${key.slice(0, 30)}..." (${entry.results.length}件, ${age}秒前)`);
    }
  }
}

/**
 * メイン実行関数
 */
async function testCachedSearch() {
  console.log('🚀 検索結果キャッシュのテストを開始します...');

  const testQueries = [
    "教室管理機能について教えて",
    "CSVアップロードの方法",
    "教室の公開フラグとは？",
    "教室管理機能について教えて", // 重複クエリ（キャッシュヒット期待）
    "CSVアップロードの方法", // 重複クエリ（キャッシュヒット期待）
    "エラーハンドリングの仕組み"
  ];

  console.log(`\n📋 テストクエリ数: ${testQueries.length}件`);
  console.log('=' * 60);

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📊 テスト (${i + 1}/${testQueries.length}): "${query}"`);
    
    const startTime = Date.now();
    const results = await cachedSearch(query, { topK: 5 });
    const endTime = Date.now();
    
    console.log(`  ✅ 完了 - 応答時間: ${endTime - startTime}ms, 結果数: ${results.length}件`);
    
    // キャッシュ統計を表示
    if (i === testQueries.length - 1) {
      showCacheStats();
    }
  }

  console.log('\n🎯 キャッシュ効果の測定:');
  
  // キャッシュクリア前の統計
  const beforeStats = {
    size: searchCache.size,
    queries: Array.from(searchCache.keys())
  };
  
  console.log(`  キャッシュクリア前: ${beforeStats.size}件`);
  
  // キャッシュクリア
  searchCache.clear();
  console.log('  キャッシュクリア実行');
  
  // 同じクエリで再テスト（キャッシュなし）
  console.log('\n🔄 キャッシュなしでの再テスト...');
  const query = "教室管理機能について教えて";
  
  const startTime = Date.now();
  const results = await cachedSearch(query, { topK: 5 });
  const endTime = Date.now();
  
  console.log(`  ✅ キャッシュなし - 応答時間: ${endTime - startTime}ms, 結果数: ${results.length}件`);
  
  // キャッシュありでの再テスト
  console.log('\n🔄 キャッシュありでの再テスト...');
  const startTime2 = Date.now();
  const results2 = await cachedSearch(query, { topK: 5 });
  const endTime2 = Date.now();
  
  console.log(`  ✅ キャッシュあり - 応答時間: ${endTime2 - startTime2}ms, 結果数: ${results2.length}件`);
  
  const improvement = ((endTime - startTime) - (endTime2 - startTime2)) / (endTime - startTime) * 100;
  console.log(`\n📈 キャッシュ効果: ${improvement.toFixed(1)}%の改善`);
  
  showCacheStats();
  
  console.log('\n✅ 検索結果キャッシュのテストが完了しました！');
}

// 実行
testCachedSearch().catch(console.error);
