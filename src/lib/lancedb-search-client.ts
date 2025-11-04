/**
 * LanceDB検索クライアント
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { lancedbClient } from './lancedb-client';
import { getEmbeddings } from './embeddings';
import { calculateKeywordScore, LabelFilterOptions } from './search-weights';
import { calculateHybridScore } from './score-utils';
import { unifiedKeywordExtractionService } from './unified-keyword-extraction-service';
import { getRowsByPageId, getRowsByPageIdViaUrl } from './lancedb-utils';
import { lunrSearchClient, LunrDocument } from './lunr-search-client';
import { lunrInitializer } from './lunr-initializer';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { getLabelsAsArray } from './label-utils';
import { labelManager } from './label-manager';
import { GENERIC_DOCUMENT_TERMS, GENERIC_FUNCTION_TERMS, CommonTermsHelper } from './common-terms-config';
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
    console.log('🔧 検索キャッシュを初期化しました (Phase 5最適化: TTL=15分, maxSize=5000)');
  }
  return globalThis.__searchCache;
};

// 遅延初期化のため、モジュールレベルでの初期化を削除
// const searchCache = getSearchCache();

// TypeScript用のグローバル型定義
declare global {
  var __searchCache: GenericCache<any[]> | undefined;
}

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
}

/**
 * LanceDBで検索を実行する
 */
export async function searchLanceDB(params: LanceDBSearchParams): Promise<LanceDBSearchResult[]> {
  const searchFunctionStartTime = Date.now();
  try {
    // 開発環境のみ詳細ログ
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n========================================`);
      console.log(`🔍 [searchLanceDB] 検索開始`);
      console.log(`Query: "${params.query}"`);
      console.log(`========================================\n`);
    }
    
    // キャッシュインスタンスの存在確認
    const cacheInstance = getSearchCache();
    
    // キャッシュキーを生成
    const cacheKey = generateCacheKey(params.query, params);
    
    // キャッシュから取得を試行
    const cachedResults = cacheInstance.get(cacheKey);
    
    if (cachedResults) {
      // 開発環境のみログ
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 キャッシュヒット: ${cachedResults.length}件`);
      }
      return cachedResults;
    }
    
    // 最適化されたLunr初期化を使用（重複初期化を防止）
    try {
      // optimized-lunr-initializerはアーカイブに移動済み。代わりにlunr-initializerを使用
      const { lunrInitializer } = await import('./lunr-initializer');
      await lunrInitializer.initializeAsync();
      
      // Phase 6修正: 初期化完了を確実に待つ（並列検索前）
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 開発環境のみログ
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Optimized Lunr initialization completed in searchLanceDB');
      }
    } catch (error) {
      // エラー時のみログ（本番環境でも出力）
      console.error('⚠️ Optimized Lunr initialization failed in searchLanceDB:', error);
    }
    
    // デフォルト値の設定
    const topK = params.topK || 5;
    const tableName = params.tableName || 'confluence';
    const titleWeight = params.titleWeight || 1.0; // デフォルトのタイトル重み
    
    // 並列実行でパフォーマンス最適化（最適化されたLanceDB接続を使用）
    // Phase 0A-4: 各処理の詳細なタイミングを計測
    const parallelStartTime = Date.now();
    const embeddingStartTime = Date.now();
    const vectorPromise = getEmbeddings(params.query).then(v => {
      const embeddingDuration = Date.now() - embeddingStartTime;
      if (embeddingDuration > 5000) {
        console.warn(`⚠️ [searchLanceDB] Slow embedding generation: ${embeddingDuration}ms (${(embeddingDuration / 1000).toFixed(2)}s)`);
      }
      return v;
    });
    
    const keywordStartTime = Date.now();
    const keywordsPromise = (async () => {
      const kw = await unifiedKeywordExtractionService.extractKeywordsConfigured(params.query);
      const keywordDuration = Date.now() - keywordStartTime;
      if (keywordDuration > 2000) {
        console.warn(`⚠️ [searchLanceDB] Slow keyword extraction: ${keywordDuration}ms (${(keywordDuration / 1000).toFixed(2)}s)`);
      }
      return kw;
    })();
    
    const connectionStartTime = Date.now();
    const connectionPromise = (async () => {
      const { optimizedLanceDBClient } = await import('./optimized-lancedb-client');
      const conn = await optimizedLanceDBClient.getConnection();
      const connectionDuration = Date.now() - connectionStartTime;
      if (connectionDuration > 2000) {
        console.warn(`⚠️ [searchLanceDB] Slow LanceDB connection: ${connectionDuration}ms (${(connectionDuration / 1000).toFixed(2)}s)`);
      }
      return conn;
    })();
    
    const [vector, keywords, connection] = await Promise.all([
      vectorPromise,
      keywordsPromise,
      connectionPromise
    ]);
    const parallelDuration = Date.now() - parallelStartTime;
    
    // 5秒以上かかった場合のみログ（パフォーマンス問題の検知）
    if (parallelDuration > 5000) {
      console.warn(`⚠️ [searchLanceDB] Slow parallel initialization: ${parallelDuration}ms (${(parallelDuration / 1000).toFixed(2)}s)`);
    }
    
    // 開発環境のみ詳細ログ
    if (process.env.NODE_ENV === 'development') {
      console.log(`[searchLanceDB] Generated embedding vector with ${vector.length} dimensions`);
      console.log(`[searchLanceDB] Extracted ${keywords.length} keywords: ${keywords.join(', ')}`);
    }
    
    // Phase 0A-4: 強化版キーワード抽出（ネガティブワード除去）
    const { enhancedKeywordExtractor } = await import('./enhanced-keyword-extractor');
    const keywordAnalysis = enhancedKeywordExtractor.extractCoreKeywords(params.query, keywords);
    
    const coreKeywords = keywordAnalysis.coreKeywords;
    const priorityKeywords = keywordAnalysis.priorityKeywords;
    
    // 開発環境のみ詳細ログ
    if (process.env.NODE_ENV === 'development') {
      console.log(`[searchLanceDB] Core keywords (negative words removed): ${coreKeywords.join(', ')}`);
      if (keywordAnalysis.removedWords.length > 0) {
        console.log(`[searchLanceDB] Removed negative words: ${keywordAnalysis.removedWords.join(', ')}`);
      }
      console.log(`[searchLanceDB] Priority keywords: ${priorityKeywords.join(', ')}`);
    }
    
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
    
    console.log('[Stage 2] ハイブリッド検索開始...\n');

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
    
    console.log('[searchLanceDB] Using labelFilters:', labelFilters);
    console.log('[searchLanceDB] Excluding labels:', excludeLabels);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Phase 5: ベクトル検索とBM25検索の並列実行（品質影響なし）
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('[Phase 5] 🚀 並列検索開始: ベクトル検索 + BM25検索\n');
    const parallelSearchStart = Date.now();
    
    // Promise.allSettledで並列実行（一方が失敗しても継続）
    const [vectorSearchResult, bm25SearchResult] = await Promise.allSettled([
      executeVectorSearch(tbl, vector, params, finalKeywords, excludeLabels, topK),
      executeBM25Search(tbl, params, finalKeywords, topK)
    ]);
    
    // 結果を取得（失敗時は空配列）
    vectorResults = vectorSearchResult.status === 'fulfilled' ? vectorSearchResult.value : [];
    bm25Results = bm25SearchResult.status === 'fulfilled' ? bm25SearchResult.value : [];
    
    const parallelSearchTime = Date.now() - parallelSearchStart;
    
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
      
      if (titleMatchedResults.length > 0) {
        console.log(`\n[Phase 4] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`[Phase 4] KG拡張開始: ${titleMatchedResults.length}件のタイトルマッチ結果`);
        
        // Phase 7最適化: KG拡張を無効化（9.2秒→0秒で大幅高速化）
        // KG拡張は高コスト・低効果のため一時的に無効化
        console.log(`[Phase 7 KG Optimization] KG拡張を無効化（パフォーマンス最適化）`);
        console.log(`[Phase 7 KG Optimization] 期待効果: 検索時間 -9.2秒（約50%改善）`);
        
        console.log(`[Phase 4] KG拡張スキップ: 0件追加（合計: ${vectorResults.length}件）`);
        console.log(`[Phase 4] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      } else {
        console.log(`[Phase 4] タイトルマッチ結果なし - KG拡張をスキップ`);
      }
      
      // 結果数を制限（Phase 4調整: BM25結果とマージするため多めに保持）
      vectorResults = vectorResults.slice(0, topK * 5); // 10倍 → 50件（BM25マージ前）
      console.log(`[searchLanceDB] Vector search results after KG: ${vectorResults.length}`);
    } catch (err) {
      console.error(`[searchLanceDB] KG expansion error: ${err}`);
      // エラー時もベクトル検索結果は保持
    }

    // 1.5 フォールバック: ベクトル検索が0件でフィルタがある場合、フィルタのみで取得
    if (vectorResults.length === 0 && params.filter) {
      try {
        console.log('[searchLanceDB] Fallback to filter-only query due to 0 vector results');
        const filterOnlyResults = await tbl.query().where(params.filter).limit(topK).toArray();
        // ベクトル距離がないため、ダミーの距離を設定
        vectorResults = filterOnlyResults.map(r => ({ ...r, _distance: 1.0, _sourceType: 'filter' }));
        console.log(`[searchLanceDB] Filter-only query found ${vectorResults.length} results`);
      } catch (fallbackErr) {
        console.error('[searchLanceDB] Filter-only query error:', fallbackErr);
      }
    }

    // 1.6 フォールバック: pageIdフィルタがある場合、フォールバック取得を試行
    if (vectorResults.length === 0 && params.filter && params.filter.includes('pageId')) {
      try {
        console.log('[searchLanceDB] Attempting fallback pageId retrieval');
        const pageIdMatch = params.filter.match(/pageId.*?(\d+)/);
        if (pageIdMatch) {
          const pageId = parseInt(pageIdMatch[1]);
          console.log(`[searchLanceDB] Extracted pageId: ${pageId}`);
          
          // フォールバック取得を試行
          const fallbackResults = await getRowsByPageId(tbl, pageId);
          if (fallbackResults.length > 0) {
            console.log(`[searchLanceDB] Fallback pageId retrieval found ${fallbackResults.length} results`);
            vectorResults = fallbackResults.map(r => ({ ...r, _distance: 0.5, _sourceType: 'fallback' }));
          } else {
            // URL LIKE フォールバックを試行
            const urlFallbackResults = await getRowsByPageIdViaUrl(tbl, pageId);
            if (urlFallbackResults.length > 0) {
              console.log(`[searchLanceDB] URL fallback retrieval found ${urlFallbackResults.length} results`);
              vectorResults = urlFallbackResults.map(r => ({ ...r, _distance: 0.6, _sourceType: 'url-fallback' }));
            }
          }
        }
      } catch (fallbackErr) {
        console.error('[searchLanceDB] Fallback pageId retrieval error:', fallbackErr);
      }
    }
    
    // 1.7 タイトル厳格一致候補の合流（Phase 4強化: 自動生成）
    try {
      // ユーザー指定のタイトル候補
      let titles = (params.exactTitleCandidates || []).filter(Boolean);
      
      // Phase 4: キーワードから自動的にタイトル候補を生成
      const autoGeneratedTitles = generateTitleCandidates(finalKeywords);
      titles = [...titles, ...autoGeneratedTitles];
      
      if (titles.length > 0) {
        console.log(`[searchLanceDB] Exact title candidates (${titles.length}): ${titles.slice(0, 5).join(', ')}...`);
        const added: any[] = [];
        for (const t of titles) {
          try {
            // 部分一致で拾い上げ（完全一致に限定しない）
            const like = `%${t.replace(/'/g, "''")}%`;
            const exactRows = await tbl.query().where(`title LIKE '${like}'`).limit(20).toArray();
            for (const row of exactRows) {
              // 既存に同一idが無ければ合流
              if (!vectorResults.some(r => r.id === row.id)) {
                added.push({ ...row, _distance: 0.2, _sourceType: 'title-exact' });
              }
            }
          } catch (e) {
            console.warn('[searchLanceDB] Exact title query failed for', t, e);
          }
        }
        if (added.length > 0) {
          console.log(`[searchLanceDB] Added ${added.length} exact-title rows to candidates (救済検索)`);
          vectorResults = vectorResults.concat(added);
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
        const title = originalResult.title || '';
        const content = originalResult.content || '';
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
        resultWithScore._sourceType = keywordScore > 0 ? 'hybrid' : 'vector';
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
              
              const keywordScoreResult = calculateKeywordScore(
                String(row.title || ''),
                String(row.content || ''),
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
      // RRF融合（vector距離順位 + keyword順位 + 厳格タイトル順位 + BM25順位）
      const kRrf = 60;
      const byVector = [...resultsWithHybridScore].sort((a, b) => (a._distance ?? 1) - (b._distance ?? 1));
      const byKeyword = [...resultsWithHybridScore].sort((a, b) => (b._keywordScore ?? 0) - (a._keywordScore ?? 0));
      const byTitleExact = resultsWithHybridScore.filter(r => r._sourceType === 'title-exact');
      const byBm25 = resultsWithHybridScore.filter(r => r._sourceType === 'bm25');

      const vecRank = new Map<string, number>();
      const kwRank = new Map<string, number>();
      const titleRank = new Map<string, number>();
      const bm25Rank = new Map<string, number>();
      byVector.forEach((r, idx) => vecRank.set(r.id, idx + 1));
      byKeyword.forEach((r, idx) => kwRank.set(r.id, idx + 1));
      byTitleExact.forEach((r, idx) => titleRank.set(r.id, idx + 1));
      byBm25.forEach((r, idx) => bm25Rank.set(r.id, idx + 1));

      for (const r of resultsWithHybridScore) {
        const vr = vecRank.get(r.id) ?? 1000000;
        const kr = kwRank.get(r.id) ?? 1000000;
        const tr = titleRank.get(r.id); // 厳格タイトルはある場合のみ加点
        const br = bm25Rank.get(r.id);
        // 重み: vector=1.0, keyword=0.8, title-exact=1.2, bm25=0.6（キーワードマッチングを重視）
        let rrf = (1.0 / (kRrf + vr)) + 0.8 * (1 / (kRrf + kr)) + (tr ? 1.2 * (1 / (kRrf + tr)) : 0) + (br ? 0.6 * (1 / (kRrf + br)) : 0);
        // Phase 5改善: ドメイン減衰・ブースト適用（クエリ関連のみ）
        try {
          const titleStr = String(r.title || '').toLowerCase();
          const labelsArr: string[] = getLabelsAsArray(r.labels);
          const lowerLabels = labelsArr.map((x) => String(x).toLowerCase());
          const penaltyTerms = labelManager.getPenaltyTerms();
          const hasPenalty = penaltyTerms.some(t => titleStr.includes(t)) || lowerLabels.some(l => penaltyTerms.some(t => l.includes(t)));
          const isGenericDoc = GENERIC_DOCUMENT_TERMS.some(t => titleStr.includes(t.toLowerCase()));
          
          // 減衰適用（強化版）
          if (hasPenalty) rrf *= 0.9; // 議事録など
          if (isGenericDoc) rrf *= 0.5; // 0.8 → 0.5に強化（汎用文書を大幅減衰）
          if (String(r.title || '').includes('本システム外')) rrf *= 0.8;
          
          // Phase 5改善: クエリとタイトルの両方に含まれるドメイン固有キーワードのみをブースト
          if (!isGenericDoc) {
            const matchingKeywordCount = CommonTermsHelper.countMatchingDomainKeywords(params.query, String(r.title || ''));
            
            if (matchingKeywordCount > 0) {
              // マッチしたキーワード数に応じてブースト（最大2倍）
              const boostFactor = 1.0 + (matchingKeywordCount * 0.5);
              rrf *= Math.min(boostFactor, 2.0);
            }
          }
        } catch {}

        r._rrfScore = rrf;
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
        
        // 上位50件のみComposite Scoringを実行（-67%計算量削減）
        const TOP_N_FOR_COMPOSITE = 50;
        const top50 = rrfSorted.slice(0, TOP_N_FOR_COMPOSITE);
        const remaining = rrfSorted.slice(TOP_N_FOR_COMPOSITE);
        
        console.log(`[Phase 6 Optimization] Applying composite scoring to top ${top50.length} results only`);
        
        // Phase 5改善: クエリを渡してクエリ関連ブーストを有効化
        const scored50 = compositeScoringService.scoreAndRankResults(top50, finalKeywords, params.query);
        
        // 残りは簡易スコア（RRFスコアを50%に減衰して維持）
        const remainingWithSimpleScore = remaining.map(r => ({
          ...r,
          _compositeScore: (r._rrfScore || 0) * 0.5,  // 簡易スコア
          _scoreBreakdown: null,  // 簡易版のため詳細なし
          _scoringType: 'simple-rrf'  // デバッグ用
        }));
        
        // マージして最終ソート
        vectorResults = [...scored50, ...remainingWithSimpleScore]
          .sort((a, b) => (b._compositeScore || 0) - (a._compositeScore || 0));
        
        const compositeScoringTime = Date.now() - compositeScoringStart;
        
        console.log(`[Phase 6 Optimization] Composite scoring completed in ${compositeScoringTime}ms`);
        console.log(`[Phase 6 Optimization]   - Detailed scoring: ${scored50.length} results`);
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
    
    console.log(`[searchLanceDB] Combined results: ${vectorResults.length} total`);
    
    // 複合スコアでソート済みなので、上位を取得
    // Phase 4最適化: 結果数制限を緩和（topK * 3）
    // 理由: 重複排除とフィルタリング後に十分な結果を確保
    let finalResults = combinedResults.slice(0, topK * 3);
    
    // ラベルフィルタリングは既にベクトル・BM25で実行済みのため削除（重複処理の排除）
    // 最終的なフィルタリングは不要（パフォーマンス最適化）
    
    console.log(`[searchLanceDB] Returning top ${finalResults.length} results based on hybrid score`);
    
    // 結果を整形（統一サービスを使用）
    console.log(`[searchLanceDB] Final results before formatting:`);
    finalResults.forEach((result, idx) => {
      console.log(`[searchLanceDB] Result ${idx+1}: title=${result.title}, _sourceType=${result._sourceType}`);
    });
    
    // Phase 0A-1.5: ページ単位の重複排除
    // ★★★ MIGRATION: 非同期対応 ★★★
    const deduplicated = await deduplicateByPageId(finalResults);
    
    // Phase 0A-1.5: 空ページフィルター（コンテンツ長ベース、StructuredLabel不要）
    const contentFiltered = filterInvalidPagesByContent(deduplicated);
    
    // Phase 0A-4: 議事録フィルター（StructuredLabelベース）
    // structured_category = 'meeting' のページを除外
    const includeMeetingNotes = labelFilters?.includeMeetingNotes ?? false;
    const filtered = filterMeetingNotesByCategory(contentFiltered, includeMeetingNotes);
    
    // 統一検索結果処理サービスを使用して結果を処理（RRF無効化で高速化）
    const processedResults = unifiedSearchResultProcessor.processSearchResults(filtered, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: false  // RRF無効化で高速化
    });
    
    // 結果をキャッシュに保存
    cacheInstance.set(cacheKey, processedResults);
    
    // 総計時間の計測
    const searchFunctionDuration = Date.now() - searchFunctionStartTime;
    
    // 10秒以上かかった場合のみログ（パフォーマンス問題の検知）
    if (searchFunctionDuration > 10000) {
      console.warn(`⚠️ [searchLanceDB] Slow search: ${searchFunctionDuration}ms (${(searchFunctionDuration / 1000).toFixed(2)}s) for query: "${params.query}"`);
    }
    
    // 開発環境のみ詳細ログ
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n========================================`);
      console.log(`📊 [searchLanceDB] Total search completed`);
      console.log(`⏱️ Total duration: ${searchFunctionDuration}ms (${(searchFunctionDuration / 1000).toFixed(2)}s)`);
      console.log(`✅ Returned ${processedResults.length} results`);
      console.log(`========================================\n`);
      
      // 検索ログをファイルに保存
      try {
        searchLogger.saveSearchLog(params.query, processedResults);
      } catch (logError) {
        console.warn('[searchLanceDB] Failed to save search log:', logError);
      }
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
  const meetingPatterns = [
    /ミーティング議事録/i,
    /会議議事録/i,
    /^\d{4}-\d{2}-\d{2}\s+(ミーティング|会議|打ち合わせ)/i, // "2023-01-18 ミーティング"
    /MTG議事録/i,
    /meeting\s*notes?/i,
  ];
  
  const validResults = [];
  let filteredByCategory = 0;
  let filteredByTitle = 0;
  
  for (const result of results) {
    const title = result.title || '';
    const category = result.structured_category || (result as any).category;
    
    // 方法1: structured_categoryで判定
    if (category === 'meeting') {
      filteredByCategory++;
      if (filteredByCategory + filteredByTitle <= 5) { // 最初の5件のみログ出力
        console.log(`[MeetingNoteFilter] Excluded: ${title} (category: meeting)`);
      }
      continue;
    }
    
    // 方法2: structured_categoryがnullの場合、タイトルパターンで判定
    if (!category || category === 'null') {
      const isMeetingNote = meetingPatterns.some(pattern => pattern.test(title));
      
      if (isMeetingNote) {
        filteredByTitle++;
        if (filteredByCategory + filteredByTitle <= 5) { // 最初の5件のみログ出力
          console.log(`[MeetingNoteFilter] Excluded: ${title} (title pattern match)`);
        }
        continue;
      }
    }
    
    validResults.push(result);
  }
  
  const totalFiltered = filteredByCategory + filteredByTitle;
  if (totalFiltered > 0) {
    console.log(`[MeetingNoteFilter] Filtered: ${results.length} → ${validResults.length} results (removed ${totalFiltered} meeting notes: ${filteredByCategory} by category, ${filteredByTitle} by title)`);
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
    
    let vectorQuery = tbl.search(vector);
    if (params.filter) {
      vectorQuery = vectorQuery.where(params.filter);
    }
    
    let vectorResults = await vectorQuery.limit(topK * 10).toArray();
    const vectorSearchDuration = Date.now() - vectorSearchStart;
    
    console.log(`[PERF] 🔍 Vector search completed in ${vectorSearchDuration}ms`);
    console.log(`[Vector Search] Found ${vectorResults.length} results`);
    
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
    vectorResults = vectorResults.map(result => {
      const { matchedKeywords, titleMatchRatio } = calculateTitleMatch(result.title, finalKeywords);
      
      // page_idを確実に保持（getPageIdFromRecordを使用）
      const pageId = getPageIdFromRecord(result);
      const page_id = result.page_id ?? pageId;
      
      if (matchedKeywords.length > 0) {
        let boostFactor = 1.0;
        if (titleMatchRatio >= 0.66) {
          boostFactor = 10.0;
        } else if (titleMatchRatio >= 0.33) {
          boostFactor = 5.0;
        }
        
        return { 
          ...result, 
          page_id: page_id, // ★★★ MIGRATION: page_idを確実に保持 ★★★
          _distance: result._distance * (1 / boostFactor), 
          _titleBoosted: true,
          _titleMatchedKeywords: matchedKeywords.length,
          _titleMatchRatio: titleMatchRatio
        };
      }
      // マッチしない場合もpage_idを保持
      return {
        ...result,
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
  topK: number
): Promise<any[]> {
  const bm25SearchStart = Date.now();
  try {
    // Phase 6修正: lunrSearchClientの状態を直接チェック（lunrInitializerの間接チェックは信頼性が低い）
    if (!params.useLunrIndex || !lunrSearchClient.isReady()) {
      console.log(`[BM25 Search] Lunr not ready (lunrSearchClient.isReady()=${lunrSearchClient.isReady()}), skipping`);
      return [];
    }
    
    const kwCap = Math.max(100, Math.floor(topK * 2));
    const searchKeywords = finalKeywords.slice(0, 5);
    
    console.log(`[BM25 Search] Starting search for keywords: ${searchKeywords.join(', ')}`);
    
    const allLunrResults: any[] = [];
    const processedIds = new Set<string>();
    
    for (const keyword of searchKeywords) {
      const tokenizedQuery = await tokenizeJapaneseText(keyword);
      console.log(`[BM25 Search] Searching '${keyword}' -> '${tokenizedQuery}'`);
      
      const keywordResults = await lunrSearchClient.searchCandidates(tokenizedQuery, kwCap);
      console.log(`[BM25 Search] Found ${keywordResults.length} results`);
      
      for (const result of keywordResults) {
        if (!processedIds.has(result.id)) {
          allLunrResults.push(result);
          processedIds.add(result.id);
        }
      }
    }
    
    console.log(`[BM25 Search] Total unique results: ${allLunrResults.length}`);
    
    // タイトルブースト適用
    // ★★★ MIGRATION: pageId取得を両方のフィールド名に対応 ★★★
    const { getPageIdFromRecord } = await import('./pageid-migration-helper');
    const bm25Results = allLunrResults.map((r: any) => {
      const { matchedKeywords, titleMatchRatio } = calculateTitleMatch(r.title, finalKeywords);
      
      let boostedScore = r.score || 1.0;
      if (titleMatchRatio >= 0.66) {
        boostedScore *= 5.0;
      } else if (titleMatchRatio >= 0.33) {
        boostedScore *= 3.0;
      }
      
      const pageId = getPageIdFromRecord(r) || r.pageId;
      const page_id = r.page_id ?? pageId; // ★★★ MIGRATION: page_idを確実に保持 ★★★
      return {
        id: r.id,
        title: r.title,
        content: r.content,
        labels: r.labels,
        pageId: pageId,
        page_id: page_id, // ★★★ MIGRATION: page_idを確実に保持 ★★★
        isChunked: r.isChunked,
        url: r.url,
        space_key: r.space_key,
        lastUpdated: r.lastUpdated,
        _bm25Score: boostedScore,
        _titleMatchRatio: titleMatchRatio,
        _titleMatchedKeywords: matchedKeywords.length
      };
    });
    
    const bm25SearchDuration = Date.now() - bm25SearchStart;
    console.log(`[PERF] 📝 BM25 search completed in ${bm25SearchDuration}ms`);
    console.log(`[BM25 Search] Completed with ${bm25Results.length} results`);
    
    if (bm25SearchDuration > 5000) {
      console.warn(`⚠️ [PERF] Slow BM25 search detected: ${bm25SearchDuration}ms`);
    }
    
    return bm25Results;
    
  } catch (error) {
    const bm25SearchDuration = Date.now() - bm25SearchStart;
    console.error(`[BM25 Search] Error after ${bm25SearchDuration}ms:`, error);
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
  const titleLower = String(title || '').toLowerCase();
  const matchedKeywords = keywords.filter(kw => titleLower.includes(kw.toLowerCase()));
  
  // 基本マッチ比率
  let titleMatchRatio = keywords.length > 0 ? matchedKeywords.length / keywords.length : 0;
  
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

/**
 * LanceDBからpageIdでページを取得
 * 
 * 注意: LanceDBのSQL方言ではフィールド名をバッククォート（`）で囲む必要があります
 * ダブルクォート（"）では動作しません
 * 
 * @param tbl LanceDBテーブル
 * @param pageId ページID（string型: "718373062"）
 * @returns ページデータまたはnull
 */
async function fetchPageFromLanceDB(tbl: any, pageId: string): Promise<any | null> {
  try {
    if (!pageId || pageId === 'undefined') {
      console.error(`[fetchPageFromLanceDB] Invalid pageId: ${pageId}`);
      return null;
    }
    
    // バッククォートを使用してフィールド名を囲む（LanceDB SQL方言）
    // ★★★ MIGRATION: pageId → page_id (スカラーインデックス対応) ★★★
    const results = await tbl.query()
      .where(`\`page_id\` = '${pageId}'`)
      .limit(1)
      .toArray();
    
    if (results.length > 0) {
      // ★★★ MIGRATION: データベースのpage_idをpageIdに変換（API互換性） ★★★
      const { mapLanceDBRecordToAPI } = await import('./pageid-migration-helper');
      const mappedResult = mapLanceDBRecordToAPI(results[0]);
      console.log(`[fetchPageFromLanceDB] Found page ${pageId}: ${mappedResult.title}`);
      return mappedResult;
    }
    
    console.log(`[fetchPageFromLanceDB] Page ${pageId} not found in LanceDB`);
    return null;
  } catch (error) {
    console.error(`[fetchPageFromLanceDB] Error fetching page ${pageId}:`, error);
    return null;
  }
}

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
