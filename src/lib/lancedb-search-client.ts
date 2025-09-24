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

/**
 * タイトルが除外パターンにマッチするかチェック
 */
function isTitleExcluded(title: string, excludePatterns: string[]): boolean {
  if (!title || !excludePatterns || excludePatterns.length === 0) {
    return false;
  }
  
  return excludePatterns.some(pattern => {
    // パターンが末尾に*がある場合は前方一致
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return title.startsWith(prefix);
    }
    // パターンが先頭に*がある場合は後方一致
    else if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return title.endsWith(suffix);
    }
    // パターンが*で囲まれている場合は部分一致
    else if (pattern.startsWith('*') && pattern.endsWith('*')) {
      const substring = pattern.slice(1, -1);
      return title.includes(substring);
    }
    // 完全一致
    else {
      return title === pattern;
    }
  });
}

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
  excludeTitlePatterns?: string[]; // タイトル除外パターン
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
    console.log(`[searchLanceDB] Starting search with query: "${params.query}"`);
    
    // Lunr Indexの初期化を確実に実行
    try {
      await lunrInitializer.initializeAsync();
      console.log('✅ Lunr Index initialization completed in searchLanceDB');
    } catch (error) {
      console.warn('⚠️ Lunr Index initialization failed in searchLanceDB:', error);
      // 初期化に失敗しても検索は継続（フォールバック検索を使用）
    }
    
    // デフォルト値の設定
    const topK = params.topK || 5;
    const tableName = params.tableName || 'confluence';
    const titleWeight = params.titleWeight || 1.0; // デフォルトのタイトル重み
    
    // 並列実行でパフォーマンス最適化
    const [vector, keywords, connection] = await Promise.all([
      getEmbeddings(params.query),
      (async () => {
        return await unifiedKeywordExtractionService.extractKeywordsConfigured(params.query);
      })(),
      lancedbClient.getConnection()
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
    const labelFilters = params.labelFilters || labelManager.getDefaultFilterOptions();
    const excludeLabels = labelManager.buildExcludeLabels(labelFilters);
    
    // タイトル除外パターンの準備
    const excludeTitlePatterns = params.excludeTitlePatterns || ['xxx_*'];
    
    console.log('[searchLanceDB] Using labelFilters:', labelFilters);
    console.log('[searchLanceDB] Excluding labels:', excludeLabels);
    console.log('[searchLanceDB] Excluding title patterns:', excludeTitlePatterns);

    // 1. ベクトル検索の実行
    try {
      let vectorQuery = tbl.search(vector);
      if (params.filter) {
        vectorQuery = vectorQuery.where(params.filter);
      }
      // 除外される可能性を考慮して多めに取得
      vectorResults = await vectorQuery.limit(topK * 2).toArray();
      console.log(`[searchLanceDB] Vector search found ${vectorResults.length} results before filtering`);
      
    // 距離閾値でフィルタリング（ベクトル検索の有効化）
    const distanceThreshold = params.maxDistance || 2.0; // 最適化: 1.0 -> 2.0 (ベクトル検索を有効化)
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
      
      // タイトル除外フィルタリングを適用
      if (excludeTitlePatterns.length > 0) {
        const beforeCount = vectorResults.length;
        vectorResults = vectorResults.filter(result => {
          if (isTitleExcluded(result.title, excludeTitlePatterns)) {
            console.log(`[searchLanceDB] Excluded result due to title pattern: ${result.title}`);
            return false;
          }
          return true;
        });
        console.log(`[searchLanceDB] Excluded ${beforeCount - vectorResults.length} results due to title pattern filtering`);
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
            const exactRows = await tbl.query().where(`title LIKE '${like}'`).limit(50).toArray();
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

      // 各結果にハイブリッドスコアを追加
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
            console.log('  Excluded due to includeLabels (app-level)');
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
        
        // ベクトル距離、キーワードスコアを組み合わせた複合スコア（ラベルスコアは使用しない）
        const hybridScore = calculateHybridScore(resultWithScore._distance, keywordScore, 0);
        console.log(`  Hybrid score: ${hybridScore} (vector: ${resultWithScore._distance}, keyword: ${keywordScore}, label: 0)`);
        
        // スコア情報を追加
        resultWithScore._keywordScore = keywordScore;
        resultWithScore._labelScore = 0;  // ラベルスコアは使用しない
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
          const kwCap = Math.min(50, Math.max(10, Math.floor(topK / 3)));
          
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
                return { ...r, _bm25Score: score };
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

          // 見出し一致ブースト（汎用）: Markdownや番号付きの見出し行での一致を加点
          try {
            const headingLines = content
              .split(/\n+/)
              .filter((line) => /^(#{1,6}\s|\d+(?:\.\d+)*\s|\[[^\]]+\]\s|■|◇|◆|\*\s|【.+?】)/.test(line.trim()));
            if (headingLines.length > 0) {
              const joinedHeadings = headingLines.join('\n');
              for (const keyword of searchKeywords) {
                const safe = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = new RegExp(safe, 'g');
                const hits = (joinedHeadings.match(re) || []).length;
                if (hits > 0) {
                  totalScore += Math.min(1.0, 0.15 * hits); // 最大+1.0まで
                }
              }
            }
          } catch {}

          // 制約表現検出（汎用）: 否定/制限語や期間表現の共起に微加点
          try {
            const constraintRe = /(不可|できない|できません|禁止|制限|上限|下限|以内|以外|無効|不可視|送信できません|送信不可|拒否)/g;
            const timeRe = /([0-9０-９]{1,4})\s*(日|日間|時間|週|週間|か月|ヶ月)/g;
            const normalizedContent = content.replace(/\s+/g, '');
            const consHits = (normalizedContent.match(constraintRe) || []).length;
            const timeHits = (normalizedContent.match(timeRe) || []).length;
            let cooccur = 0;
            for (const kw of searchKeywords) {
              if (!kw) continue;
              const safe = String(kw).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const win = new RegExp(safe + '.{0,30}(不可|できない|できません|禁止|制限)|' + '(不可|できない|できません|禁止|制限).{0,30}' + safe, 'g');
              cooccur += (content.match(win) || []).length;
            }
            const constraintBoost = Math.min(1.0, consHits * 0.08 + timeHits * 0.05 + cooccur * 0.12);
            totalScore += constraintBoost;
          } catch {}


          // 近接・フレーズブースト（汎用）
          const rawQuery = (params.query || '').trim();
          if (rawQuery) {
            const phrase = rawQuery.replace(/[\s　]+/g, '');
            const titlePlain = title.replace(/[\s　]+/g, '');
            const contentPlain = content.replace(/[\s　]+/g, '');
            const phraseInTitle = titlePlain.includes(phrase);
            const phraseInBody = contentPlain.includes(phrase);
            if (phraseInTitle) totalScore += 1.2; // タイトル一致ボーナス
            if (phraseInBody) totalScore += 0.5;  // 本文一致ボーナス

            // 近接（タイトル内でクエリ語の距離が近い場合の微小加点）
            const terms = searchKeywords.slice(0, 3).filter(Boolean);
            if (terms.length >= 2) {
              const pos = terms.map(t => title.indexOf(t)).filter(p => p >= 0).sort((a,b)=>a-b);
              if (pos.length >= 2) {
                const span = pos[pos.length - 1] - pos[0];
                if (span > 0 && span < 20) {
                  totalScore += 0.3; // 近接ボーナス（小）
                }
              }
            }
          }
              
              return { ...r, _bm25Score: totalScore };
            });

        // ラベルフィルタリングをBM25結果にも適用
        if (excludeLabels.length > 0) {
          const beforeBm25 = bm25Results.length;
          bm25Results = bm25Results.filter((result: any) => {
            return !labelManager.isExcluded(result.labels, excludeLabels);
          });
          console.log(`[searchLanceDB] Excluded ${beforeBm25 - bm25Results.length} BM25 results due to label filtering`);
        }
        
        // タイトル除外フィルタリングをBM25結果にも適用
        if (excludeTitlePatterns.length > 0) {
          const beforeBm25 = bm25Results.length;
          bm25Results = bm25Results.filter((result: any) => {
            return !isTitleExcluded(result.title, excludeTitlePatterns);
          });
          console.log(`[searchLanceDB] Excluded ${beforeBm25 - bm25Results.length} BM25 results due to title pattern filtering`);
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
        // ドメイン減衰（メール/帳票/請求/アーカイブ/議事録）：順位の最後で軽く抑制
        try {
          const titleStr = String(r.title || '').toLowerCase();
          const labelsArr: string[] = getLabelsAsArray(r.labels);
          const lowerLabels = labelsArr.map((x) => String(x).toLowerCase());
          const penaltyTerms = ['メール','mail','通知','テンプレート','template','帳票','請求','アーカイブ','議事録','meeting-notes','ミーティング','meeting','会議','議事','フォルダ'];
          const genericTitleTerms = ['共通要件','非機能要件','用語','ワード','ディフィニション','definition','ガイドライン','一覧','フロー','要件'];
          const hasPenalty = penaltyTerms.some(t => titleStr.includes(t)) || lowerLabels.some(l => penaltyTerms.some(t => l.includes(t)));
          const isGenericDoc = genericTitleTerms.some(t => titleStr.includes(t));
          if (hasPenalty) rrf *= 0.9; // 既存より強め
          if (isGenericDoc) rrf *= 0.8; // 辞書・総論系をより減衰
          // 「本システム外」を含むタイトルは追加減衰
          if (String(r.title || '').includes('本システム外')) rrf *= 0.8;
        } catch {}

        // 制約表現の加点（RRF側）：本文に一般的制約語+時間表現が見られる場合に微加点
        try {
          const content = String(r.content || '');
          const constraintRe = /(不可|できない|できません|禁止|制限|上限|下限|以内|以外|無効|送信できません|送信不可|拒否)/g;
          const timeRe = /([0-9０-９]{1,4})\s*(日|日間|時間|週|週間|か月|ヶ月)/g;
          const cHits = (content.match(constraintRe) || []).length;
          const tHits = (content.match(timeRe) || []).length;
          const add = Math.min(0.02, cHits * 0.003 + tHits * 0.002);
          rrf += add;
        } catch {}
        r._rrfScore = rrf;
      }

      // 合意スコア加点（汎用）: クエリ上位語（keywords）をタイトル/本文に含むドキュメント群の合意度で微加点
      try {
        const topicTerms = keywords.slice(0, 5).filter(Boolean);
        const termToDocCount = new Map<string, number>();
        for (const t of topicTerms) {
          const safe = t.toLowerCase();
          let count = 0;
          for (const r of resultsWithHybridScore) {
            const title = String(r.title || '').toLowerCase();
            const content = String(r.content || '').toLowerCase();
            if (title.includes(safe) || content.includes(safe)) count++;
          }
          termToDocCount.set(t, count);
        }
        for (const r of resultsWithHybridScore) {
          let consensus = 0;
          const title = String(r.title || '').toLowerCase();
          const content = String(r.content || '').toLowerCase();
          for (const t of topicTerms) {
            const safe = t.toLowerCase();
            if (title.includes(safe) || content.includes(safe)) {
              const df = Math.max(0, (termToDocCount.get(t) || 0) - 1); // 自身以外
              if (df > 0) consensus += Math.min(3, df) * 0.003; // 最大 ~0.009
            }
          }
          r._rrfScore = (r._rrfScore ?? 0) + consensus;
        }
      } catch {}

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

      // オプション: Cross-Encoder再ランクの足場（スタブ）
      const useCrossEncoder = String(process.env.USE_CROSS_ENCODER || '').toLowerCase() === 'true';
      if (useCrossEncoder) {
        try {
          const maxReRank = Math.min(30, dedupedResults.length);
          console.log(`[searchLanceDB] Cross-Encoder rerank stub for top ${maxReRank} candidates`);
          for (let i = 0; i < maxReRank; i++) {
            const r = dedupedResults[i];
            // スタブ: タイトルにクエリのcore語が含まれていれば微ブースト、そうでなければ0
            const qCore = (params.query || '').trim();
            const contains = String(r.title || '').includes(qCore);
            r._crossScore = contains ? 0.02 : 0.0; // 後から本実装に置換
          }
          // Cross-Encoderスコアを微加点（RRFに対し追加）
          for (let i = 0; i < dedupedResults.length; i++) {
            const r = dedupedResults[i];
            if (typeof r._crossScore === 'number') {
              r._rrfScore = (r._rrfScore ?? 0) + r._crossScore;
            }
          }
        } catch (e) {
          console.warn('[searchLanceDB] Cross-Encoder rerank stub failed:', e);
        }
      }

      // オプション: MMR多様化（タイトル重複・近似の抑制）
      function titleBigrams(s: string): Set<string> {
        const norm = String(s || '').toLowerCase();
        const chars = Array.from(norm);
        const grams = new Set<string>();
        for (let i = 0; i < chars.length - 1; i++) {
          grams.add(chars[i] + chars[i + 1]);
        }
        return grams;
      }
      function jaccard(a: Set<string>, b: Set<string>): number {
        if (a.size === 0 && b.size === 0) return 0;
        let inter = 0;
        for (const x of a) if (b.has(x)) inter++;
        const union = a.size + b.size - inter;
        return union === 0 ? 0 : inter / union;
      }
      const useMMR = String(process.env.USE_MMR || 'true').toLowerCase() !== 'false';
      let mmrResults = dedupedResults;
      if (useMMR) {
        try {
          const lambda = 0.7; // 関連性重視
          const pool = dedupedResults.slice(0, Math.min(50, dedupedResults.length));
          const selected: any[] = [];
          const precomputed = pool.map(r => ({ r, grams: titleBigrams(r.title) }));
          while (selected.length < Math.min(topK, pool.length)) {
            let bestIdx = -1;
            let bestScore = -Infinity;
            for (let i = 0; i < precomputed.length; i++) {
              const cand = precomputed[i];
              if (!cand) continue;
              const rel = cand.r._rrfScore ?? 0;
              let simToSelected = 0;
              for (const s of selected) {
                const sim = jaccard(cand.grams, s.grams);
                if (sim > simToSelected) simToSelected = sim;
              }
              const mmr = lambda * rel - (1 - lambda) * simToSelected;
              if (mmr > bestScore) {
                bestScore = mmr;
                bestIdx = i;
              }
            }
            if (bestIdx === -1) break;
            const chosen = precomputed[bestIdx];
            selected.push(chosen);
            precomputed.splice(bestIdx, 1);
          }
          mmrResults = selected.map(x => x.r).concat(dedupedResults.filter(r => !selected.some(x => x.r.id === r.id)));
          console.log(`[searchLanceDB] Applied MMR diversification: selected ${selected.length}/${Math.min(50, dedupedResults.length)}`);
        } catch (e) {
          console.warn('[searchLanceDB] MMR diversification failed:', e);
        }
      }

      // 最終: RRF降順（MMR適用済み配列） → ハイブリッドスコア昇順のタイブレーク
      vectorResults = mmrResults.sort((a, b) => {
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
    const finalResults = combinedResults.slice(0, topK);
    console.log(`[searchLanceDB] Returning top ${finalResults.length} results based on hybrid score`);
    
    // 結果を整形（統一サービスを使用）
    console.log(`[searchLanceDB] Final results before formatting:`);
    finalResults.forEach((result, idx) => {
      console.log(`[searchLanceDB] Result ${idx+1}: title=${result.title}, _sourceType=${result._sourceType}`);
    });
    
    // 統一検索結果処理サービスを使用して結果を処理（RRF無効化で高速化）
    const processedResults = unifiedSearchResultProcessor.processSearchResults(finalResults, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: false  // RRF無効化で高速化
    });
    
    console.log(`[searchLanceDB] Processed ${processedResults.length} results using unified service`);
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
