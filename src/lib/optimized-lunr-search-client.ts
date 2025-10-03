/**
 * 最適化されたBM25検索クライアント
 * インデックス最適化、メモリ効率化、検索速度向上を実装
 */

import lunr from 'lunr';
import path from 'path';
import { promises as fs } from 'fs';
import { tokenizeJapaneseText } from './japanese-tokenizer';
import { hasIncludedLabel } from './label-utils';
import { labelManager } from './label-manager';

export interface OptimizedLunrDocument {
  id: string;
  title: string;
  content: string;
  labels: string[];
  pageId: number;
  // 最適化されたフィールド
  tokenizedTitle: string;
  tokenizedContent: string;
  // 検索最適化フィールド
  titleTokens: string[];
  contentTokens: string[];
  // メタデータ
  wordCount: number;
  relevanceScore: number;
}

export interface OptimizedLunrSearchResult {
  id: string;
  title: string;
  content: string;
  labels: string[];
  pageId: number;
  score: number;
  // 最適化されたスコア情報
  titleScore: number;
  contentScore: number;
  labelScore: number;
  combinedScore: number;
}

export class OptimizedLunrSearchClient {
  private static instance: OptimizedLunrSearchClient | null = null;
  private index: lunr.Index | null = null;
  private documents: Map<string, OptimizedLunrDocument> = new Map();
  private isInitialized = false;
  private defaultCachePath = path.join('.cache', 'optimized-lunr-index.json');
  
  // 最適化設定
  private readonly OPTIMIZATION_CONFIG = {
    // インデックス最適化
    MAX_DOCUMENTS: 50000,
    MAX_TOKENS_PER_FIELD: 1000,
    MIN_TOKEN_LENGTH: 2,
    
    // 検索最適化
    MAX_SEARCH_RESULTS: 1000,
    SEARCH_BOOST_FACTORS: {
      title: 3.0,
      content: 1.0,
      labels: 2.0
    },
    
    // メモリ最適化
    CACHE_SIZE: 1000,
    BATCH_SIZE: 100
  };

  // シングルトンパターン
  public static getInstance(): OptimizedLunrSearchClient {
    if (!OptimizedLunrSearchClient.instance) {
      OptimizedLunrSearchClient.instance = new OptimizedLunrSearchClient();
    }
    return OptimizedLunrSearchClient.instance;
  }

  /**
   * 最適化されたインデックス初期化
   */
  async initializeOptimized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('🚀 最適化されたBM25インデックス初期化開始...');
    const startTime = performance.now();

    try {
      // キャッシュから読み込み試行
      if (await this.loadFromCache()) {
        console.log('✅ 最適化されたBM25インデックスをキャッシュから読み込み完了');
        this.isInitialized = true;
        return;
      }

      // 新規インデックス作成
      await this.createOptimizedIndex();
      
      // キャッシュに保存
      await this.saveToCache();
      
      const endTime = performance.now();
      console.log(`✅ 最適化されたBM25インデックス初期化完了: ${(endTime - startTime).toFixed(2)}ms`);
      
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ 最適化されたBM25インデックス初期化失敗:', error);
      throw error;
    }
  }

  /**
   * 最適化されたインデックス作成
   */
  private async createOptimizedIndex(): Promise<void> {
    console.log('🔧 最適化されたBM25インデックス作成中...');
    
    // LanceDBからデータを取得
    const { lancedbClient } = await import('./lancedb-client');
    const db = await lancedbClient.getDatabase();
    const table = await lancedbClient.getTable();
    
    const rows = await table.query().limit(this.OPTIMIZATION_CONFIG.MAX_DOCUMENTS).toArray();
    console.log(`📊 ${rows.length}件のドキュメントを処理中...`);

    // ドキュメントを最適化（並列処理）
    const optimizationPromises = rows.map(row => this.optimizeDocument(row));
    const optimizationResults = await Promise.all(optimizationPromises);
    const optimizedDocs = optimizationResults.filter((doc): doc is OptimizedLunrDocument => doc !== null);
    
    // ドキュメントをMapに保存
    optimizedDocs.forEach(optimizedDoc => {
      this.documents.set(optimizedDoc.id, optimizedDoc);
    });

    console.log(`✅ ${optimizedDocs.length}件のドキュメントを最適化完了`);

    // 最適化されたLunrインデックス作成
    const boostFactors = this.OPTIMIZATION_CONFIG.SEARCH_BOOST_FACTORS;
    this.index = lunr(function() {
      // 最適化されたフィールド定義
      this.field('title', { boost: boostFactors.title });
      this.field('content', { boost: boostFactors.content });
      this.field('labels', { boost: boostFactors.labels });
      
      // 日本語対応の検索関数（修正版）
      this.pipeline.before(lunr.trimmer, function(token) {
        if (token && typeof token.update === 'function') {
          return token.update(function(str) {
            return str.toLowerCase();
          });
        }
        return token;
      });

      // ドキュメント追加
      optimizedDocs.forEach(doc => {
        this.add(doc);
      });
    });

    console.log('✅ 最適化されたLunrインデックス作成完了');
  }

  /**
   * ドキュメント最適化
   */
  private async optimizeDocument(row: any): Promise<OptimizedLunrDocument | null> {
    try {
      const title = row.title || '';
      const content = row.content || '';
      
      // 基本的なフィルタリング
      if (!title && !content) {
        return null;
      }

      // 日本語分かち書き（最適化版）
      const titleTokens = await this.optimizeTokenization(title);
      const contentTokens = await this.optimizeTokenization(content);
      
      // トークン制限適用
      const limitedTitleTokens = titleTokens.slice(0, this.OPTIMIZATION_CONFIG.MAX_TOKENS_PER_FIELD);
      const limitedContentTokens = contentTokens.slice(0, this.OPTIMIZATION_CONFIG.MAX_TOKENS_PER_FIELD);

      // 関連性スコア計算
      const relevanceScore = this.calculateRelevanceScore(row);

      return {
        id: row.id || `${row.pageId}-0`,
        title: title,
        content: content,
        labels: row.labels || [],
        pageId: row.pageId || 0,
        tokenizedTitle: limitedTitleTokens.join(' '),
        tokenizedContent: limitedContentTokens.join(' '),
        titleTokens: limitedTitleTokens,
        contentTokens: limitedContentTokens,
        wordCount: titleTokens.length + contentTokens.length,
        relevanceScore: relevanceScore
      };
    } catch (error) {
      console.warn(`⚠️ ドキュメント最適化失敗: ${row.id}`, error);
      return null;
    }
  }

  /**
   * 最適化されたトークン化
   */
  private async optimizeTokenization(text: string): Promise<string[]> {
    if (!text || text.trim().length === 0) {
      return [];
    }

    try {
      // 日本語分かち書き（非同期）
      const tokenizedText = await tokenizeJapaneseText(text);
      const tokens = tokenizedText.split(' ').filter(token => token.trim().length > 0);
      
      // フィルタリングと最適化
      return tokens
        .filter(token => token.length >= this.OPTIMIZATION_CONFIG.MIN_TOKEN_LENGTH)
        .filter(token => !this.isStopWord(token))
        .slice(0, this.OPTIMIZATION_CONFIG.MAX_TOKENS_PER_FIELD);
    } catch (error) {
      console.warn(`⚠️ トークン化失敗: ${text}`, error);
      // フォールバック: 簡単な分割
      return text.split(/\s+/).filter(token => token.trim().length > 0);
    }
  }

  /**
   * ストップワード判定
   */
  private isStopWord(token: string): boolean {
    const stopWords = [
      'の', 'に', 'は', 'を', 'が', 'で', 'と', 'から', 'まで', 'より',
      'て', 'で', 'た', 'だ', 'である', 'です', 'ます', 'である',
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'
    ];
    return stopWords.includes(token.toLowerCase());
  }

  /**
   * 関連性スコア計算
   */
  private calculateRelevanceScore(row: any): number {
    let score = 1.0;
    
    // タイトルがある場合は加点
    if (row.title && row.title.trim().length > 0) {
      score += 0.5;
    }
    
    // コンテンツの長さに基づく加点
    if (row.content && row.content.trim().length > 100) {
      score += 0.3;
    }
    
    // ラベルの有無に基づく加点
    if (row.labels && row.labels.length > 0) {
      score += 0.2;
    }
    
    return score;
  }

  /**
   * 最適化された検索実行
   */
  async searchOptimized(query: string, limit: number = 20): Promise<OptimizedLunrSearchResult[]> {
    if (!this.isInitialized || !this.index) {
      throw new Error('最適化されたBM25インデックスが初期化されていません');
    }

    const startTime = performance.now();
    console.log(`🔍 最適化されたBM25検索実行: "${query}"`);

    try {
    // クエリ最適化
    const optimizedQuery = await this.optimizeQuery(query);
      
      // 検索実行
      const rawResults = this.index.search(optimizedQuery);
      
      // 結果最適化
      const optimizedResults = await this.optimizeSearchResults(rawResults, query);
      
      // ラベルフィルタリング適用
      const filteredResults = this.applyLabelFiltering(optimizedResults);
      
      // 結果制限
      const finalResults = filteredResults.slice(0, Math.min(limit, this.OPTIMIZATION_CONFIG.MAX_SEARCH_RESULTS));
      
      const endTime = performance.now();
      console.log(`✅ 最適化されたBM25検索完了: ${finalResults.length}件 (${(endTime - startTime).toFixed(2)}ms)`);
      
      return finalResults;
    } catch (error) {
      console.error('❌ 最適化されたBM25検索失敗:', error);
      throw error;
    }
  }

  /**
   * クエリ最適化
   */
  private async optimizeQuery(query: string): Promise<string> {
    try {
      // 日本語分かち書き（非同期）
      const tokenizedText = await tokenizeJapaneseText(query);
      const tokens = tokenizedText.split(' ').filter(token => token.trim().length > 0);
      
      // フィルタリングと最適化
      const optimizedTokens = tokens
        .filter(token => token.length >= this.OPTIMIZATION_CONFIG.MIN_TOKEN_LENGTH)
        .filter(token => !this.isStopWord(token))
        .slice(0, 10); // クエリトークン数を制限
      
      return optimizedTokens.join(' ');
    } catch (error) {
      console.warn(`⚠️ クエリ最適化失敗: ${query}`, error);
      // フォールバック: 元のクエリを返す
      return query;
    }
  }

  /**
   * 検索結果最適化
   */
  private async optimizeSearchResults(rawResults: lunr.Index.Result[], query: string): Promise<OptimizedLunrSearchResult[]> {
    const results = [];
    for (const result of rawResults) {
      const doc = this.documents.get(result.ref);
      if (!doc) continue;

      // 詳細スコア計算
      const titleScore = await this.calculateFieldScore(doc.titleTokens, query);
      const contentScore = await this.calculateFieldScore(doc.contentTokens, query);
      const labelScore = await this.calculateFieldScore(doc.labels, query);
      
      // 結合スコア計算
      const combinedScore = this.calculateCombinedScore(
        result.score,
        titleScore,
        contentScore,
        labelScore,
        doc.relevanceScore
      );

      results.push({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        labels: doc.labels,
        pageId: doc.pageId,
        score: result.score,
        titleScore,
        contentScore,
        labelScore,
        combinedScore
      });
    }
    
    return results;
  }

  /**
   * フィールドスコア計算
   */
  private async calculateFieldScore(tokens: string[], query: string): Promise<number> {
    const queryTokens = await tokenizeJapaneseText(query);
    let score = 0;
    
    for (const queryToken of queryTokens) {
      for (const token of tokens) {
        if (token.includes(queryToken) || queryToken.includes(token)) {
          score += 1;
        }
      }
    }
    
    return score;
  }

  /**
   * 結合スコア計算
   */
  private calculateCombinedScore(
    lunrScore: number,
    titleScore: number,
    contentScore: number,
    labelScore: number,
    relevanceScore: number
  ): number {
    return (
      lunrScore * 0.4 +
      titleScore * 0.3 +
      contentScore * 0.2 +
      labelScore * 0.05 +
      relevanceScore * 0.05
    );
  }

  /**
   * ラベルフィルタリング適用
   */
  private applyLabelFiltering(results: OptimizedLunrSearchResult[]): OptimizedLunrSearchResult[] {
    return results.filter(result => {
      // ラベルフィルタリングを適用（現在は全てのラベルを許可）
      return true;
    });
  }

  /**
   * キャッシュから読み込み
   */
  private async loadFromCache(): Promise<boolean> {
    try {
      const cacheDir = path.dirname(this.defaultCachePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheData = await fs.readFile(this.defaultCachePath, 'utf8');
      const { index, documents } = JSON.parse(cacheData);
      
      // インデックス復元
      this.index = lunr.Index.load(index);
      
      // ドキュメント復元
      this.documents = new Map(Object.entries(documents));
      
      return true;
    } catch (error) {
      console.log('📝 キャッシュ読み込み失敗、新規作成します');
      return false;
    }
  }

  /**
   * キャッシュに保存
   */
  private async saveToCache(): Promise<void> {
    try {
      if (!this.index) return;
      
      const cacheDir = path.dirname(this.defaultCachePath);
      await fs.mkdir(cacheDir, { recursive: true });
      
      const cacheData = {
        index: this.index.toJSON(),
        documents: Object.fromEntries(this.documents)
      };
      
      await fs.writeFile(this.defaultCachePath, JSON.stringify(cacheData), 'utf8');
      console.log('💾 最適化されたBM25インデックスをキャッシュに保存完了');
    } catch (error) {
      console.error('❌ キャッシュ保存失敗:', error);
    }
  }

  /**
   * 初期化状態確認
   */
  isReady(): boolean {
    return this.isInitialized && this.index !== null;
  }

  /**
   * 統計情報取得
   */
  getStats(): {
    documentCount: number;
    isInitialized: boolean;
    cachePath: string;
  } {
    return {
      documentCount: this.documents.size,
      isInitialized: this.isInitialized,
      cachePath: this.defaultCachePath
    };
  }
}

// シングルトンインスタンスをエクスポート
export const optimizedLunrSearchClient = OptimizedLunrSearchClient.getInstance();
