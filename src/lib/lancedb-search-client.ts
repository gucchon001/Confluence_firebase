/**
 * LanceDB検索クライアント
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { lancedbClient, LanceDBClient } from './lancedb-client';
import { getEmbeddings } from './embeddings';
import { calculateKeywordScore, LabelFilterOptions } from './search-weights';
import { calculateHybridScore } from './score-utils';
import { unifiedKeywordExtractionService } from './unified-keyword-extraction-service';
import { getDeploymentInfo } from './deployment-info';
import { removeBOM } from './bom-utils';
import { getRowsByPageId, getRowsByPageIdViaUrl, fetchPageFromLanceDB } from './lancedb-utils';
import { lunrSearchClient, LunrDocument } from './lunr-search-client';
import { lunrInitializer } from './lunr-initializer';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { getLabelsAsArray } from './label-utils';
import { labelManager } from './label-manager';
import { GENERIC_DOCUMENT_TERMS, GENERIC_FUNCTION_TERMS, DOMAIN_SPECIFIC_KEYWORDS, DOMAIN_SPECIFIC_KEYWORDS_SET, CommonTermsHelper } from './common-terms-config';
import { GenericCache } from './generic-cache';
import { kgSearchService } from './kg-search-service';
import { searchLogger } from './search-logger';

// 検索結果キャッシュ（グローバルに保持してHMRの影響を回避）
// Phase 5最適化: TTLとサイズを拡大（品質影響なし）
const getSearchCache = () => {
  if (!globalThis.__searchCache) {
    globalThis.__searchCache = new GenericCache<any[]>({
      ttl: 15 * 60 * 1000, // Phase 5: 5分 → 15分に拡大（キャッシュヒット率向上）
      maxSize: 5000,       // Phase 5: 1000 → 5000に拡大（より多くのクエリをキャッシュ）
      evictionStrategy: 'lru'
    });
    
    // キャッシュヒット率の計測: 定期的なログ出力（5分ごと）
    // Phase 8: キャッシュ統計の可視化と最適化判断のため
    if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'nodejs') {
      // サーバーサイドでのみ実行（クライアントサイドでは実行しない）
      if (!globalThis.__cacheStatsInterval) {
        const CACHE_STATS_INTERVAL = 5 * 60 * 1000; // 5分ごと
        
        globalThis.__cacheStatsInterval = setInterval(() => {
          try {
            const stats = globalThis.__searchCache?.getStats();
            if (stats) {
              const hitRatePercent = (stats.hitRate * 100).toFixed(1);
              const usagePercent = ((stats.size / 5000) * 100).toFixed(1);
              console.log(
                `[Cache Stats] 📊 検索結果キャッシュ統計: ` +
                `サイズ=${stats.size}/${5000} (${usagePercent}%), ` +
                `平均ヒット=${stats.avgHits.toFixed(2)}回, ` +
                `ヒット率=${hitRatePercent}%`
              );
            }
          } catch (error) {
            // 統計取得エラーは無視（ログ出力の失敗でシステムに影響を与えない）
            console.warn('[Cache Stats] 統計取得に失敗しました:', error);
          }
        }, CACHE_STATS_INTERVAL);
        
        // 初回は即座に統計を出力（起動時の状態を確認）
        setTimeout(() => {
          try {
            const stats = globalThis.__searchCache?.getStats();
            if (stats) {
              console.log(`[Cache Stats] 📊 検索結果キャッシュ初期状態: サイズ=${stats.size}, 平均ヒット=${stats.avgHits.toFixed(2)}回, ヒット率=${(stats.hitRate * 100).toFixed(1)}%`);
            }
          } catch (error) {
            // エラーは無視
          }
        }, 1000); // 1秒後に初回統計を出力
      }
    }
  }
  return globalThis.__searchCache;
};

// ★★★ 改善案3: タイトル検索結果をキャッシュ（頻繁に検索される候補をキャッシュ） ★★★
const getTitleSearchCache = () => {
  if (!globalThis.__titleSearchCache) {
    globalThis.__titleSearchCache = new GenericCache<any[]>({
      ttl: 30 * 60 * 1000, // タイトル検索は30分キャッシュ（頻繁に検索されるため長めに）
      maxSize: 1000,       // タイトル候補は1000件までキャッシュ
      evictionStrategy: 'lru'
    });
  }
  return globalThis.__titleSearchCache;
};

// TypeScript用のグローバル型定義
declare global {
  var __searchCache: GenericCache<any[]> | undefined;
  var __titleSearchCache: GenericCache<any[]> | undefined;
  var __cacheStatsInterval: NodeJS.Timeout | undefined;
}

// 遅延初期化のため、モジュールレベルでの初期化を削除
// const searchCache = getSearchCache();

/**
 * キャッシュキーを生成
 * 距離閾値を含めることで、閾値変更時にキャッシュが無効化される
 */
function generateCacheKey(query: string, params: any): string {
  const normalizedQuery = query.toLowerCase().trim();
  const paramString = JSON.stringify({
    topK: params.topK || 5,
    maxDistance: params.maxDistance || 2.0,  // 距離閾値を追加（デフォルト値と一致）
    labelFilters: params.labelFilters || { includeMeetingNotes: false }
  });
  return `${normalizedQuery}_${Buffer.from(paramString).toString('base64').slice(0, 20)}`;
}

// キャッシュ関数は削除（GenericCacheを直接使用）

import { calculateSimilarityPercentage, normalizeBM25Score, generateScoreText } from './score-utils';
import { unifiedSearchResultProcessor } from './unified-search-result-processor';

/**
 * スコアを適切なパーセンテージに変換する関数（ハイブリッド検索対応）
 * @deprecated 新しい generateScoreText 関数を使用してください
 */
function normalizeScoreToPercentage(score: number, source: string): number {
  if (score === undefined || score === null) return 0;
  
  // BM25スコアの場合（正の値、大きいほど良い）
  if (source === 'bm25' || source === 'keyword') {
    return normalizeBM25Score(score);
  }
  
  // ベクトル距離またはハイブリッドの場合（0-1の範囲、小さいほど良い）
  return calculateSimilarityPercentage(score);
}

/**
 * LanceDB検索パラメータ
 */
export interface LanceDBSearchParams {
  query: string;
  topK?: number;
  tableName?: string;
  filter?: string;
  maxDistance?: number; // 最大距離（類似度閾値）
  qualityThreshold?: number; // 品質閾値（高品質結果のフィルタリング）
  useKeywordSearch?: boolean; // キーワード検索を使用するかどうか
  labelFilters?: LabelFilterOptions; // ラベルフィルタオプション
  includeLabels?: string[]; // アプリ層での包含フィルタ用ラベル
  exactTitleCandidates?: string[]; // タイトル厳格一致で必ず候補に合流させたい文字列
  useLunrIndex?: boolean; // Feature flag for Lunr inverted index
  originalQuery?: string; // 展開前の原文クエリ（優先度制御用）
  titleWeight?: number; // タイトル重み（ベクトル検索でのタイトル重視度）
}

/**
 * LanceDB検索結果
 */
export interface LanceDBSearchResult {
  id: string;
  pageId?: number; // LanceDB行に含まれる場合があるため追加（API互換性のため）
  page_id?: number; // データベース形式（内部処理用、唯一の信頼できる情報源）
  title: string;
  content: string;
  distance: number;
  score: number; // フロントエンド用のスコアフィールド（distanceと同じ値）
  space_key?: string;
  labels?: string[];
  url?: string;
  lastUpdated?: string;
  source?: 'vector' | 'keyword' | 'hybrid' | 'bm25'; // 検索ソース（ベクトル検索、キーワード検索、BM25検索、またはハイブリッド）
  matchDetails?: {
    titleMatches?: number;
    labelMatches?: number;
    contentMatches?: number;
  }; // マッチングの詳細情報
  // 表示用のスコア情報（ソース別）
  scoreKind?: 'vector' | 'bm25' | 'keyword' | 'hybrid';
  scoreRaw?: number;        // ベクトル: 距離(0-1)、BM25: 生スコア
  scoreText?: string;       // 例) "類似度 12.3%" / "BM25 3.42"
  rrfScore?: number;        // RRFスコア（デバッグ用）
  // Jira特有のフィールド（オプショナル）
  issue_key?: string;
  status?: string;
  status_category?: string;
  priority?: string;
  assignee?: string;
  issue_type?: string;
  updated_at?: string;
}

/**
 * LanceDBで検索を実行する
 */
export async function searchLanceDB(params: LanceDBSearchParams): Promise<LanceDBSearchResult[]> {
  const searchFunctionStartTime = Date.now();
  try {
    
    // キャッシュインスタンスの存在確認
    const cacheInstance = getSearchCache();
    
    // キャッシュキーを生成
    const cacheKey = generateCacheKey(params.query, params);
    
    // キャッシュから取得を試行
    const cachedResults = cacheInstance.get(cacheKey);
    
    if (cachedResults) {
      // Phase 8: キャッシュヒット時のログ（デバッグ時のみ、パフォーマンスへの影響を最小化）
      if (process.env.NODE_ENV === 'development' && Math.random() < 0.01) {
        // 開発環境で1%の確率でログ出力（ログ量を抑制）
        console.log(`[Cache Hit] ✅ 検索結果キャッシュから取得: "${params.query.substring(0, 50)}..."`);
      }
      return cachedResults;
    }
    
    // ⚡ 最適化: Lunr初期化を遅延（BM25検索が必要になった時のみロード）
    // これにより、初回リクエスト時のブロックを回避
    // BM25検索が実際に必要になった時（executeBM25Search内）で初期化する
    
    // デフォルト値の設定
    const topK = params.topK || 5;
    const tableName = params.tableName || 'confluence';
    const titleWeight = params.titleWeight || 1.0; // デフォルトのタイトル重み
    
    // 並列実行でパフォーマンス最適化（最適化されたLanceDB接続を使用）
    // Phase 0A-4: 各処理の詳細なタイミングを計測
    const parallelStartTime = Date.now();
    const embeddingStartTime = Date.now();
    
    const originalFirstCharCode = params.query.length > 0 ? params.query.charCodeAt(0) : -1;
    const originalHasBOM = params.query.includes('\uFEFF') || originalFirstCharCode === 0xFEFF;
    
    const cleanQuery = removeBOM(params.query).trim();
    
    const vectorPromise = getEmbeddings(cleanQuery).then(v => {
      const embeddingDuration = Date.now() - embeddingStartTime;
      if (embeddingDuration > 5000) {
        console.warn(`⚠️ [searchLanceDB] Slow embedding generation: ${embeddingDuration}ms (${(embeddingDuration / 1000).toFixed(2)}s)`);
      }
      return v;
    });
    
    const keywordStartTime = Date.now();
    const keywordsPromise = (async () => {
      // BOM文字（U+FEFF）を削除（埋め込み生成エラーを防ぐため）
      const cleanQueryForKeywords = cleanQuery;
      const kw = await unifiedKeywordExtractionService.extractKeywordsConfigured(cleanQueryForKeywords);
      const keywordDuration = Date.now() - keywordStartTime;
      if (keywordDuration > 2000) {
        console.warn(`⚠️ [searchLanceDB] Slow keyword extraction: ${keywordDuration}ms (${(keywordDuration / 1000).toFixed(2)}s)`);
      }
      return kw;
    })();
    
    const connectionStartTime = Date.now();
    const connectionPromise = (async () => {
      const { getLanceDBTable } = await import('./lancedb-client');
      const tableName = params.tableName || 'confluence';
      // tableNameに基づいて適切なテーブルを取得
      const table = await getLanceDBTable(tableName);
      const connectionDuration = Date.now() - connectionStartTime;
      if (connectionDuration > 2000) {
        console.warn(`⚠️ [searchLanceDB] Slow LanceDB connection: ${connectionDuration}ms (${(connectionDuration / 1000).toFixed(2)}s)`);
      }
      // テーブルをラップしてconnection形式に変換
      return { table };
    })();
    
    const [vector, keywords, connection] = await Promise.all([
      vectorPromise,
      keywordsPromise,
      connectionPromise
    ]);
    const parallelDuration = Date.now() - parallelStartTime;
    
    // 5秒以上かかった場合のみログ（パフォーマンス問題の検知）
    if (parallelDuration > 5000) {
      console.warn(`⚠️ [PERF] Slow parallel initialization: ${parallelDuration}ms`);
    }
    
    // Phase 0A-4: 強化版キーワード抽出（ネガティブワード除去）
    const { enhancedKeywordExtractor } = await import('./enhanced-keyword-extractor');
    const keywordAnalysis = enhancedKeywordExtractor.extractCoreKeywords(params.query, keywords);
    
    const coreKeywords = keywordAnalysis.coreKeywords;
    const priorityKeywords = keywordAnalysis.priorityKeywords;
    
    
    // 核心キーワードを使用（ネガティブワード除去済み）
    const finalKeywords = coreKeywords.length > 0 ? coreKeywords : keywords;
    
    // キーワードの優先度を設定（Setオブジェクトとして）
    const highPriority = new Set(priorityKeywords.slice(0, 3)); // 優先キーワード
    const lowPriority = new Set(finalKeywords.filter(k => !highPriority.has(k))); // 残り
    
    // テーブルを取得
    const tbl = connection.table;
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Phase 1: タイトル検索最優先化（Early Exit）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    // ⚠️ Phase 1（Early Exit）は無効化: パフォーマンス悪化のため
    //    - タイトル軽量取得: 281ms遅延
    //    - Early Exit発動率: 0%（6事例で0回）
    //    - 検索時間悪化: +138%（1,915ms → 4,563ms）
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Stage 2以降: 通常のハイブリッド検索
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    

    // Check if Lunr is ready (should be initialized on startup)
    if (params.useLunrIndex && !lunrInitializer.isReady()) {
      console.warn('[searchLanceDB] Lunr index not ready, falling back to LIKE search');
      console.warn('[searchLanceDB] Lunr status:', lunrInitializer.getProgress());
    }
    
    // ハイブリッド検索の実装
    let vectorResults: any[] = [];
    let keywordResults: any[] = [];
    let bm25Results: any[] = [];
    
    // ラベルフィルタリングの準備（統一されたLabelManagerを使用）
    const labelFilters = params.labelFilters || labelManager.getDefaultFilterOptions();
    const excludeLabels = labelManager.buildExcludeLabels(labelFilters);
    

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Phase 5: ベクトル検索とBM25検索の並列実行（品質影響なし）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    // ★★★ PERF LOG: 並列検索の開始時間を記録（実際の検索処理の開始時点） ★★★
    console.log('[Phase 5] 🚀 並列検索開始: ベクトル検索 + BM25検索\n');
    const parallelSearchStart = Date.now();
    const phase5StartTime = Date.now();
    console.log(`[PERF] 🔍 実際の検索処理開始: ${parallelSearchStart}ms (初期化時間を除外)`);
    
    // Promise.allSettledで並列実行（一方が失敗しても継続）
    const [vectorSearchResult, bm25SearchResult] = await Promise.allSettled([
      executeVectorSearch(tbl, vector, params, finalKeywords, excludeLabels, topK),
      executeBM25Search(tbl, params, finalKeywords, topK, params.tableName || 'confluence')
    ]);
    
    // 結果を取得（失敗時は空配列）
    vectorResults = vectorSearchResult.status === 'fulfilled' ? vectorSearchResult.value : [];
    bm25Results = bm25SearchResult.status === 'fulfilled' ? bm25SearchResult.value : [];
    
    const parallelSearchTime = Date.now() - parallelSearchStart;
    
    // ★★★ PERF LOG: 並列検索の詳細な時間計測 ★★★
    console.log(`[PERF] ⏱️ Phase 5 parallel search completed in ${parallelSearchTime}ms (${(parallelSearchTime / 1000).toFixed(2)}s)`);
    
    // 詳細なパフォーマンス計測ログ
    if (vectorSearchResult.status === 'rejected') {
      console.error(`[Phase 5] ❌ Vector search failed: ${vectorSearchResult.reason}`);
    }
    if (bm25SearchResult.status === 'rejected') {
      console.error(`[Phase 5] ❌ BM25 search failed: ${bm25SearchResult.reason}`);
    }
    
    console.log(`[Phase 5] ✅ 並列検索完了: ${parallelSearchTime}ms`);
    console.log(`[Phase 5]    - Vector: ${vectorResults.length}件 (${vectorSearchResult.status})`);
    console.log(`[Phase 5]    - BM25: ${bm25Results.length}件 (${bm25SearchResult.status})\n`);
    
    // ボトルネック検出: 5秒以上かかった場合
    if (parallelSearchTime > 5000) {
      console.error(`🚨 [CRITICAL] Slow parallel search detected: ${parallelSearchTime}ms (${(parallelSearchTime / 1000).toFixed(2)}s)`);
      console.error(`🚨 [CRITICAL] This indicates a bottleneck in either vector or BM25 search`);
      console.error(`🚨 [CRITICAL] Total results: Vector=${vectorResults.length}, BM25=${bm25Results.length}`);
    }
    
    // フォールバック: 両方失敗した場合は警告
    if (vectorSearchResult.status === 'rejected' && bm25SearchResult.status === 'rejected') {
      console.error('[Phase 5] ❌ 並列検索が全て失敗しました');
      console.error('[Phase 5] Vector error:', vectorSearchResult.reason);
      console.error('[Phase 5] BM25 error:', bm25SearchResult.reason);
      // 空の結果で継続（エラーを投げない）
    }
    
    // Phase 5: ベクトル検索の後処理
    // フィルタリング・ブーストは既にexecuteVectorSearch内で実行済み
    
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Phase 4: タイトルマッチ結果からKG拡張
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    try {
      const titleMatchedResults = vectorResults.filter(r => r._titleBoosted);
      
      // Phase 7最適化: KG拡張を無効化（9.2秒→0秒で大幅高速化）
      // KG拡張は高コスト・低効果のため一時的に無効化
      
      // 結果数を制限（Phase 4調整: BM25結果とマージするため多めに保持）
      vectorResults = vectorResults.slice(0, topK * 5); // 10倍 → 50件（BM25マージ前）
    } catch (err) {
      console.error(`[searchLanceDB] KG expansion error: ${err}`);
      // エラー時もベクトル検索結果は保持
    }

    // 1.5 フォールバック: ベクトル検索が0件でフィルタがある場合、フィルタのみで取得
    if (vectorResults.length === 0 && params.filter) {
      try {
        const filterOnlyResults = await tbl.query().where(params.filter).limit(topK).toArray();
        // ベクトル距離がないため、ダミーの距離を設定
        vectorResults = filterOnlyResults.map(r => ({ ...r, _distance: 1.0, _sourceType: 'filter' }));
      } catch (fallbackErr) {
        console.error('[searchLanceDB] Filter-only query error:', fallbackErr);
      }
    }

    // 1.6 フォールバック: pageIdフィルタがある場合、フォールバック取得を試行
    if (vectorResults.length === 0 && params.filter && params.filter.includes('pageId')) {
      try {
        const pageIdMatch = params.filter.match(/pageId.*?(\d+)/);
        if (pageIdMatch) {
          const pageId = parseInt(pageIdMatch[1]);
          
          // フォールバック取得を試行
          const fallbackResults = await getRowsByPageId(tbl, pageId);
          if (fallbackResults.length > 0) {
            vectorResults = fallbackResults.map(r => ({ ...r, _distance: 0.5, _sourceType: 'fallback' }));
          } else {
            // URL LIKE フォールバックを試行
            const urlFallbackResults = await getRowsByPageIdViaUrl(tbl, pageId);
            if (urlFallbackResults.length > 0) {
              vectorResults = urlFallbackResults.map(r => ({ ...r, _distance: 0.6, _sourceType: 'url-fallback' }));
            }
          }
        }
      } catch (fallbackErr) {
        console.error('[searchLanceDB] Fallback pageId retrieval error:', fallbackErr);
      }
    }
    
    // 1.7 タイトル厳格一致候補の合流（Phase 4強化: 自動生成 + パフォーマンス最適化）
    try {
      // ユーザー指定のタイトル候補
      let titles = (params.exactTitleCandidates || []).filter(Boolean);
      
      // Phase 4: キーワードから自動的にタイトル候補を生成
      const autoGeneratedTitles = generateTitleCandidates(finalKeywords);
      titles = [...titles, ...autoGeneratedTitles];
      
      // ★★★ パフォーマンス最適化: タイトル候補数を制限（49個 → 10個） ★★★
      // タイトル候補が多すぎると、順次実行で78秒かかる問題があった
      titles = titles.slice(0, 10);
      
      if (titles.length > 0) {
        // ★★★ 改善案1: LIKEクエリをLunr検索に置き換える（高速化） ★★★
        // ★★★ 改善案3: タイトル検索結果をキャッシュ（頻繁に検索される候補をキャッシュ） ★★★
        const titleSearchCache = getTitleSearchCache();
        const titleSearchPromises = titles.map(async (t) => {
          try {
            // キャッシュキーを生成
            const cacheKey = `title-search:${t.toLowerCase().trim()}`;
            
            // キャッシュから取得を試行
            const cachedResult = titleSearchCache.get(cacheKey);
            if (cachedResult) {
              return cachedResult;
            }
            
            // キャッシュミス → 検索実行
            let searchResults: any[] = [];
            
            // Lunr検索を使用（インデックスベースの高速検索）
            if (lunrSearchClient.isReady()) {
              const lunrResults = await lunrSearchClient.searchCandidates(t, 20);
              
              // ★★★ 最適化: 複数のpage_idを一度に取得（個別クエリ → バッチ処理） ★★★
              if (lunrResults.length > 0) {
                // ユニークなpage_idを抽出
                const uniquePageIds = [...new Set(lunrResults.map(r => r.pageId).filter(Boolean))];
                
                // すべてのpage_idを一度に取得（IN句を使用）
                try {
                  const pageIdConditions = uniquePageIds.map(id => `\`page_id\` = ${id}`).join(' OR ');
                  const allPageRows = await tbl.query().where(`(${pageIdConditions})`).limit(200).toArray();
                  
                  // Lunr結果のスコア順にソートしてマッチング
                  const pageRowsMap = new Map<number, any[]>();
                  for (const row of allPageRows) {
                    const pageId = row.page_id ?? row.pageId;
                    if (!pageRowsMap.has(pageId)) {
                      pageRowsMap.set(pageId, []);
                    }
                    pageRowsMap.get(pageId)!.push(row);
                  }
                  
                  // Lunr結果の順序を保持してマッチング
                  searchResults = lunrResults
                    .map(result => pageRowsMap.get(result.pageId) || [])
                    .flat()
                    .slice(0, 15); // 最大15件に制限（フェーズ3最適化: 20 → 15、25%削減）
                } catch (e) {
                  console.warn('[searchLanceDB] Failed to batch fetch LanceDB records:', e);
                  // フォールバック: 個別クエリ
                  const lanceDbResults = await Promise.all(lunrResults.map(async (result) => {
                    try {
                      const pageId = result.pageId;
                      const pageRows = await tbl.query().where(`\`page_id\` = ${pageId}`).limit(10).toArray();
                      return pageRows;
                    } catch (err) {
                      console.warn('[searchLanceDB] Failed to fetch LanceDB record for pageId:', result.pageId, err);
                      return [];
                    }
                  }));
                  searchResults = lanceDbResults.flat();
                }
              } else {
                searchResults = [];
              }
            } else {
              // Lunrが利用できない場合はフォールバック（LIKEクエリ）
              const like = `%${t.replace(/'/g, "''")}%`;
              const exactRows = await tbl.query().where(`title LIKE '${like}'`).limit(15).toArray(); // フェーズ3最適化: 20 → 15、25%削減
              searchResults = exactRows;
            }
            
            // 検索結果をキャッシュに保存
            titleSearchCache.set(cacheKey, searchResults);
            
            return searchResults;
          } catch (e) {
            console.warn('[searchLanceDB] Exact title query failed for', t, e);
            return [];
          }
        });
        
        // すべてのタイトル検索を並列実行
        const titleSearchResults = await Promise.all(titleSearchPromises);
        
        // 結果をマージ
        const added: any[] = [];
        for (const exactRows of titleSearchResults) {
          for (const row of exactRows) {
            // 既存に同一idが無ければ合流
            if (!vectorResults.some(r => r.id === row.id)) {
              added.push({ ...row, _distance: 0.2, _sourceType: 'title-exact' });
            }
          }
        }
        
        if (added.length > 0) {
          console.log(`[Title Rescue Search] Added ${added.length} title-exact results to vectorResults`);
          vectorResults = vectorResults.concat(added);
        } else {
          console.log(`[Title Rescue Search] No title-exact results added (titles searched: ${titles.length})`);
        }
      }
    } catch (e) {
      console.warn('[searchLanceDB] Exact title merge step failed', e);
    }
    
    // 改良版ハイブリッド検索の実装
    try {
      console.log(`[searchLanceDB] Implementing improved hybrid search`);
      
      // 正規化関数
      const normalize = (s: string) => s.normalize('NFKC').toLowerCase().trim();
      const includeLabelsNormalized = (params.includeLabels || []).map(l => normalize(String(l)));
      if (includeLabelsNormalized.length > 0) {
        console.log('[searchLanceDB] Applying app-level includeLabels filter:', params.includeLabels);
      }

      // 各結果にハイブリッドスコアを追加（簡素化版 - パフォーマンス最適化）
      const resultsWithHybridScore = [];
      let keywordMatchCount = 0;
      
      // 各結果を処理（ラベルフィルタリングは既に適用済み）
      let excludedCount = 0;
      for (let i = 0; i < vectorResults.length; i++) {
        const originalResult = vectorResults[i];
        
        // 結果のコピーを作成
        const resultWithScore = { ...originalResult };
        
        // キーワードマッチングスコアを計算
        // 🔧 BOM文字（U+FEFF）を削除（データベースから読み込んだデータにBOM文字が含まれている可能性を考慮）
        const title = (originalResult.title || '').replace(/\uFEFF/g, '');
        const content = (originalResult.content || '').replace(/\uFEFF/g, '');
        const labels = getLabelsAsArray(originalResult.labels);
        
        // Phase 6最適化: デバッグログを削減（パフォーマンス改善）
        // 大量のログ出力がI/Oボトルネックになるため、詳細ログは無効化
        // console.log(`[searchLanceDB] Processing result ${i+1}:`);
        // console.log(`  Title: ${title}`);
        // console.log(`  Labels: ${JSON.stringify(labels)}`);
        // console.log(`  Content snippet: ${content.substring(0, 50)}...`);
        
        // アプリ層の包含フィルタ（任意）
        if (includeLabelsNormalized.length > 0) {
          const resultLabelsNormalized = labels.map(l => normalize(String(l)));
          const hasAny = includeLabelsNormalized.some(q => resultLabelsNormalized.includes(q));
          if (!hasAny) {
            excludedCount++;
            continue;
          }
        }

        // ラベルスコアは使用しない（0に固定）
        
        // 検索重み付け関数を使用してスコアを計算
        const scoreResult = calculateKeywordScore(title, content, labels, keywords, { highPriority, lowPriority });
        const keywordScore = scoreResult.score;
        const titleMatches = scoreResult.titleMatches;
        const labelMatches = scoreResult.labelMatches;
        const contentMatches = scoreResult.contentMatches;
        
        // Phase 6最適化: デバッグログを削減（パフォーマンス改善）
        // console.log(`  Score details: keyword=${keywordScore}, title=${titleMatches}, label=${labelMatches}, content=${contentMatches}, labelScore=0`);
        
        // キーワードマッチがある場合はカウント
        if (keywordScore > 0) {
          keywordMatchCount++;
        }
        
        // ベクトル距離、キーワードスコア、ラベルスコアを組み合わせた複合スコア
        const hybridScore = calculateHybridScore(resultWithScore._distance, keywordScore, labelMatches);
        // Phase 6最適化: デバッグログを削減（パフォーマンス改善）
        // console.log(`  Hybrid score: ${hybridScore} (vector: ${resultWithScore._distance}, keyword: ${keywordScore}, label: ${labelMatches})`);
        
        // スコア情報を追加
        resultWithScore._keywordScore = keywordScore;
        resultWithScore._labelScore = labelMatches;
        resultWithScore._hybridScore = hybridScore;
        // タイトル救済検索（_sourceType: 'title-exact'）の場合は保持、それ以外は通常のロジック
        if (!resultWithScore._sourceType || resultWithScore._sourceType !== 'title-exact') {
        resultWithScore._sourceType = keywordScore > 0 ? 'hybrid' : 'vector';
        }
        resultWithScore._matchDetails = {
          titleMatches,
          labelMatches,
          contentMatches
        };
        
        // 配列に追加
        resultsWithHybridScore.push(resultWithScore);
      }
      
      // 除外件数のログ（ラベルフィルタリングは事前に適用済み）
      if (excludedCount > 0) {
        console.log(`[searchLanceDB] Excluded ${excludedCount} results by includeLabels filter`);
      }

      // 追加ブースト: 先頭チャンク（chunkIndex=0）をわずかに優遇
      for (const r of resultsWithHybridScore) {
        if (typeof r.chunkIndex === 'number' && r.chunkIndex === 0) {
          r._hybridScore = (r._hybridScore ?? r._distance) - 0.05;
        }
      }
      
      // Phase 5: BM25検索は既にexecuteBM25Search関数で並列実行済み
      // bm25Resultsは既に設定済みのため、古いBM25検索コードは削除
      
      // BM25結果の後処理（ラベルフィルタリング）
      try {
        if (bm25Results.length > 0 && excludeLabels.length > 0) {
            const beforeBm25 = bm25Results.length;
            bm25Results = bm25Results.filter((result: any) => {
              return !labelManager.isExcluded(result.labels, excludeLabels);
            });
            console.log(`[searchLanceDB] Excluded ${beforeBm25 - bm25Results.length} BM25 results due to label filtering`);
          }
          
        // Phase 5: BM25結果を候補にマージ（既に並列実行済み）
        console.log(`[searchLanceDB] Merging ${bm25Results.length} BM25 results into candidates`);
          
          let added = 0;
          for (const row of bm25Results) {
            const existingIndex = resultsWithHybridScore.findIndex(r => r.id === row.id);
            
            if (existingIndex === -1) {
              // BM25結果にも calculateKeywordScore を適用
              // labelsを配列として正規化
              const normalizedLabels = Array.isArray(row.labels) 
                ? row.labels 
                : (typeof row.labels === 'string' ? [row.labels] : []);
              
              // 🔧 BOM文字（U+FEFF）を削除（データベースから読み込んだデータにBOM文字が含まれている可能性を考慮）
              const cleanTitle = String(row.title || '').replace(/\uFEFF/g, '');
              const cleanContent = String(row.content || '').replace(/\uFEFF/g, '');
              
              const keywordScoreResult = calculateKeywordScore(
                cleanTitle,
                cleanContent,
                normalizedLabels,
                keywords,
                { highPriority, lowPriority }
              );
              
              const merged: any = { 
                ...row, 
                _distance: 1 - (row._bm25Score / 20), 
                _sourceType: 'bm25', 
                _keywordScore: keywordScoreResult.score,
                _titleScore: keywordScoreResult.titleMatches,
                _labelScore: keywordScoreResult.labelMatches,
                _contentScore: keywordScoreResult.contentMatches,
                _labelScoreDetail: keywordScoreResult.labelMatches
              };
              merged._hybridScore = calculateHybridScore(merged._distance, merged._keywordScore, merged._labelScore);
              resultsWithHybridScore.push(merged);
              added++;
            } else {
              // ★★★ 修正: 既存のベクトル検索結果にBM25スコアを追加 ★★★
              const existing = resultsWithHybridScore[existingIndex];
              if (existing._bm25Score === undefined && row._bm25Score !== undefined) {
                existing._bm25Score = row._bm25Score;
                existing._titleMatchRatio = row._titleMatchRatio ?? existing._titleMatchRatio;
                existing._titleMatchedKeywords = row._titleMatchedKeywords ?? existing._titleMatchedKeywords;
                // ソースタイプをhybridに更新（ベクトルとBM25の両方がある場合）
                if (existing._sourceType === 'vector') {
                  existing._sourceType = 'hybrid';
                }
              }
            }
          }
          console.log(`[searchLanceDB] Added ${added} BM25 rows to hybrid candidates`);
      } catch (e) {
        console.warn('[searchLanceDB] BM25 merge failed', e);
      }
      // RRF融合を UnifiedSearchResultProcessor で処理
      // ★★★ 統合: インライン実装をUnifiedSearchResultProcessorに置き換え ★★★
      const rrfProcessedResults = unifiedSearchResultProcessor.processSearchResults(resultsWithHybridScore, {
        vectorWeight: 0.4,
        keywordWeight: 0.4,
        labelWeight: 0.2,
        enableRRF: true,  // ✅ RRFを有効化（統合完了）
        rrfK: 60,
        query: params.query,  // ドメインキーワードブースト用
        keywords: finalKeywords  // タグマッチング用
      });

      // RRF処理後の結果をresultsWithHybridScoreに反映
      const rrfScoreMap = new Map<string, number>();
      for (const r of rrfProcessedResults) {
        rrfScoreMap.set(r.id, r.rrfScore || 0);
      }
      for (const r of resultsWithHybridScore) {
        r._rrfScore = rrfScoreMap.get(r.id) ?? 0;
      }

      // 同一pageId/titleの重複を1件に正規化（最良スコアを残す）
      // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
      const { getPageIdFromRecord } = await import('./pageid-migration-helper');
      const dedupMap = new Map<string, any>();
      for (const r of resultsWithHybridScore) {
        const pageId = getPageIdFromRecord(r) || '';
        const key = `${pageId}::${(r.title || '').toLowerCase()}`;
        const prev = dedupMap.get(key);
        if (!prev || (r._rrfScore ?? 0) > (prev._rrfScore ?? 0)) {
          dedupMap.set(key, r);
        }
      }
      const dedupedResults = Array.from(dedupMap.values());

      // 最終: RRF降順（MMR適用済み配列） → ハイブリッドスコア昇順のタイブレーク
      vectorResults = dedupedResults.sort((a, b) => {
        const diff = (b._rrfScore ?? 0) - (a._rrfScore ?? 0);
        if (Math.abs(diff) > 1e-9) return diff;
        return (a._hybridScore ?? 0) - (b._hybridScore ?? 0);
      });
      
      console.log(`[searchLanceDB] Found ${keywordMatchCount} keyword/hybrid matches in results`);
      console.log(`[searchLanceDB] Applied RRF fusion to ${vectorResults.length} results`);
      console.log(`[searchLanceDB] Top 3 results after RRF:`);
      for (let i = 0; i < Math.min(3, vectorResults.length); i++) {
        console.log(`  ${i+1}. ${vectorResults[i].title} (rrf: ${(vectorResults[i]._rrfScore ?? 0).toFixed(4)})`);
      }
      
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // Phase 4: RRF上位結果からもKG拡張（タイトルブースト漏れ対策）
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      try {
        const topRrfResults = vectorResults.slice(0, 10); // RRF上位10件
        // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
        const { getPageIdFromRecord } = await import('./pageid-migration-helper');
        const rrfResultsWithPageId = topRrfResults.filter(r => getPageIdFromRecord(r));
        
        if (rrfResultsWithPageId.length > 0) {
          console.log(`\n[Phase 4 RRF-KG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`[Phase 4 RRF-KG] RRF上位${rrfResultsWithPageId.length}件からKG拡張開始`);
          
          // Phase 7最適化: RRF-KG拡張も無効化（追加の1.1秒削減）
          console.log(`[Phase 7 RRF-KG Optimization] RRF-KG拡張を無効化（パフォーマンス最適化）`);
          console.log(`[Phase 7 RRF-KG Optimization] 期待効果: 検索時間 -1.1秒（追加改善）`);
          
          console.log(`[Phase 4 RRF-KG] KG拡張スキップ: 0件追加（合計: ${vectorResults.length}件）`);
          console.log(`[Phase 4 RRF-KG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        }
      } catch (error) {
        console.error(`[Phase 4 RRF-KG] KG拡張エラー:`, error);
        // エラー時も検索は継続
      }
      
      // Phase 0A-4: 複合スコアリングを適用（核心キーワード使用）
      // Phase 6最適化: 段階的Composite Scoring（上位50件のみ精密計算）
      try {
        // 動的importではなく静的importに変更（依存関係の問題を回避）
        const { CompositeScoringService } = await import('./composite-scoring-service');
        const compositeScoringService = CompositeScoringService.getInstance();
        
        const compositeScoringStart = Date.now();
        
        // Phase 6最適化: RRFスコアでソート（早期絞り込み）
        const rrfSorted = vectorResults.sort((a, b) => (b._rrfScore || 0) - (a._rrfScore || 0));
        
        console.log(`[Phase 6 Optimization] Total candidates: ${rrfSorted.length}`);
        
        // 上位100件のみComposite Scoringを実行（タグマッチング精度向上のため拡大）
        const TOP_N_FOR_COMPOSITE = 100;
        const top100 = rrfSorted.slice(0, TOP_N_FOR_COMPOSITE);
        const remaining = rrfSorted.slice(TOP_N_FOR_COMPOSITE);
        
        console.log(`[Phase 6 Optimization] Applying composite scoring to top ${top100.length} results only`);
        
        // Phase 5改善: クエリを渡してクエリ関連ブーストを有効化
        const scored100 = compositeScoringService.scoreAndRankResults(top100, finalKeywords, params.query);
        
        // 残りは簡易スコア（RRFスコアを50%に減衰して維持）
        // BM25結果にも_compositeScoreを設定（未設定の場合のみ）
        const remainingWithSimpleScore = remaining.map(r => {
          // 既に_compositeScoreが設定されている場合は保持
          if (r._compositeScore !== undefined && r._compositeScore !== null) {
            return r;
          }
          // 未設定の場合は簡易スコアを設定
          return {
            ...r,
            _compositeScore: (r._rrfScore || 0) * 0.5,  // 簡易スコア
            _scoreBreakdown: null,  // 簡易版のため詳細なし
            _scoringType: 'simple-rrf'  // デバッグ用
          };
        });
        
        // マージして最終ソート
        vectorResults = [...scored100, ...remainingWithSimpleScore]
          .sort((a, b) => (b._compositeScore || 0) - (a._compositeScore || 0));
        
        const compositeScoringTime = Date.now() - compositeScoringStart;
        
        console.log(`[Phase 6 Optimization] Composite scoring completed in ${compositeScoringTime}ms`);
        console.log(`[Phase 6 Optimization]   - Detailed scoring: ${scored100.length} results`);
        console.log(`[Phase 6 Optimization]   - Simple scoring: ${remainingWithSimpleScore.length} results`);
        console.log(`[searchLanceDB] Applied composite scoring (optimized)`);
        console.log(`[searchLanceDB] Top 3 results after composite scoring:`);
        for (let i = 0; i < Math.min(3, vectorResults.length); i++) {
          const r = vectorResults[i];
          const scoringType = r._scoringType || 'detailed';
          console.log(`  ${i+1}. ${r.title} [${scoringType}]`);
          console.log(`     Composite: ${(r._compositeScore ?? 0).toFixed(4)} (V:${(r._scoreBreakdown?.vectorContribution ?? 0).toFixed(2)} B:${(r._scoreBreakdown?.bm25Contribution ?? 0).toFixed(2)} T:${(r._scoreBreakdown?.titleContribution ?? 0).toFixed(2)} L:${(r._scoreBreakdown?.labelContribution ?? 0).toFixed(2)})`);
        }
      } catch (err) {
        console.warn(`[searchLanceDB] Composite scoring failed:`, err);
      }
      
    } catch (err) {
      console.error(`[searchLanceDB] Error applying hybrid search: ${err}`);
      console.error(`[searchLanceDB] Error stack: ${err.stack}`);
      // エラー時は何もしない（元のベクトル検索結果をそのまま使用）
    }
    
    // 3. 結果の結合（Phase 0A-4: 複合スコアリング適用済み）
    const combinedResults = [...vectorResults];
    
    // 複合スコアでソート済みなので、上位を取得
    // Phase 4最適化: 結果数制限を緩和（topK * 3）
    // 理由: 重複排除とフィルタリング後に十分な結果を確保
    let finalResults = combinedResults.slice(0, topK * 3);
    
    // Phase 0A-1.5: ページ単位の重複排除
    // ★★★ MIGRATION: 非同期対応 ★★★
    const deduplicated = await deduplicateByPageId(finalResults);
    
    // Phase 0A-1.5: 空ページフィルター（コンテンツ長ベース、StructuredLabel不要）
    const contentFiltered = filterInvalidPagesByContent(deduplicated);
    
    // Phase 0A-4: 議事録フィルター（StructuredLabelベース）
    // structured_category = 'meeting' のページを除外
    const includeMeetingNotes = labelFilters?.includeMeetingNotes ?? false;
    const meetingFiltered = filterMeetingNotesByCategory(contentFiltered, includeMeetingNotes);
    
    // Phase 0A-5: 非推奨（deprecated）ドキュメントフィルター
    // structured_status = 'deprecated' またはタイトルに非推奨キーワードが含まれるページを除外
    const filtered = filterDeprecatedDocuments(meetingFiltered);
    
    // 統一検索結果処理サービスを使用して結果を処理（フォーマットのみ、RRFは既に適用済み）
    // ★★★ 統合: RRF処理は既に適用済みのため、フォーマットのみ実行 ★★★
    const processedResults = unifiedSearchResultProcessor.processSearchResults(filtered, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: false  // RRFは既に適用済み（767行目付近）のため無効化
    });
    
    // 結果をキャッシュに保存
    cacheInstance.set(cacheKey, processedResults);
    
    // 総計時間の計測
    const searchFunctionDuration = Date.now() - searchFunctionStartTime;
    
    // 10秒以上かかった場合のみログ（パフォーマンス問題の検知）
    if (searchFunctionDuration > 10000) {
      console.warn(`⚠️ [searchLanceDB] Slow search: ${searchFunctionDuration}ms for query: "${params.query}"`);
    }
    
    return processedResults;
  } catch (error: any) {
    console.error(`[searchLanceDB] Error: ${error.message}`);
    throw new Error(`LanceDB search failed: ${error.message}`);
  }
}

/**
 * LanceDB検索クライアントを作成する
 */
export function createLanceDBSearchClient() {
  return {
    search: async (params: LanceDBSearchParams) => searchLanceDB(params)
  };
}

/**
 * デフォルトのLanceDB検索クライアント
 */
export const defaultLanceDBSearchClient = createLanceDBSearchClient();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 0A-1.5: 検索品質改善関数
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ページ単位の重複排除（Phase 0A-1.5）
 * 同じpageIdの複数チャンクから、ベストスコアのチャンクのみを選択
 */
async function deduplicateByPageId(results: any[]): Promise<any[]> {
  const pageMap = new Map<string, any>();
  
  // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
  const { getPageIdFromRecord } = await import('./pageid-migration-helper');
  for (const result of results) {
    const pageId = String(getPageIdFromRecord(result) || result.pageId || 'unknown');
    const existing = pageMap.get(pageId);
    
    if (!existing) {
      // 初出のページ
      pageMap.set(pageId, result);
    } else {
      // 既に同じpageIdが存在する場合、ベストスコアを保持
      const currentDistance = result._distance || 999;
      const existingDistance = existing._distance || 999;
      
      if (currentDistance < existingDistance) {
        // より良いチャンクで上書き
        pageMap.set(pageId, result);
        console.log(`[Deduplicator] Updated best chunk for ${result.title}: chunk ${result.chunkIndex || 0}`);
      }
    }
  }
  
  const deduplicated = Array.from(pageMap.values());
  
  if (deduplicated.length < results.length) {
    console.log(`[Deduplicator] Deduplicated: ${results.length} → ${deduplicated.length} results (removed ${results.length - deduplicated.length} duplicate chunks)`);
  }
  
  return deduplicated;
}

/**
 * 空ページフィルター（Phase 0A-1.5、コンテンツ長ベース）
 * StructuredLabel不要で、コンテンツ長のみで判定
 */
function filterInvalidPagesByContent(results: any[]): any[] {
  if (results.length === 0) {
    return results;
  }
  
  const validResults = [];
  
  for (const result of results) {
    const contentLength = result.content?.length || 0;
    
    // 100文字未満のページを除外
    if (contentLength < 100) {
      console.log(`[EmptyPageFilter] Excluded: ${result.title} (content too short: ${contentLength}chars)`);
      continue;
    }
    
    validResults.push(result);
  }
  
  if (validResults.length < results.length) {
    console.log(`[EmptyPageFilter] Filtered: ${results.length} → ${validResults.length} results (removed ${results.length - validResults.length} invalid pages)`);
  }
  
  return validResults;
}

/**
 * Phase 0A-4: 議事録フィルター（ハイブリッド方式）
 * 1. structured_category = 'meeting' で除外
 * 2. structured_categoryがnullの場合、タイトルパターンで除外
 */
function filterMeetingNotesByCategory(results: any[], includeMeetingNotes: boolean): any[] {
  if (includeMeetingNotes || results.length === 0) {
    return results; // 議事録を含める設定の場合はフィルタリングしない
  }
  
  // 議事録を示すタイトルパターン（structured_categoryがnullの場合のフォールバック）
  // 日付形式に対応: "2024-5-8 ミーティング議事録" (1桁月日) と "2024-05-08 ミーティング議事録" (2桁月日)
  const meetingPatterns = [
    /ミーティング議事録/i,
    /会議議事録/i,
    /^\d{4}-\d{1,2}-\d{1,2}\s+(ミーティング|会議|打ち合わせ)/i, // "2024-5-8 ミーティング" や "2024-05-08 ミーティング"
    /^\d{4}-\d{1,2}-\d{1,2}\s+.*議事録/i, // "2024-5-8 ミーティング議事録" などの形式
    /^\d{4}-\d{2}-\d{2}\s+.*議事録/i, // "2025-06-04 ミーティング議事録" などの形式（2桁月日）
    /^\d{4}-\d{1,2}-\d{1,2}\s+確認会.*議事録/i, // "2024-10-04 確認会ミーティング議事録" などの形式
    /MTG議事録/i,
    /meeting\s*notes?/i,
  ];
  
  const validResults = [];
  let filteredByCategory = 0;
  let filteredByTitle = 0;
  
  for (const result of results) {
    // 🔧 BOM文字（U+FEFF）を削除（データベースから読み込んだデータにBOM文字が含まれている可能性を考慮）
    const title = (result.title || '').replace(/\uFEFF/g, '');
    const category = result.structured_category || (result as any).category;
    
    // 方法1: structured_categoryで判定
    if (category === 'meeting') {
      filteredByCategory++;
      if (filteredByCategory + filteredByTitle <= 5) { // 最初の5件のみログ出力
        console.log(`[MeetingNoteFilter] Excluded: ${title} (category: meeting)`);
      }
      continue;
    }
    
    // 方法2: タイトルパターンで判定（structured_categoryがnullでない場合もチェック）
    // タイトルに「議事録」が含まれている場合は、structured_categoryに関係なく除外
    const isMeetingNote = meetingPatterns.some(pattern => pattern.test(title));
    
    if (isMeetingNote) {
      filteredByTitle++;
      if (filteredByCategory + filteredByTitle <= 5) { // 最初の5件のみログ出力
        console.log(`[MeetingNoteFilter] Excluded: ${title} (title pattern match)`);
      }
      continue;
    }
    
    validResults.push(result);
  }
  
  const totalFiltered = filteredByCategory + filteredByTitle;
  if (totalFiltered > 0) {
    console.log(`[MeetingNoteFilter] Filtered: ${results.length} → ${validResults.length} results (removed ${totalFiltered} meeting notes: ${filteredByCategory} by category, ${filteredByTitle} by title)`);
  }
  
  return validResults;
}

/**
 * 非推奨（deprecated）ドキュメントを検索結果から除外
 * structured_status = 'deprecated' のページのみを除外
 */
function filterDeprecatedDocuments(results: any[]): any[] {
  if (results.length === 0) {
    return results;
  }
  
  const validResults = [];
  let filteredCount = 0;
  
  for (const result of results) {
    // 🔧 BOM文字（U+FEFF）を削除
    const title = (result.title || '').replace(/\uFEFF/g, '');
    const status = result.structured_status || (result as any).status;
    
    // structured_statusで判定
    if (status && status.toLowerCase() === 'deprecated') {
      filteredCount++;
      if (filteredCount <= 5) { // 最初の5件のみログ出力
        console.log(`[DeprecatedFilter] Excluded: ${title} (status: deprecated)`);
      }
      continue;
    }
    
    validResults.push(result);
  }
  
  if (filteredCount > 0) {
    console.log(`[DeprecatedFilter] Filtered: ${results.length} → ${validResults.length} results (removed ${filteredCount} deprecated documents)`);
  }
  
  return validResults;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 5: 並列検索のための関数分離（品質影響なし）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * ベクトル検索を実行（Phase 5: 並列化対応）
 */
async function executeVectorSearch(
  tbl: any,
  vector: number[],
  params: LanceDBSearchParams,
  finalKeywords: string[],
  excludeLabels: string[],
  topK: number
): Promise<any[]> {
  try {
    // ★★★ PERF LOG: ベクトル検索の時間計測 ★★★
    const vectorSearchStart = Date.now();
    
    // 🔍 デバッグ: テーブルの行数を確認（0件検出の原因特定）
    try {
      const rowCount = await tbl.countRows();
      console.log(`[Vector Search] 🔍 DEBUG: Table row count: ${rowCount}`);
      if (rowCount === 0) {
        console.error(`[Vector Search] ❌ CRITICAL: Table is empty! This is the root cause of 0 results.`);
        // テーブル名を確認
        const tableName = params.tableName || 'confluence';
        console.error(`[Vector Search] ❌ Table name: ${tableName}`);
        return [];
      }
    } catch (countError) {
      console.warn(`[Vector Search] ⚠️ Failed to count rows:`, countError);
    }
    
    // 🔍 デバッグ: ベクトルの有効性を確認
    if (!vector || vector.length === 0) {
      console.error(`[Vector Search] ❌ CRITICAL: Vector is empty or invalid!`);
      return [];
    }
    console.log(`[Vector Search] 🔍 DEBUG: Vector dimension: ${vector.length}`);
    
    let vectorQuery = tbl.search(vector);
    if (params.filter) {
      vectorQuery = vectorQuery.where(params.filter);
    }
    
    // ★★★ 近似検索（IVF_PQ）の誤差を考慮して、より多くの結果を取得 ★★★
    // 理由: 距離が100位以内に入るはずのドキュメントが検索結果に含まれない問題に対処
    // 参考: docs/analysis/auto-offer-search-issue-root-cause.md
    // 修正: 20倍 → 30倍に拡大（Phase 0A-4設定に復帰）
    const searchLimit = topK * 30;
    console.log(`[Vector Search] 🔍 DEBUG: Search limit: ${searchLimit} (topK=${topK})`);
    let vectorResults = await vectorQuery.limit(searchLimit).toArray(); // 30倍に復帰（Phase 0A-4設定）
    const vectorSearchDuration = Date.now() - vectorSearchStart;
    
    console.log(`[PERF] 🔍 Vector search completed in ${vectorSearchDuration}ms`);
    console.log(`[Vector Search] Found ${vectorResults.length} results`);
    
    // 🔍 デバッグ: 0件の場合の詳細情報
    if (vectorResults.length === 0) {
      console.error(`[Vector Search] ❌ CRITICAL: Vector search returned 0 results!`);
      console.error(`[Vector Search] ❌ DEBUG: topK=${topK}, searchLimit=${searchLimit}, filter=${params.filter || 'none'}`);
    }
    
    // 距離閾値でフィルタリング
    const distanceThreshold = params.maxDistance || 2.0;
    const qualityThreshold = params.qualityThreshold || 0.0;
    
    if (distanceThreshold < 2.0) {
      const beforeCount = vectorResults.length;
      vectorResults = vectorResults.filter(result => result._distance <= distanceThreshold);
      console.log(`[Vector Search] Distance filter: ${beforeCount} -> ${vectorResults.length}`);
    }
    
    if (qualityThreshold < distanceThreshold) {
      const beforeCount = vectorResults.length;
      vectorResults = vectorResults.filter(result => result._distance >= qualityThreshold);
      console.log(`[Vector Search] Quality filter: ${beforeCount} -> ${vectorResults.length}`);
    }
    
    // ラベルフィルタリング
    if (excludeLabels.length > 0) {
      const beforeCount = vectorResults.length;
      vectorResults = vectorResults.filter(result => {
        return !labelManager.isExcluded(result.labels, excludeLabels);
      });
      console.log(`[Vector Search] Label filter: ${beforeCount} -> ${vectorResults.length}`);
    }
    
    // タイトルブースト適用
    // ★★★ MIGRATION: page_idフィールドを確実に保持 ★★★
    const { getPageIdFromRecord } = await import('./pageid-migration-helper');
    const tableName = params.tableName || 'confluence';
    
    // Jiraテーブルの場合、ベクトル検索結果から完全なレコードを取得
    if (tableName === 'jira_issues' && vectorResults.length > 0) {
      console.log(`[Vector Search] Jiraテーブル: ${vectorResults.length}件の結果から完全なレコードを取得中...`);
      
      // id（issue_key）のリストを収集
      const issueKeys = vectorResults
        .map(r => r.id || r.issue_key)
        .filter(Boolean)
        .slice(0, Math.min(vectorResults.length, 300)); // 最大300件まで
      
      if (issueKeys.length > 0) {
        try {
          // バッチで完全なレコードを取得
          const idConditions = issueKeys.map(key => `\`id\` = '${key}'`).join(' OR ');
          const fullRecords = await tbl.query()
            .where(`(${idConditions})`)
            .limit(issueKeys.length)
            .toArray();
          
          // idでマップを作成
          const fullRecordsMap = new Map(fullRecords.map((r: any) => [r.id, r]));
          
          // ベクトル検索結果を完全なレコードで置き換え
          vectorResults = vectorResults.map(result => {
            const fullRecord = fullRecordsMap.get(result.id || result.issue_key);
            if (fullRecord && typeof fullRecord === 'object' && fullRecord !== null) {
              // ベクトル検索の距離情報を保持
              return {
                ...(fullRecord as Record<string, any>),
                _distance: result.distance
              };
            }
            return result;
          });
        } catch (error) {
          console.warn(`[Vector Search] 完全なレコード取得に失敗:`, error);
        }
      }
    }
    
    vectorResults = vectorResults.map(result => {
      const { matchedKeywords, titleMatchRatio } = calculateTitleMatch(result.title, finalKeywords);
      
      // page_idを確実に保持（getPageIdFromRecordを使用）
      const pageId = getPageIdFromRecord(result);
      const page_id = result.page_id ?? pageId;
      
      // Jira特有のフィールドを保持（LanceDBから取得したデータに含まれている場合）
      const jiraFields = tableName === 'jira_issues' ? {
        issue_key: result.issue_key || result.id,
        status: result.status,
        status_category: result.status_category,
        priority: result.priority,
        assignee: result.assignee,
        issue_type: result.issue_type,
        updated_at: result.updated_at
      } : {};
      
      
      if (matchedKeywords.length > 0) {
        // ★★★ 調整: タイトルブーストを弱める（タグマッチページが相対的に強くなるように） ★★★
        // 変更: 10.0倍 → 5.0倍、5.0倍 → 3.0倍
        let boostFactor = 1.0;
        if (titleMatchRatio >= 0.66) {
          boostFactor = 5.0; // 10.0倍 → 5.0倍に削減
        } else if (titleMatchRatio >= 0.33) {
          boostFactor = 3.0; // 5.0倍 → 3.0倍に削減
        }
        
        return { 
          ...result, 
          ...jiraFields, // Jira特有のフィールドを追加
          page_id: page_id, // ★★★ MIGRATION: page_idを確実に保持 ★★★
          _distance: result._distance * (1 / boostFactor), 
          _titleBoosted: true,
          _titleMatchedKeywords: matchedKeywords.length,
          _titleMatchRatio: titleMatchRatio
        };
      }
      // マッチしない場合もpage_idとJira特有のフィールドを保持
      return {
        ...result,
        ...jiraFields, // Jira特有のフィールドを追加
        page_id: page_id // ★★★ MIGRATION: page_idを確実に保持 ★★★
      };
    });
    
    console.log(`[Vector Search] Title boost applied: ${vectorResults.filter(r => r._titleBoosted).length} results`);
    
    return vectorResults;
    
  } catch (error) {
    console.error(`[Vector Search] Error:`, error);
    return [];
  }
}

/**
 * BM25検索を実行（Phase 5: 並列化対応）
 */
async function executeBM25Search(
  tbl: any,
  params: LanceDBSearchParams,
  finalKeywords: string[],
  topK: number,
  tableName: string = 'confluence'
): Promise<any[]> {
  const bm25SearchStart = Date.now();
  console.log(`[BM25 Search] 🚀 executeBM25Search called for table: ${tableName}, keywords: ${finalKeywords.length}, topK: ${topK}`);
  
  try {
    // Phase 6修正: lunrSearchClientの状態を直接チェック（lunrInitializerの間接チェックは信頼性が低い）
    const isLunrIndexEnabled = params.useLunrIndex !== false; // デフォルトはtrue
    
    // ⚡ 最適化: BM25検索が無効な場合は即座にスキップ
    if (!isLunrIndexEnabled) {
      console.log(`[BM25 Search] ⏭️  Skipping BM25 search: useLunrIndex=${params.useLunrIndex}`);
      return [];
    }
    
    // ⚡ 最適化: Lunrインデックスの遅延初期化（オンデマンド）
    // 必要になった時だけ初期化を試行（初期化完了を待つ）
    const isLunrReady = lunrSearchClient.isReady(tableName);
    console.log(`[BM25 Search] 🔍 DEBUG: Lunr ready status for ${tableName}: ${isLunrReady}`);
    
    if (!isLunrReady) {
      console.log(`[BM25 Search] Lunr not ready for ${tableName}, initializing...`);
      
      // 初期化を開始
      const { lunrInitializer } = await import('./lunr-initializer');
      
      // ⚡ 修正: 初期化を待つ（タイムアウトを10秒に設定、その後ポーリングで待つ）
      // BM25検索が動作するように初期化完了を待つ
      try {
        // 初期化を開始（バックグラウンドで実行される）
        const initPromise = lunrInitializer.initializeAsync(tableName);
        
        // 10秒でタイムアウト、その後ポーリングで待つ（初期化が遅い場合に対応）
        const timeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            console.warn(`[BM25 Search] Lunr initialization timeout for ${tableName} after 10s, polling for readiness...`);
            resolve();
          }, 10000); // 3秒 → 10秒に延長
        });
        
        // タイムアウトまたは初期化完了を待つ
        await Promise.race([initPromise, timeoutPromise]);
        
        // 初期化が完了するまでポーリングで待つ（最大10秒追加）
        const maxPollingTime = 10000; // 2秒 → 10秒に延長（合計最大20秒）
        const pollingInterval = 100; // ポーリング間隔（100ms）
        const pollingStartTime = Date.now();
        
        while (!lunrSearchClient.isReady(tableName)) {
          if (Date.now() - pollingStartTime > maxPollingTime) {
            console.warn(`[BM25 Search] Lunr still not ready for ${tableName} after ${maxPollingTime}ms polling, skipping BM25`);
            return [];
          }
          await new Promise(resolve => setTimeout(resolve, pollingInterval));
        }
        
        console.log(`[BM25 Search] ✅ Lunr ready for ${tableName} after initialization`);
      } catch (error) {
        console.warn(`[BM25 Search] Lunr initialization failed for ${tableName}:`, error);
        return [];
      }
    }
    
    // 🔍 デバッグ: Lunrインデックスの状態を確認
    try {
      const lunrStatus = lunrSearchClient.getStatus(tableName);
      console.log(`[BM25 Search] 🔍 DEBUG: Lunr index status:`, {
        tableName,
        isReady: isLunrReady,
        documentCount: lunrStatus?.documentCount || 'unknown',
        hasIndex: lunrStatus?.hasIndex || 'unknown',
        initialized: lunrStatus?.initialized || 'unknown'
      });
    } catch (statusError) {
      console.warn(`[BM25 Search] ⚠️ Failed to get Lunr status:`, statusError);
    }
    
    console.log(`[BM25 Search] 🔍 Starting BM25 search with ${finalKeywords.length} keywords: [${finalKeywords.slice(0, 3).join(', ')}${finalKeywords.length > 3 ? '...' : ''}]`);
    
    // ★★★ 最適化: BM25検索のlimitを調整（パフォーマンス向上） ★★★
    // 最適化: kwCapを削減して、適切な件数を取得（200 → 150、topK * 3 → topK * 2.5、25%削減）
    const kwCap = Math.max(150, Math.floor(topK * 2.5)); // フェーズ2最適化: 200 → 150、topK * 3 → topK * 2.5
    const searchKeywords = finalKeywords.slice(0, 5);
    
    console.log(`[BM25 Search] Starting search for keywords: ${searchKeywords.join(', ')}`);
    
    // ★★★ 修正: 各キーワードのスコアを個別に取得し、複数キーワードでマッチした場合にスコアを統合する ★★★
    // 理由: 複数キーワードを同時に検索すると、LunrがOR検索を行うため「会員」だけでマッチしたドキュメントのスコアが高くなる
    //       各キーワードのスコアを個別に取得し、複数キーワードでマッチした場合にスコアを合計することで、より適切なスコアを計算
    const resultMap = new Map<string, { result: any; scores: Map<string, number>; matchedKeywords: string[] }>();
    
    for (const keyword of searchKeywords) {
      const tokenizedQuery = await tokenizeJapaneseText(keyword);
      console.log(`[BM25 Search] Searching '${keyword}' -> '${tokenizedQuery}'`);
      
      const keywordResults = await lunrSearchClient.searchCandidates(tokenizedQuery, kwCap, tableName);
      console.log(`[BM25 Search] Found ${keywordResults.length} results for '${keyword}'`);
      
      for (const result of keywordResults) {
        const existing = resultMap.get(result.id);
        if (existing) {
          // 既に存在する場合、スコアを追加
          existing.scores.set(keyword, result.score || 0);
          if (!existing.matchedKeywords.includes(keyword)) {
            existing.matchedKeywords.push(keyword);
          }
        } else {
          // 新規の場合
          const scoresMap = new Map<string, number>();
          scoresMap.set(keyword, result.score || 0);
          resultMap.set(result.id, {
            result,
            scores: scoresMap,
            matchedKeywords: [keyword]
          });
        }
      }
    }
    
    // スコアを統合（複数キーワードでマッチした場合、スコアを合計）
    const allLunrResults: any[] = [];
    for (const [id, data] of resultMap.entries()) {
      const { result, scores, matchedKeywords } = data;
      // 複数キーワードでマッチした場合、スコアを合計（BM25スコアの自然な統合）
      const combinedScore = Array.from(scores.values()).reduce((sum, score) => sum + score, 0);
      
      allLunrResults.push({
        ...result,
        score: combinedScore,
        _matchedKeywords: matchedKeywords,
        _matchCount: matchedKeywords.length,
        _keywordScores: Object.fromEntries(scores) // デバッグ用
      });
    }
    
    // スコアでソート（降順）- タイトルブースト適用前の元のBM25スコアでソート
    allLunrResults.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    console.log(`[BM25 Search] ✅ BM25 search completed: found ${allLunrResults.length} results (top ${Math.min(topK, allLunrResults.length)} will be returned)`);

    // LanceDB側の詳細情報を取得してStructuredLabelなどを補完
    const lanceDbRecordMap = new Map<number | string, any>();
    try {
      // デバッグ: テーブル名とテーブルの最初のレコードを確認
      console.log(`[BM25 Search] デバッグ: tableName=${tableName}, tbl存在=${!!tbl}`);
      if (tbl) {
        try {
          const testRows = await tbl.query().limit(1).toArray();
          if (testRows.length > 0) {
            console.log(`[BM25 Search] デバッグ: テーブルの最初のレコード（tableName=${tableName}）:`, {
              id: testRows[0].id,
              idType: typeof testRows[0].id,
              issue_key: testRows[0].issue_key,
              issue_keyType: typeof testRows[0].issue_key,
              page_id: testRows[0].page_id,
              page_idType: typeof testRows[0].page_id,
              title: testRows[0].title?.substring(0, 30)
            });
          }
        } catch (testError) {
          console.warn(`[BM25 Search] デバッグ: テーブル確認エラー:`, testError);
        }
      }
      
      // Jiraテーブルの場合、id（issue_key）で取得、Confluenceテーブルの場合、page_idで取得
      if (tableName === 'jira_issues') {
        // Jiraテーブル: id（issue_key）で取得
        const uniqueIssueKeys = Array.from(
          new Set(
            allLunrResults
              .map(result => result.id || result.issue_key)
              .filter(Boolean)
          )
        );

        if (uniqueIssueKeys.length > 0) {
          console.log(`[BM25 Search] Jira enrichment: ${uniqueIssueKeys.length}件のissue_keyを取得予定（最初の5件: ${uniqueIssueKeys.slice(0, 5).join(', ')}）`);
          
          // デバッグ: LanceDBテーブルから実際に取得できるかテスト
          if (uniqueIssueKeys.length > 0) {
            const testKey = uniqueIssueKeys[0];
            try {
              const testRows = await tbl
                .query()
                .where(`\`id\` = '${testKey}'`)
                .limit(1)
                .toArray();
              console.log(`[BM25 Search] デバッグ: テストクエリ（id='${testKey}'）: ${testRows.length}件取得`);
              if (testRows.length > 0) {
                console.log(`[BM25 Search] デバッグ: テスト結果のフィールド:`, Object.keys(testRows[0]).slice(0, 20));
              } else {
                // 別の方法で試す（idフィールドの型を確認）
                const allRows = await tbl.query().limit(1).toArray();
                if (allRows.length > 0) {
                  console.log(`[BM25 Search] デバッグ: テーブルの最初のレコードのid:`, allRows[0].id, `型:`, typeof allRows[0].id);
                  console.log(`[BM25 Search] デバッグ: テーブルの最初のレコードのissue_key:`, allRows[0].issue_key, `型:`, typeof allRows[0].issue_key);
                }
              }
            } catch (testError) {
              console.warn(`[BM25 Search] デバッグ: テストクエリエラー:`, testError);
            }
          }
          
          const chunkSize = 50;
          for (let i = 0; i < uniqueIssueKeys.length; i += chunkSize) {
            const chunk = uniqueIssueKeys.slice(i, i + chunkSize);
            const idConditions = chunk.map(key => `\`id\` = '${key}'`).join(' OR ');

            try {
              const rows = await tbl
                .query()
                .where(`(${idConditions})`)
                .limit(chunk.length)
                .toArray();

              console.log(`[BM25 Search] Jira enrichment: チャンク ${i / chunkSize + 1} - ${rows.length}件のレコードを取得（クエリ: ${chunk.length}件のissue_key）`);

              for (const row of rows) {
                const key = row.id;
                if (key) {
                  lanceDbRecordMap.set(key, row);
                }
              }
            } catch (fetchError) {
              console.warn('[BM25 Search] Failed to fetch Jira records for chunk:', fetchError);
            }
          }
          console.log(`[BM25 Search] Jira enrichment: ${lanceDbRecordMap.size}件のレコードを取得`);
        } else {
          console.warn(`[BM25 Search] Jira enrichment: issue_keyが取得できませんでした（allLunrResults: ${allLunrResults.length}件）`);
        }
      } else {
        // Confluenceテーブル: page_idで取得（既存の処理）
        // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
        const { getPageIdFromRecord } = await import('./pageid-migration-helper');
        const uniquePageIds = Array.from(
          new Set(
            allLunrResults
              .map(result => {
                const pageId = getPageIdFromRecord(result) || result.pageId;
                return Number(pageId);
              })
              .filter(id => Number.isFinite(id) && id > 0)
          )
        );

        if (uniquePageIds.length > 0) {
          const { mapLanceDBRecordToAPI } = await import('./pageid-migration-helper');
          const chunkSize = 50;

          for (let i = 0; i < uniquePageIds.length; i += chunkSize) {
            const chunk = uniquePageIds.slice(i, i + chunkSize);
            const pageIdConditions = chunk.map(id => `\`page_id\` = ${id}`).join(' OR ');

            try {
              const rows = await tbl
                .query()
                .where(`(${pageIdConditions})`)
                .limit(chunk.length * 5)
                .toArray();

              for (const row of rows) {
                const mapped = mapLanceDBRecordToAPI(row);
                const key = Number(mapped.page_id ?? mapped.pageId);
                if (Number.isFinite(key)) {
                  lanceDbRecordMap.set(key, mapped);
                } else {
                  console.warn(`[BM25 Search] Invalid pageId in mapped record:`, { page_id: mapped.page_id, pageId: mapped.pageId });
                }
              }
            } catch (fetchError) {
              console.warn('[BM25 Search] Failed to fetch LanceDB rows for chunk:', fetchError);
            }
          }
        }
      }
    } catch (enrichError) {
      console.warn('[BM25 Search] LanceDB enrichment skipped due to error:', enrichError);
    }
    
    // タイトルブースト適用
    // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
    const { getPageIdFromRecord } = await import('./pageid-migration-helper');
    const bm25Results = allLunrResults.map((r: any) => {
      const { matchedKeywords, titleMatchRatio } = calculateTitleMatch(r.title, finalKeywords);
      
      // 元のBM25スコアを保持（RRF段階で使用）
      const originalBM25Score = r.score || 1.0;
      
      // タイトルブーストスコアを計算（表示用、RRF段階では使用しない）
      // ★★★ 調整: タイトルブーストを弱める（タグマッチページが相対的に強くなるように） ★★★
      // 変更: 5.0倍 → 2.5倍、3.0倍 → 2.0倍
      let boostedScore = originalBM25Score;
      if (titleMatchRatio >= 0.66) {
        boostedScore *= 2.5; // 5.0倍 → 2.5倍に削減
      } else if (titleMatchRatio >= 0.33) {
        boostedScore *= 2.0; // 3.0倍 → 2.0倍に削減
      }
      
      const pageId = getPageIdFromRecord(r) || r.pageId;
      const numericPageId = Number(pageId);
      
      // Jiraテーブルの場合、id（issue_key）で取得、Confluenceテーブルの場合、page_idで取得
      const enrichedRecord = tableName === 'jira_issues'
        ? lanceDbRecordMap.get(r.id || r.issue_key)
        : (Number.isFinite(numericPageId) ? lanceDbRecordMap.get(numericPageId) : undefined);
      
      // ★★★ 修正: page_idを確実に設定（enrichedRecordから優先的に取得） ★★★
      const finalPageId = enrichedRecord?.page_id ?? enrichedRecord?.pageId ?? r.pageId ?? pageId;
      const finalPage_id = enrichedRecord?.page_id ?? r.page_id ?? finalPageId;

      const normalizedLabels = enrichedRecord
        ? getLabelsAsArray(enrichedRecord.labels)
        : (Array.isArray(r.labels)
            ? r.labels
            : (typeof r.labels === 'string' ? [r.labels] : []));

      // space_keyはオプション（page_idだけでURL構築可能）
      const spaceKey = enrichedRecord?.space_key ?? r.space_key ?? r.spaceKey ?? undefined;

      // Jira特有のフィールドを取得
      const jiraFields = tableName === 'jira_issues' && enrichedRecord ? {
        issue_key: enrichedRecord.issue_key || enrichedRecord.id || r.id,
        status: enrichedRecord.status,
        status_category: enrichedRecord.status_category,
        priority: enrichedRecord.priority,
        assignee: enrichedRecord.assignee,
        issue_type: enrichedRecord.issue_type,
        updated_at: enrichedRecord.updated_at
      } : (r.issue_key ? {
        issue_key: r.issue_key,
        status: r.status,
        status_category: r.status_category,
        priority: r.priority,
        assignee: r.assignee,
        issue_type: r.issue_type,
        updated_at: r.updated_at
      } : {});

      // 🔧 BOM文字（U+FEFF）を削除（データベースから読み込んだデータにBOM文字が含まれている可能性を考慮）
      return {
        id: r.id,
        title: (r.title || '').replace(/\uFEFF/g, ''),
        content: (r.content || '').replace(/\uFEFF/g, ''),
        labels: normalizedLabels,
        score: boostedScore, // タイトルブースト適用後のスコア（表示用）
        pageId: finalPageId,
        page_id: finalPage_id, // ★★★ 修正: page_idを確実に設定（enrichedRecordから優先的に取得） ★★★
        isChunked: r.isChunked,
        url: enrichedRecord?.url ?? r.url,
        space_key: spaceKey,
        lastUpdated: enrichedRecord?.lastUpdated ?? r.lastUpdated,
        _bm25Score: originalBM25Score, // ★★★ 修正: 元のBM25スコアを保持（RRF段階で使用） ★★★
        _bm25BoostedScore: boostedScore, // タイトルブーストスコア（表示用）
        _titleMatchRatio: titleMatchRatio,
        _titleMatchedKeywords: matchedKeywords.length,
        structured_category: enrichedRecord?.structured_category,
        structured_domain: enrichedRecord?.structured_domain,
        structured_feature: enrichedRecord?.structured_feature,
        structured_status: enrichedRecord?.structured_status,
        structured_priority: enrichedRecord?.structured_priority,
        structured_confidence: enrichedRecord?.structured_confidence,
        structured_tags: enrichedRecord?.structured_tags,
        structured_version: enrichedRecord?.structured_version,
        structured_content_length: enrichedRecord?.structured_content_length,
        structured_is_valid: enrichedRecord?.structured_is_valid,
        // Jira特有のフィールドを追加
        ...jiraFields
      };
    });
    
    // ★★★ 修正: 元のBM25スコアで再ソート（タイトルブーストを無視） ★★★
    // 理由: タイトルブーストは表示用であり、RRF段階では元のBM25スコアを使用する必要がある
    //       タグでマッチする重要なページが除外されないようにする
    bm25Results.sort((a: any, b: any) => {
      // 元のBM25スコア（タイトルブースト適用前）で比較
      const scoreA = (a as any)._bm25Score || (a as any).score || 0;
      const scoreB = (b as any)._bm25Score || (b as any).score || 0;
      return scoreB - scoreA;
    });
    
    const bm25SearchDuration = Date.now() - bm25SearchStart;
    // ★★★ 修正: BM25検索結果の取得件数を拡大（重要ページを含めるため） ★★★
    //       元のBM25スコアでソート済みなので、上位30件を返す
    const bm25ResultLimit = Math.max(topK * 3, 30); // 10件 → 30件に拡大
    const finalResults = bm25Results.slice(0, bm25ResultLimit);
    
    console.log(`[BM25 Search] ✅ BM25 search completed in ${bm25SearchDuration}ms, returning ${finalResults.length} results`);
    
    if (bm25SearchDuration > 5000) {
      console.warn(`⚠️ [PERF] Slow BM25 search detected: ${bm25SearchDuration}ms`);
    }
    
    return finalResults;
    
  } catch (error) {
    const bm25SearchDuration = Date.now() - bm25SearchStart;
    console.error(`[BM25 Search] ❌ Error after ${bm25SearchDuration}ms:`, error);
    return [];
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 共通ヘルパー関数（重複コード排除）
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * タイトルキーワードマッチングを計算（共通関数）
 * ベクトル・BM25両方で使用
 * 改善: クエリ全体の一致を優先（例：「教室削除」が「教室削除機能」に含まれる場合）
 * 改善: 余分な単語が含まれる場合はペナルティ（例：「教室グループ削除機能」は「教室削除」に対して余分な「グループ」が含まれる）
 */
function calculateTitleMatch(title: string, keywords: string[]): {
  matchedKeywords: string[];
  titleMatchRatio: number;
} {
  // 🔧 BOM文字（U+FEFF）を削除（データベースから読み込んだデータにBOM文字が含まれている可能性を考慮）
  const cleanTitle = String(title || '').replace(/\uFEFF/g, '');
  const titleLower = cleanTitle.toLowerCase();
  const matchedKeywords = keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
  
  // 基本マッチ比率
  let titleMatchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
  
  // 改善: 複合語（DOMAIN_SPECIFIC_KEYWORDS）が含まれている場合は部分的マッチでもブースト
  // 例：「自動オファー」がタイトルに含まれている場合、クエリに「パーソナルオファーと自動オファー」が含まれていてもブースト
  // 注意: DOMAIN_SPECIFIC_KEYWORDS_SET と DOMAIN_SPECIFIC_KEYWORDS は初期化後は動的に更新される
  // keyword-lists-loader が初期化されると、これらの変数は keyword-lists-v2.json から動的に読み込まれたキーワードに更新される
  const hasCompoundDomainKeyword = matchedKeywords.some(kw => 
    DOMAIN_SPECIFIC_KEYWORDS_SET.has(kw) || 
    DOMAIN_SPECIFIC_KEYWORDS.some((dsk: string) => kw.includes(dsk) || dsk.includes(kw))
  );
  
  if (hasCompoundDomainKeyword && matchedKeywords.length > 0) {
    // 複合語が含まれている場合、部分的マッチでも最低0.7を保証
    // 例：「自動オファー」が含まれている場合、最低70%のマッチ比率
    titleMatchRatio = Math.max(titleMatchRatio, 0.7);
  }
  
  // 改善: クエリ全体（キーワードを結合）がタイトルに含まれる場合はブースト
  if (keywords.length > 1) {
    const queryLower = keywords.join(' ').toLowerCase();
    const queryLowerNoSpace = keywords.join('').toLowerCase();
    const queryLowerReversed = keywords.slice().reverse().join('').toLowerCase();
    
    // クエリ全体がタイトルに完全に含まれるかチェック（順序・空白を考慮）
    const isFullQueryMatch = titleLower.includes(queryLower) || 
                             titleLower.includes(queryLowerNoSpace) ||
                             titleLower.includes(queryLowerReversed);
    
    if (isFullQueryMatch) {
      // クエリ全体がタイトルに含まれる場合、マッチ比率を1.0に近づける
      // 例：「教室削除」が「教室削除機能」に含まれる場合
      titleMatchRatio = Math.max(titleMatchRatio, 0.95);
      
      // 改善: 余分な単語が含まれる場合はペナルティ
      // タイトルからクエリを除去して残った文字数をチェック
      // 例：「教室グループ削除機能」から「教室削除」を除去すると「グループ機能」が残る
      const titleWithoutQuery = titleLower
        .replace(queryLower, '')
        .replace(queryLowerNoSpace, '')
        .replace(queryLowerReversed, '');
      
      // 余分な文字数が多すぎる場合はペナルティ
      // ただし、「機能」のような汎用語は除外
      // 一元化: common-terms-config.ts の GENERIC_FUNCTION_TERMS を使用
      const genericTerms = [...GENERIC_FUNCTION_TERMS, '【fix】', '【FIX】', '_', '【', '】'];
      const extraChars = titleWithoutQuery
        .split('')
        .filter((char, idx) => {
          // 汎用語を除外
          const remaining = titleWithoutQuery.substring(idx);
          return !genericTerms.some(term => remaining.startsWith(term.toLowerCase()));
        })
        .join('')
        .trim();
      
      // 余分な文字がある場合、ペナルティを適用
      if (extraChars.length > 2) {
        // 余分な文字が多いほどペナルティ（最大20%減）
        const penalty = Math.min(extraChars.length * 0.05, 0.20);
        titleMatchRatio = Math.max(titleMatchRatio - penalty, 0.75);
      }
    } else {
      // 改善: クエリ全体がタイトルに含まれていない場合でも、
      // キーワードが順序通りに含まれているかチェック（順序は問わない）
      // 例：「教室グループ削除機能」は「教室」「削除」を含んでいるが、「グループ」が間に挟まっている
      const keywordsInOrder = keywords.map(kw => kw.toLowerCase());
      
      // すべてのキーワードがタイトルに含まれているかチェック
      const allKeywordsFound = keywordsInOrder.every(kw => titleLower.includes(kw));
      
      if (allKeywordsFound && keywords.length > 1) {
        // すべてのキーワードが含まれている場合、キーワードの位置を取得
        const keywordPositions = keywordsInOrder.map(kw => ({
          keyword: kw,
          firstIndex: titleLower.indexOf(kw),
          lastIndex: titleLower.lastIndexOf(kw) + kw.length
        })).sort((a, b) => a.firstIndex - b.firstIndex);
        
        // 最初と最後のキーワードの間の文字をチェック
        const firstKeyword = keywordPositions[0];
        const lastKeyword = keywordPositions[keywordPositions.length - 1];
        const betweenChars = titleLower.substring(firstKeyword.lastIndex, lastKeyword.firstIndex);
        
        // 余分な文字がある場合、ペナルティを適用
        if (betweenChars.trim().length > 2) {
          // 汎用語を除外して、余分な文字数をカウント
          // 一元化: common-terms-config.ts の GENERIC_FUNCTION_TERMS を使用
          const genericTerms = [...GENERIC_FUNCTION_TERMS, '【fix】', '【FIX】', '_', '【', '】', 'fix'];
          let extraCharsCount = 0;
          let remaining = betweenChars.trim();
          
          for (const term of genericTerms) {
            remaining = remaining.replace(new RegExp(term, 'gi'), '');
          }
          
          extraCharsCount = remaining.trim().length;
          
          if (extraCharsCount > 2) {
            // 余分な文字が多いほどペナルティ（最大30%減）
            const penalty = Math.min(extraCharsCount * 0.08, 0.30);
            titleMatchRatio = Math.max(titleMatchRatio - penalty, 0.60);
          }
        }
      }
    }
  }
  
  return { matchedKeywords, titleMatchRatio };
}

/**
 * キーワードからタイトル候補を生成（Phase 4強化）
 * ベクトル検索で上位に来ないページを救済
 */
function generateTitleCandidates(keywords: string[]): string[] {
  const candidates: string[] = [];
  
  // 2語の組み合わせを生成
  for (let i = 0; i < keywords.length; i++) {
    for (let j = i + 1; j < keywords.length; j++) {
      candidates.push(`${keywords[i]}${keywords[j]}`);
      candidates.push(`${keywords[j]}${keywords[i]}`);
    }
  }
  
  // 単一キーワードも追加
  candidates.push(...keywords);
  
  return candidates;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Phase 4: Knowledge Graph統合
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 注意: fetchPageFromLanceDB は lancedb-utils.ts に移動済み

/**
 * タイトル検索結果をKGで拡張（Phase 4）
 * タイトルマッチしたページの参照先を自動的に候補に追加
 */
/**
 * Phase 5最適化版: タイトル検索結果をKGで拡張（バッチクエリ使用）
 * Firestoreクエリを一括化してタイムアウトを防止（品質影響なし）
 */
async function expandTitleResultsWithKG(
  titleResults: any[],
  tbl: any,
  options: {
    maxReferences?: number;
    minWeight?: number;
  } = {}
): Promise<any[]> {
  const { maxReferences = 2, minWeight = 0.7 } = options;
  
  if (titleResults.length === 0) {
    return titleResults;
  }
  
  console.log(`[Phase 5 KG] Expanding ${titleResults.length} title-matched results with KG (バッチクエリ)`);
  const kgStartTime = Date.now();
  
  // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
  const { getPageIdFromRecord: getPageId } = await import('./pageid-migration-helper');
  const expandedResults = [...titleResults];
  const addedPageIds = new Set(titleResults.map(r => {
    const pageId = getPageId(r) || r.pageId;
    return pageId ? String(pageId) : null;
  }).filter(Boolean));
  
  try {
    // Phase 5最適化: バッチで参照先を取得（逐次クエリから一括クエリへ）
    const validResults = titleResults.filter(r => {
      const pageId = getPageId(r) || r.pageId;
      return !!pageId;
    });
    const pageIds = validResults.map(r => {
      const pageId = getPageId(r) || r.pageId;
      return pageId ? String(pageId) : '';
    }).filter(Boolean);
    
    if (pageIds.length === 0) {
      return titleResults;
    }
    
    console.log(`[Phase 5 KG] バッチ取得開始: ${pageIds.length}ページ`);
    
    // バッチでKG参照を取得（Firestoreクエリを最小化）
    const batchReferences = await kgSearchService.getBatchReferencedPages(pageIds, {
      maxReferencesPerPage: maxReferences,
      minWeight: minWeight
    });
    
    const kgFetchTime = Date.now() - kgStartTime;
    console.log(`[Phase 5 KG] バッチ取得完了: ${kgFetchTime}ms`);
    
        // Phase 5緊急修正: KG拡張の並列化（品質維持）
        let totalAdded = 0;
        
        for (const result of validResults) {
          const resultPageId = getPageId(result) || result.pageId;
          const references = batchReferences.get(String(resultPageId)) || [];
          
          if (references.length === 0) {
            console.log(`[Phase 5 KG] No references found for page ${resultPageId}`);
            continue;
          }
          
          console.log(`[Phase 5 KG] Found ${references.length} references for page ${resultPageId} (${result.title})`);
          
          // Phase 5緊急修正: 並列でページデータを取得（品質維持）
          const pagePromises = references.map(async ({ node, edge }) => {
            const nodePageId = node.pageId ? String(node.pageId) : null;
            if (!nodePageId || addedPageIds.has(nodePageId)) {
              return null;
            }
            
            try {
              const referencedPage = await fetchPageFromLanceDB(tbl, node.pageId);
              if (referencedPage) {
                return {
                  ...referencedPage,
                  _sourceType: 'kg-reference',
                  _kgWeight: edge.weight,
                  _referencedFrom: resultPageId,
                  _distance: 0.4
                };
              }
            } catch (error) {
              console.warn(`[Phase 5 KG] Failed to fetch page ${node.pageId}:`, error);
            }
            return null;
          });
          
          // 並列実行でページデータを取得
          const pageResults = await Promise.allSettled(pagePromises);
          
          for (const pageResult of pageResults) {
            if (pageResult.status === 'fulfilled' && pageResult.value) {
              const referencedPage = pageResult.value;
              expandedResults.push(referencedPage);
              addedPageIds.add(referencedPage.pageId);
              totalAdded++;
              
              console.log(`[Phase 5 KG] Added KG reference: ${referencedPage.title} (weight: ${referencedPage._kgWeight?.toFixed(2)})`);
            }
          }
        }
    
    const totalTime = Date.now() - kgStartTime;
    console.log(`[Phase 5 KG] Expansion complete: ${titleResults.length} → ${expandedResults.length} results (+${totalAdded} KG references, ${totalTime}ms)`);
    
  } catch (error) {
    console.error(`[Phase 5 KG] Fatal error during KG expansion:`, error);
    // エラー時は元の結果を返す（品質維持）
    return titleResults;
  }
  
  return expandedResults;
}
