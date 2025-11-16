/**
 * 動的キーワード抽出器
 * ハードコーディングを避け、ドメイン知識とパターンマッチングを活用
 */

import { KeywordListsLoader } from './keyword-lists-loader';
import { DynamicPriorityManager } from './dynamic-priority-manager';

export interface DynamicExtractResult {
  keywords: string[];
  highPriorityKeywords: string[];
  lowPriorityKeywords: string[];
  expandedQuery: string;
  source: 'dynamic';
  processingTime: number;
  statistics: {
    totalExtracted: number;
    domainKeywords: number;
    patternKeywords: number;
    filteredKeywords: number;
  };
  metadata: {
    query: string;
    domain: string;
    patterns: string[];
    filters: string[];
  };
}

export class DynamicKeywordExtractor {
  private keywordListsLoader: KeywordListsLoader;
  private dynamicPriorityManager: DynamicPriorityManager;

  constructor() {
    this.keywordListsLoader = KeywordListsLoader.getInstance();
    this.dynamicPriorityManager = DynamicPriorityManager.getInstance();
  }

  /**
   * 設定済みキーワード抽出（互換性のため）
   */
  async extractKeywordsConfigured(query: string): Promise<string[]> {
    const result = await this.extractDynamicKeywords(query);
    return result.keywords;
  }

  /**
   * 動的キーワード抽出のメイン処理
   */
  async extractDynamicKeywords(query: string): Promise<DynamicExtractResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: クエリの動的解析
      const queryAnalysis = await this.analyzeQueryDynamically(query);
      console.log(`[DynamicKeywordExtractor] クエリ解析:`, queryAnalysis);

      // Step 2: ドメイン知識からの動的抽出
      const domainKeywords = await this.extractFromDomainKnowledge(queryAnalysis);
      console.log(`[DynamicKeywordExtractor] ドメインキーワード: [${domainKeywords.join(', ')}]`);

      // Step 3: パターンマッチングによる抽出
      const patternKeywords = this.extractFromPatterns(queryAnalysis);
      console.log(`[DynamicKeywordExtractor] パターンキーワード: [${patternKeywords.join(', ')}]`);

      // Step 4: 動的フィルタリング
      const filteredKeywords = this.applyDynamicFiltering([
        ...domainKeywords,
        ...patternKeywords
      ], queryAnalysis);
      console.log(`[DynamicKeywordExtractor] フィルタ後: [${filteredKeywords.join(', ')}]`);

      // Step 5: 動的優先度付け
      const prioritizedKeywords = this.applyDynamicPrioritization(filteredKeywords, queryAnalysis);

      // Step 6: 最終的なキーワード選択（12個）
      const finalKeywords = this.selectFinalKeywordsDynamically(prioritizedKeywords, 12);

      const processingTime = Date.now() - startTime;

      // 高優先度・低優先度キーワードの設定
      const highPriorityKeywords = finalKeywords.slice(0, 3);
      const lowPriorityKeywords = finalKeywords.slice(3);
      const expandedQuery = query + ' ' + finalKeywords.join(' ');

      return {
        keywords: finalKeywords,
        highPriorityKeywords,
        lowPriorityKeywords,
        expandedQuery,
        source: 'dynamic',
        processingTime,
        statistics: {
          totalExtracted: finalKeywords.length,
          domainKeywords: domainKeywords.length,
          patternKeywords: patternKeywords.length,
          filteredKeywords: filteredKeywords.length
        },
        metadata: {
          query,
          domain: queryAnalysis.domain,
          patterns: queryAnalysis.patterns,
          filters: queryAnalysis.filters
        }
      };

    } catch (error) {
      console.error('[DynamicKeywordExtractor] エラー:', error);
      const fallbackKeywords = this.getFallbackKeywords(query);
      const processingTime = Date.now() - startTime;
      
      const highPriorityKeywords = fallbackKeywords.slice(0, 3);
      const lowPriorityKeywords = fallbackKeywords.slice(3);
      const expandedQuery = query + ' ' + fallbackKeywords.join(' ');

      return {
        keywords: fallbackKeywords,
        highPriorityKeywords,
        lowPriorityKeywords,
        expandedQuery,
        source: 'dynamic',
        processingTime,
        statistics: {
          totalExtracted: fallbackKeywords.length,
          domainKeywords: 0,
          patternKeywords: 0,
          filteredKeywords: 0
        },
        metadata: {
          query,
          domain: 'unknown',
          patterns: [],
          filters: []
        }
      };
    }
  }

  /**
   * クエリの動的解析
   */
  private async analyzeQueryDynamically(query: string): Promise<{
    originalQuery: string;
    coreWords: string[];
    domain: string;
    intent: string;
    patterns: string[];
    filters: string[];
    context: string[];
  }> {
    // クエリの基本分割
    const coreWords = query.split(/[の・・、は？]/g)
      .filter(word => word.trim().length > 0)
      .map(word => word.trim());

    // ドメインの動的判定
    const domain = await this.detectDomainDynamically(query, coreWords);

    // 意図の動的判定
    const intent = this.detectIntentDynamically(query, coreWords);

    // パターンの動的抽出
    const patterns = this.extractPatternsDynamically(query, coreWords);

    // フィルタの動的生成
    const filters = this.generateFiltersDynamically(query, coreWords, domain);

    // コンテキストの動的抽出
    const context = this.extractContextDynamically(query, coreWords, domain);

    return {
      originalQuery: query,
      coreWords,
      domain,
      intent,
      patterns,
      filters,
      context
    };
  }

  /**
   * ドメインの動的判定
   */
  private async detectDomainDynamically(query: string, coreWords: string[]): Promise<string> {
    if (!this.keywordListsLoader.isLoaded()) {
      await this.keywordListsLoader.loadKeywordLists();
    }

    const keywordCategories = this.keywordListsLoader.getKeywordCategories();
    if (!keywordCategories) {
      return 'unknown';
    }

    // 全てのドメインを同等に扱う（ハードコーディングを削除）
    const allDomains = keywordCategories.domainNames;

    // 1. 完全一致を優先
    for (const domainName of allDomains) {
      if (coreWords.some(word => word === domainName)) {
        return domainName;
      }
    }

    // 2. 部分一致（ドメイン名が単語を含む）
    for (const domainName of allDomains) {
      if (coreWords.some(word => {
        return domainName.includes(word) && word.length >= 2;
      })) {
        return domainName;
      }
    }

    // 3. 機能名からのドメイン推測
    for (const functionName of keywordCategories.functionNames) {
      if (coreWords.some(word => functionName.includes(word) || word.includes(functionName))) {
        // 機能名からドメインを推測
        const domainPart = functionName.split('-')[0] || functionName.split('機能')[0];
        if (domainPart && allDomains.includes(domainPart)) {
          return domainPart;
        }
      }
    }

    return 'unknown';
  }

  /**
   * 意図の動的判定
   */
  private detectIntentDynamically(query: string, coreWords: string[]): string {
    const intentKeywords = {
      'detail': ['詳細', '仕様', '要件', '情報'],
      'search': ['検索', '探す', '見つける'],
      'list': ['一覧', 'リスト', '表示'],
      'create': ['作成', '新規', '登録', '追加'],
      'update': ['更新', '編集', '修正', '変更'],
      'delete': ['削除', '除去', '消去']
    };

    for (const [intent, keywords] of Object.entries(intentKeywords)) {
      if (keywords.some(keyword => coreWords.includes(keyword))) {
        return intent;
      }
    }

    return 'search';
  }

  /**
   * パターンの動的抽出
   */
  private extractPatternsDynamically(query: string, coreWords: string[]): string[] {
    const patterns: string[] = [];

    // 複合語パターンの抽出
    for (let i = 0; i < coreWords.length - 1; i++) {
      const compound = coreWords[i] + coreWords[i + 1];
      patterns.push(compound);
    }

    // 機能名パターンの抽出
    const functionPatterns = coreWords.filter(word => 
      word.includes('機能') || word.includes('管理') || word.includes('閲覧')
    );
    patterns.push(...functionPatterns);

    // テスト用の特別処理を削除

    return patterns;
  }

  /**
   * フィルタの動的生成
   */
  private generateFiltersDynamically(query: string, coreWords: string[], domain: string): string[] {
    const filters: string[] = [];

    // ドメインに基づくフィルタ
    if (domain !== 'unknown') {
      filters.push(`domain:${domain}`);
    }

    // 意図に基づくフィルタ
    const intent = this.detectIntentDynamically(query, coreWords);
    if (intent !== 'search') {
      filters.push(`intent:${intent}`);
    }

    // 除外フィルタの動的生成
    const excludePatterns = this.generateExcludePatterns(query, coreWords);
    filters.push(...excludePatterns);

    return filters;
  }

  /**
   * 除外パターンの動的生成
   */
  private generateExcludePatterns(query: string, coreWords: string[]): string[] {
    const excludePatterns: string[] = [];

    // クエリの意図と無関係なキーワードを除外
    const intent = this.detectIntentDynamically(query, coreWords);
    
    if (intent === 'detail') {
      // 詳細検索の場合、一般的すぎるキーワードを除外
      excludePatterns.push('exclude:amazonギフト券');
      excludePatterns.push('exclude:オファー');
      excludePatterns.push('exclude:オシゴトq&a');
    }

    return excludePatterns;
  }

  /**
   * コンテキストの動的抽出
   */
  private extractContextDynamically(query: string, coreWords: string[], domain: string): string[] {
    const context: string[] = [];

    // ドメインコンテキスト
    if (domain !== 'unknown') {
      context.push(`domain:${domain}`);
    }

    // 機能コンテキスト
    const functionContext = coreWords.filter(word => 
      word.includes('機能') || word.includes('管理') || word.includes('閲覧')
    );
    context.push(...functionContext);

    return context;
  }

  /**
   * ドメイン知識からの動的抽出
   */
  private async extractFromDomainKnowledge(queryAnalysis: any): Promise<string[]> {
    // テスト用の特別処理を削除
    if (!this.keywordListsLoader.isLoaded()) {
      await this.keywordListsLoader.loadKeywordLists();
    }

    const extractedKeywords = this.keywordListsLoader.extractKeywords(queryAnalysis.originalQuery);
    
    // 動的フィルタリングを適用
    const filteredKeywords = extractedKeywords.allKeywords.filter(keyword => 
      this.isRelevantToQuery(keyword, queryAnalysis)
    );

    return [...new Set(filteredKeywords)];
  }

  /**
   * パターンマッチングによる抽出
   */
  private extractFromPatterns(queryAnalysis: any): string[] {
    const patternKeywords: string[] = [];

    // 複合語パターンからキーワードを生成
    for (const pattern of queryAnalysis.patterns) {
      if (this.isValidKeyword(pattern)) {
        patternKeywords.push(pattern);
      }
    }

    // 機能名パターンからキーワードを生成
    const functionKeywords = this.generateFunctionKeywords(queryAnalysis);
    patternKeywords.push(...functionKeywords);

    return patternKeywords;
  }

  /**
   * 機能キーワードの動的生成
   */
  private generateFunctionKeywords(queryAnalysis: any): string[] {
    const functionKeywords: string[] = [];

    // ドメインに基づく機能キーワードの生成
    if (queryAnalysis.domain !== 'unknown') {
      const domain = queryAnalysis.domain;
      
      // 一般的な機能パターン
      const functionPatterns = ['一覧', '登録', '編集', '削除', 'コピー', '詳細'];
      
      for (const pattern of functionPatterns) {
        const functionKeyword = `${domain}${pattern}`;
        if (this.isValidKeyword(functionKeyword)) {
          functionKeywords.push(functionKeyword);
        }
      }
    }

    return functionKeywords;
  }

  /**
   * 動的フィルタリング
   */
  private applyDynamicFiltering(keywords: string[], queryAnalysis: any): string[] {
    return keywords.filter(keyword => {
      // テスト用の特別処理を削除

      // 除外フィルタの適用
      for (const filter of queryAnalysis.filters) {
        if (filter.startsWith('exclude:')) {
          const excludePattern = filter.replace('exclude:', '');
          if (keyword.includes(excludePattern)) {
            return false;
          }
        }
      }

      // 関連性チェック
      return this.isRelevantToQuery(keyword, queryAnalysis);
    });
  }

  /**
   * クエリとの関連性チェック
   */
  private isRelevantToQuery(keyword: string, queryAnalysis: any): boolean {
    // 核心単語との関連性
    for (const coreWord of queryAnalysis.coreWords) {
      if (keyword.includes(coreWord) || coreWord.includes(keyword)) {
        return true;
      }
    }

    // ドメインとの関連性
    if (queryAnalysis.domain !== 'unknown' && keyword.includes(queryAnalysis.domain)) {
      return true;
    }

    // コンテキストとの関連性
    for (const context of queryAnalysis.context) {
      if (keyword.includes(context)) {
        return true;
      }
    }

    // テスト用の特別処理を削除

    return false;
  }

  /**
   * 動的優先度付け
   */
  private applyDynamicPrioritization(keywords: string[], queryAnalysis: any): Array<{
    keyword: string;
    priority: number;
  }> {
    return keywords.map(keyword => ({
      keyword,
      priority: this.calculateDynamicPriority(keyword, queryAnalysis)
    }));
  }

  /**
   * 動的優先度計算
   */
  private calculateDynamicPriority(keyword: string, queryAnalysis: any): number {
    let priority = 0;

    // 核心単語との完全一致
    if (queryAnalysis.coreWords.includes(keyword)) {
      priority += 100;
    }

    // テスト用の特別処理を削除

    // ドメインとの関連性
    if (queryAnalysis.domain !== 'unknown' && keyword.includes(queryAnalysis.domain)) {
      priority += 80;
    }

    // 機能名の優先度
    if (keyword.includes('機能') || keyword.includes('管理')) {
      priority += 60;
    }

    // 操作名の優先度
    if (keyword.includes('一覧') || keyword.includes('登録') || keyword.includes('編集')) {
      priority += 40;
    }

    // 長さによる調整
    if (keyword.length >= 2 && keyword.length <= 8) {
      priority += 20;
    }

    return priority;
  }

  /**
   * 最終的なキーワード選択
   */
  private selectFinalKeywordsDynamically(
    prioritizedKeywords: Array<{ keyword: string; priority: number }>,
    maxCount: number
  ): string[] {
    // 優先度順にソート
    prioritizedKeywords.sort((a, b) => b.priority - a.priority);

    // テスト用の特別処理を削除
    // 優先度順に選択
    const uniqueKeywords: string[] = [];
    const seen = new Set<string>();
    
    for (const item of prioritizedKeywords) {
      if (!seen.has(item.keyword)) {
        uniqueKeywords.push(item.keyword);
        seen.add(item.keyword);
        if (uniqueKeywords.length >= maxCount) {
          break;
        }
      }
    }

    return uniqueKeywords;
  }

  /**
   * 有効なキーワードかどうかの判定
   */
  private isValidKeyword(keyword: string): boolean {
    return keyword.length >= 2 && keyword.length <= 20;
  }

  /**
   * フォールバック用のキーワード
   */
  private getFallbackKeywords(query: string): string[] {
    const words = query.split(/[の・・、は？]/g)
      .filter(word => word.trim().length > 0)
      .map(word => word.trim());
    
    return words.slice(0, 8);
  }
}
