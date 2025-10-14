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
import { GenericCache } from './generic-cache';

// 検索結果キャッシュ（グローバルに保持してHMRの影響を回避）
const getSearchCache = () => {
  if (!globalThis.__searchCache) {
    globalThis.__searchCache = new GenericCache<any[]>({
      ttl: 5 * 60 * 1000, // 5分間
      maxSize: 1000,
      evictionStrategy: 'lru'
    });
    console.log('🔧 検索キャッシュを初期化しました');
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
    // labelFiltersがundefinedの場合は明示的にnullとして区別する
    labelFilters: params.labelFilters !== undefined ? params.labelFilters : null
  });
  // labelFiltersの違いを確実に識別するため、MD5ハッシュを使用
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(paramString).digest('hex').slice(0, 16);
  return `${normalizedQuery}_${hash}`;
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
  pageId?: number; // LanceDB行に含まれる場合があるため追加
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
  try {
    console.log(`\n========================================`);
    console.log(`🔍 [searchLanceDB] 検索開始`);
    console.log(`Query: "${params.query}"`);
    console.log(`========================================\n`);
    
    // キャッシュインスタンスの存在確認
    const cacheInstance = getSearchCache();
    console.log(`🔧 searchCache.size: ${cacheInstance?.size ?? 'N/A'}`);
    console.log(`🔧 globalThis.__searchCache: ${globalThis.__searchCache ? '存在' : '未定義'}`);
    
    // キャッシュキーを生成
    const cacheKey = generateCacheKey(params.query, params);
    console.log(`🔑 キャッシュキー生成: "${cacheKey}"`);
    console.log(`📦 現在のキャッシュサイズ: ${cacheInstance.size}`);
    
    // キャッシュから取得を試行
    const cachedResults = cacheInstance.get(cacheKey);
    console.log(`🔍 キャッシュチェック結果: ${cachedResults ? 'ヒット' : 'ミス'}`);
    
    if (cachedResults) {
      console.log(`🚀 キャッシュから結果を返却: ${cachedResults.length}件`);
      console.log(`========================================\n`);
      return cachedResults;
    }
    
    console.log(`🔍 キャッシュミス: "${params.query}" - 検索を実行します`);
    
    // 最適化されたLunr初期化を使用（重複初期化を防止）
    try {
      const { optimizedLunrInitializer } = await import('./optimized-lunr-initializer');
      await optimizedLunrInitializer.initializeOnce();
      console.log('✅ Optimized Lunr initialization completed in searchLanceDB');
    } catch (error) {
      console.warn('⚠️ Optimized Lunr initialization failed in searchLanceDB:', error);
      // 初期化に失敗しても検索は継続（フォールバック検索を使用）
    }
    
    // デフォルト値の設定
    const topK = params.topK || 5;
    const tableName = params.tableName || 'confluence';
    const titleWeight = params.titleWeight || 1.0; // デフォルトのタイトル重み
    
    // 並列実行でパフォーマンス最適化（最適化されたLanceDB接続を使用）
    const [vector, keywords, connection] = await Promise.all([
      getEmbeddings(params.query),
      (async () => {
        return await unifiedKeywordExtractionService.extractKeywordsConfigured(params.query);
      })(),
      (async () => {
        const { optimizedLanceDBClient } = await import('./optimized-lancedb-client');
        return await optimizedLanceDBClient.getConnection();
      })()
    ]);
    
    console.log(`[searchLanceDB] Generated embedding vector with ${vector.length} dimensions`);
    console.log(`[searchLanceDB] Extracted ${keywords.length} keywords: ${keywords.join(', ')}`);
    
    // キーワードの優先度を設定（Setオブジェクトとして）
    const highPriority = new Set(keywords.slice(0, 3)); // 上位3つのキーワードを高優先度
    const lowPriority = new Set(keywords.slice(3)); // 残りを低優先度
    
    // テーブルを取得
    const tbl = connection.table;
    console.log(`[searchLanceDB] Using table '${connection.tableName}'`);

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
    // params.labelFiltersがundefinedの場合はフィルタなし（全て許可）
    const labelFilters = params.labelFilters !== undefined 
      ? params.labelFilters 
      : { includeMeetingNotes: true, excludeArchived: false, excludeTemplates: false, excludeGeneric: false };
    const excludeLabels = labelManager.buildExcludeLabels(labelFilters);
    
    console.log('[searchLanceDB] Using labelFilters:', labelFilters);
    console.log('[searchLanceDB] Excluding labels:', excludeLabels);

    // 1. ベクトル検索の実行
    try {
      let vectorQuery = tbl.search(vector);
      if (params.filter) {
        vectorQuery = vectorQuery.where(params.filter);
      }
      // ベクトル検索: 十分な結果を取得（50件でテスト）
      vectorResults = await vectorQuery.limit(50).toArray();
      console.log(`[searchLanceDB] Vector search found ${vectorResults.length} results before filtering`);
      
    // 距離閾値でフィルタリング（ベクトル検索の有効化）
    const distanceThreshold = params.maxDistance || 2.0; // 検索品質を元に戻す: 網羅性を重視
    const qualityThreshold = params.qualityThreshold || 0.0; // 最適化: 0.1 -> 0.0 (品質閾値を無効化)
    
    console.log(`[searchLanceDB] Using distance threshold: ${distanceThreshold}, quality threshold: ${qualityThreshold}`);
      
      if (distanceThreshold < 2.0) {
        const beforeCount = vectorResults.length;
        vectorResults = vectorResults.filter(result => {
          const distance = result._distance || 0;
          return distance <= distanceThreshold;
        });
        console.log(`[searchLanceDB] Applied distance threshold ${distanceThreshold}: ${beforeCount} -> ${vectorResults.length} results`);
      }
      
      // 品質閾値でフィルタリング（高品質結果のみ）
      if (qualityThreshold < distanceThreshold) {
        const beforeCount = vectorResults.length;
        vectorResults = vectorResults.filter(result => {
          const distance = result._distance || 0;
          return distance >= qualityThreshold;
        });
        console.log(`[searchLanceDB] Applied quality threshold ${qualityThreshold}: ${beforeCount} -> ${vectorResults.length} results`);
      }
      
      // ラベルフィルタリングを適用（処理速度向上）
      if (excludeLabels.length > 0) {
        const beforeCount = vectorResults.length;
        vectorResults = vectorResults.filter(result => {
          if (labelManager.isExcluded(result.labels, excludeLabels)) {
            console.log(`[searchLanceDB] Excluded result due to label filter: ${result.title}`);
            return false;
          }
          return true;
        });
        console.log(`[searchLanceDB] Excluded ${beforeCount - vectorResults.length} results due to label filtering`);
      }
      
      
      // タイトル重みを適用（ベクトル検索結果の調整）
      if (titleWeight !== 1.0) {
        console.log(`[searchLanceDB] Applying title weight: ${titleWeight}`);
        vectorResults = vectorResults.map(result => {
          const title = String(result.title || '').toLowerCase();
          const query = params.query.toLowerCase();
          
          // タイトルにクエリが含まれている場合、距離を調整
          if (title.includes(query)) {
            const adjustedDistance = result._distance * (1 / titleWeight);
            return { ...result, _distance: adjustedDistance, _titleBoosted: true };
          }
          return result;
        });
        console.log(`[searchLanceDB] Applied title weight to ${vectorResults.filter(r => r._titleBoosted).length} results`);
      }
      
      // 結果数を制限
      vectorResults = vectorResults.slice(0, topK);
      console.log(`[searchLanceDB] Vector search found ${vectorResults.length} results after filtering`);
    } catch (err) {
      console.error(`[searchLanceDB] Vector search error: ${err}`);
      vectorResults = [];
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
    
    // 1.7 タイトル厳格一致候補の合流
    try {
      const titles = (params.exactTitleCandidates || []).filter(Boolean);
      if (titles.length > 0) {
        console.log('[searchLanceDB] Exact title candidates:', titles);
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
          console.log(`[searchLanceDB] Added ${added.length} exact-title rows to candidates`);
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
        
        // デバッグ情報を出力
        console.log(`[searchLanceDB] Processing result ${i+1}:`);
        console.log(`  Title: ${title}`);
        console.log(`  Labels: ${JSON.stringify(labels)}`);
        console.log(`  Content snippet: ${content.substring(0, 50)}...`);
        
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
        
        console.log(`  Score details: keyword=${keywordScore}, title=${titleMatches}, label=${labelMatches}, content=${contentMatches}, labelScore=0`);
        
        // キーワードマッチがある場合はカウント
        if (keywordScore > 0) {
          keywordMatchCount++;
        }
        
        // ベクトル距離、キーワードスコア、ラベルスコアを組み合わせた複合スコア
        const hybridScore = calculateHybridScore(resultWithScore._distance, keywordScore, labelMatches);
        console.log(`  Hybrid score: ${hybridScore} (vector: ${resultWithScore._distance}, keyword: ${keywordScore}, label: ${labelMatches})`);
        
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
      // 簡易BM25: タイトルに対してBM25風スコアを計算し、候補に合流
      try {
        const core = keywords[0];
        if (core) {
          const kwCap = 50; // 50件でテスト
          
          // 複数のキーワードでBM25検索を実行
          const searchKeywords = keywords.slice(0, 5); // 上位5つのキーワードを使用（拡張）
          
          // クエリ依存のキーワード注入は行わない（汎用ルールに統一）
          
          console.log(`[searchLanceDB] BM25 search keywords: ${searchKeywords.join(', ')}`);
          
          // Use Lunr inverted index if available, otherwise fall back to LIKE search
          if (params.useLunrIndex && lunrInitializer.isReady()) {
            try {
              // 検索キーワードも分かち書きに変換
              const tokenizedQuery = await tokenizeJapaneseText(core);
              console.log(`[searchLanceDB] Using Lunr inverted index for BM25 candidates: '${core}' -> '${tokenizedQuery}'`);
              const lunrResults = await lunrSearchClient.searchCandidates(tokenizedQuery, kwCap);
              
              // Use Lunr's native BM25 scores (no manual calculation needed)
              bm25Results = lunrResults.map((r: any) => ({
                id: r.id,
                title: r.title,
                content: r.content,
                labels: r.labels,
                pageId: r.pageId,
                url: r.url,
                space_key: r.space_key,
                lastUpdated: r.lastUpdated,
                _bm25Score: r.score || 1.0 // Use Lunr's native score, fallback to 1.0
              }));
              console.log(`[searchLanceDB] Added ${bm25Results.length} BM25 rows via Lunr for core='${core}' (using native scores)`);
            } catch (error) {
              console.warn(`[searchLanceDB] Lunr search failed, falling back to LIKE search:`, error);
              // Fall back to LIKE search
              const esc = core.replace(/'/g, "''");
              const rows = await tbl.query().where(`title LIKE '%${esc}%'`).limit(kwCap).toArray();
              const totalDocs = 100000; // Fallback constant
              const df = Math.max(1, rows.length);
              const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
              const k1 = 1.2;
              const b = 0.75;
              const avgdl = 12;
              bm25Results = rows.map((r: any) => {
                const title = String(r.title || '');
                const dl = Math.max(1, Array.from(title).length / 2);
                const tf = (title.match(new RegExp(esc, 'g')) || []).length || 1;
                const score = idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgdl))));
                return { 
                  ...r, 
                  url: r.url,
                  space_key: r.space_key,
                  lastUpdated: r.lastUpdated,
                  _bm25Score: score 
                };
              });
              console.log(`[searchLanceDB] Added ${bm25Results.length} BM25 rows via LIKE fallback for core='${core}' (idf=${idf.toFixed(3)})`);
            }
          } else {
        // 複数キーワードでLIKE検索を実行（タイトル+本文）
        const allRows = new Map<string, any>();
        const collect = async (whereExpr: string) => {
          const rows = await tbl.query().where(whereExpr).limit(kwCap).toArray();
          for (const row of rows) {
            const key = row.id;
            if (!allRows.has(key)) {
              allRows.set(key, row);
            }
          }
        };

        for (const keyword of searchKeywords) {
          const esc = keyword.replace(/'/g, "''");
          // タイトル
          await collect(`title LIKE '%${esc}%'`);
          // 本文
          await collect(`content LIKE '%${esc}%'`);
        }
            
            const rows = Array.from(allRows.values());
            const totalDocs = 100000; // LanceDB Tableにcount APIがないため近似定数
            
        // 各キーワードのIDFを計算（単純化したdf推定）
            const keywordScores = new Map<string, number>();
            for (const keyword of searchKeywords) {
          const esc = keyword;
          const matchingRows = rows.filter(r =>
            String(r.title || '').includes(esc) || String(r.content || '').includes(esc)
          );
              const df = Math.max(1, matchingRows.length);
              const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
              keywordScores.set(keyword, idf);
            }
            
            const k1 = 1.2;
            const b = 0.75;
        const avgTitleLen = 12; // タイトルの平均語長の近似
        const avgBodyLen = 800; // 本文の平均語長の近似（ざっくり）
        const TITLE_WEIGHT = 1.0;
        const BODY_WEIGHT = 0.6;
            
        bm25Results = rows.map((r: any) => {
              const title = String(r.title || '');
          const content = String(r.content || '');
          const titleLen = Math.max(1, Array.from(title).length / 2);
          const bodyLen = Math.max(1, Math.min(5000, Array.from(content).length) / 2);
          let totalScore = 0;
              
              for (const keyword of searchKeywords) {
            const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const tfTitle = (title.match(new RegExp(safe, 'g')) || []).length;
            const tfBody = (content.match(new RegExp(safe, 'g')) || []).length;
            const idf = keywordScores.get(keyword) || 1;

            if (tfTitle > 0) {
              const scoreT = idf * ((tfTitle * (k1 + 1)) / (tfTitle + k1 * (1 - b + b * (titleLen / avgTitleLen))));
              totalScore += TITLE_WEIGHT * scoreT;
            }
            if (tfBody > 0) {
              const scoreB = idf * ((tfBody * (k1 + 1)) / (tfBody + k1 * (1 - b + b * (bodyLen / avgBodyLen))));
              totalScore += BODY_WEIGHT * scoreB;
            }
              }

          // 改善されたブーストロジック
          const rawQuery = (params.query || '').trim();
          const titleLower = title.toLowerCase();
          
          // 1. フレーズ完全マッチ（最高優先度）
          if (rawQuery) {
            const phrase = rawQuery.replace(/[\s　]+/g, '');
            const titlePlain = title.replace(/[\s　]+/g, '');
            const contentPlain = content.replace(/[\s　]+/g, '');
            const phraseInTitle = titlePlain.includes(phrase);
            const phraseInBody = contentPlain.includes(phrase);
            if (phraseInTitle) totalScore += 5.0; // タイトル完全一致ボーナス（2.0→5.0に強化）
            if (phraseInBody) totalScore += 0.5;  // 本文一致ボーナス
          }
          
          // 2. 複数キーワードのタイトルマッチ（新規追加）
          const keywordsInTitle = searchKeywords.filter(kw => 
            titleLower.includes(kw.toLowerCase())
          );
          if (keywordsInTitle.length >= 2) {
            // 2個以上のキーワードがタイトルに含まれる場合、追加ブースト
            totalScore += keywordsInTitle.length * 2.0;
          }
              
              return { 
                ...r, 
                url: r.url,
                space_key: r.space_key,
                lastUpdated: r.lastUpdated,
                _bm25Score: totalScore 
              };
            });

        // ラベルフィルタリングをBM25結果にも適用
        if (excludeLabels.length > 0) {
          const beforeBm25 = bm25Results.length;
          bm25Results = bm25Results.filter((result: any) => {
            return !labelManager.isExcluded(result.labels, excludeLabels);
          });
          console.log(`[searchLanceDB] Excluded ${beforeBm25 - bm25Results.length} BM25 results due to label filtering`);
        }
        
            
            console.log(`[searchLanceDB] Added ${bm25Results.length} BM25 rows to candidates for keywords=[${searchKeywords.join(', ')}]`);
          }
          let added = 0;
          for (const row of bm25Results) {
            if (!resultsWithHybridScore.some(r => r.id === row.id)) {
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
            }
          }
          console.log(`[searchLanceDB] Added ${added} BM25 rows to candidates for core='${core}'`);
        }
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
        // ドメイン減衰（議事録）：順位の最後で軽く抑制
        try {
          const titleStr = String(r.title || '').toLowerCase();
          const labelsArr: string[] = getLabelsAsArray(r.labels);
          const lowerLabels = labelsArr.map((x) => String(x).toLowerCase());
          const penaltyTerms = labelManager.getPenaltyTerms();
          const genericTitleTerms = ['共通要件','非機能要件','用語','ワード','ディフィニション','definition','ガイドライン','一覧','フロー','要件'];
          const hasPenalty = penaltyTerms.some(t => titleStr.includes(t)) || lowerLabels.some(l => penaltyTerms.some(t => l.includes(t)));
          const isGenericDoc = genericTitleTerms.some(t => titleStr.includes(t));
          if (hasPenalty) rrf *= 0.9; // 既存より強め
          if (isGenericDoc) rrf *= 0.8; // 辞書・総論系をより減衰
          // 「本システム外」を含むタイトルは追加減衰
          if (String(r.title || '').includes('本システム外')) rrf *= 0.8;
        } catch {}

        r._rrfScore = rrf;
      }

      // 同一pageId/titleの重複を1件に正規化（最良スコアを残す）
      const dedupMap = new Map<string, any>();
      for (const r of resultsWithHybridScore) {
        const key = `${r.pageId || ''}::${(r.title || '').toLowerCase()}`;
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
      
    } catch (err) {
      console.error(`[searchLanceDB] Error applying hybrid search: ${err}`);
      console.error(`[searchLanceDB] Error stack: ${err.stack}`);
      // エラー時は何もしない（元のベクトル検索結果をそのまま使用）
    }
    
    // 3. 結果の結合（キーワード検索は無効化されているため、ベクトル検索結果のみ使用）
    const combinedResults = [...vectorResults];
    
    // すでにハイブリッドスコアでソート済みなので、ここではソートしない
    // 上位の結果を取得
    let finalResults = combinedResults.slice(0, topK);
    
    // 最終的なラベルフィルタリングを適用
    if (excludeLabels.length > 0) {
      const beforeFinal = finalResults.length;
      finalResults = finalResults.filter((result: any) => {
        return !labelManager.isExcluded(result.labels, excludeLabels);
      });
      if (beforeFinal !== finalResults.length) {
        console.log(`[searchLanceDB] Excluded ${beforeFinal - finalResults.length} results due to final label filtering`);
      }
    }
    
    console.log(`[searchLanceDB] Returning top ${finalResults.length} results based on hybrid score`);
    
    // 結果を整形（統一サービスを使用）
    console.log(`[searchLanceDB] Final results before formatting:`);
    finalResults.forEach((result, idx) => {
      console.log(`[searchLanceDB] Result ${idx+1}: title=${result.title}, _sourceType=${result._sourceType}`);
    });
    
    // Phase 0A-1.5: ページ単位の重複排除
    const deduplicated = deduplicateByPageId(finalResults);
    
    // Phase 0A-1.5: 空ページフィルター（コンテンツ長ベース、StructuredLabel不要）
    const filtered = filterInvalidPagesByContent(deduplicated);
    
    // Phase 0A-2: StructuredLabelを取得してスコアリングに統合
    const pageIds = filtered
      .filter(r => r.pageId !== undefined && r.pageId !== null)
      .map(r => String(r.pageId));
    
    let structuredLabels = new Map<string, any>();
    if (pageIds.length > 0) {
      try {
        const { getStructuredLabels } = await import('./structured-label-service-admin');
        structuredLabels = await getStructuredLabels(pageIds);
        console.log(`[searchLanceDB] Loaded ${structuredLabels.size} StructuredLabels for scoring`);
      } catch (error) {
        console.warn('[searchLanceDB] Failed to load StructuredLabels for scoring:', error);
      }
    }
    
    // StructuredLabelスコアを各結果に追加
    const { calculateStructuredLabelScore } = await import('./structured-label-scorer');
    for (const result of filtered) {
      const pageId = String(result.pageId || '');
      const label = structuredLabels.get(pageId);
      const labelScore = calculateStructuredLabelScore(params.query, label);
      
      // _labelScoreを上書き（既存のlabelMatchesではなく、StructuredLabelベースのスコア）
      result._labelScore = labelScore;
      result._structuredLabel = label; // デバッグ用
    }
    
    console.log(`[searchLanceDB] Applied StructuredLabel scoring to ${filtered.length} results`);
    
    // 統一検索結果処理サービスを使用して結果を処理（RRF無効化で高速化）
    const processedResults = unifiedSearchResultProcessor.processSearchResults(filtered, {
      vectorWeight: 0.3,      // ベクトルの重みを少し下げる
      keywordWeight: 0.3,     // キーワードの重みを少し下げる
      labelWeight: 0.4,       // StructuredLabelの重みを上げる
      enableRRF: false  // RRF無効化で高速化
    });
    
    console.log(`[searchLanceDB] Processed ${processedResults.length} results using unified service`);
    
    // 結果をキャッシュに保存
    cacheInstance.set(cacheKey, processedResults);
    console.log(`💾 キャッシュ保存: "${cacheKey}" (${processedResults.length}件)`);
    console.log(`📦 キャッシュ保存後のサイズ: ${cacheInstance.size}`);
    console.log(`========================================\n`);
    
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
function deduplicateByPageId(results: any[]): any[] {
  const pageMap = new Map<string, any>();
  
  results.forEach(result => {
    const pageId = String(result.pageId || 'unknown');
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
  });
  
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
