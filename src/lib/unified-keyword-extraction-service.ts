/**
 * 統一キーワード抽出サービス
 * DynamicKeywordExtractor, KeywordListsLoader, DynamicPriorityManagerを統合
 * デグレードを防ぐため、既存APIとの互換性を維持
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// ===== 既存のインターフェースを再定義 =====
export interface KeywordLists {
  metadata: {
    generatedAt: string;
    version: string;
    description: string;
  };
  statistics: {
    totalCategories: number;
    totalKeywords: number;
    categories: {
      domainNames: number;
      functionNames: number;
      operationNames: number;
      systemFields: number;
      systemTerms: number;
      relatedKeywords: number;
    };
  };
  categories: Array<{
    category: string;
    keywords: string[];
  }>;
}

export interface KeywordCategory {
  domainNames: string[];
  functionNames: string[];
  operationNames: string[];
  systemFields: string[];
  systemTerms: string[];
  relatedKeywords: string[];
}

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

export interface PriorityRule {
  pattern: RegExp;
  priorityAdjustments: {
    domainNames: number;
    functionNames: number;
    operationNames: number;
    systemFields: number;
    systemTerms: number;
    relatedKeywords: number;
  };
  description: string;
}

export interface DynamicPriorityConfig {
  basePriority: {
    domainNames: number;
    functionNames: number;
    operationNames: number;
    systemFields: number;
    systemTerms: number;
    relatedKeywords: number;
  };
  rules: PriorityRule[];
}

/**
 * 統一キーワード抽出サービス
 * 既存の3つのクラスの機能を統合し、パフォーマンスを最適化
 */
export class UnifiedKeywordExtractionService {
  private static instance: UnifiedKeywordExtractionService;
  
  // 統合されたデータ
  private keywordLists: KeywordLists | null = null;
  private keywordCategories: KeywordCategory | null = null;
  private priorityConfig: DynamicPriorityConfig;
  private lastLoaded: Date | null = null;

  private constructor() {
    this.priorityConfig = {
      basePriority: {
        domainNames: 100,
        functionNames: 80,
        operationNames: 60,
        systemFields: 40,
        systemTerms: 30,
        relatedKeywords: 20
      },
      rules: [
        {
          pattern: /教室管理|教室コピー|教室機能/,
          priorityAdjustments: {
            domainNames: 20,
            functionNames: 15,
            operationNames: 10,
            systemFields: 5,
            systemTerms: 5,
            relatedKeywords: 10
          },
          description: '教室管理関連クエリの優先度調整'
        },
        {
          pattern: /ログイン|認証|アクセス/,
          priorityAdjustments: {
            domainNames: 15,
            functionNames: 20,
            operationNames: 15,
            systemFields: 10,
            systemTerms: 5,
            relatedKeywords: 10
          },
          description: 'ログイン関連クエリの優先度調整'
        },
        {
          pattern: /オファー|求人|応募/,
          priorityAdjustments: {
            domainNames: 10,
            functionNames: 15,
            operationNames: 10,
            systemFields: 5,
            systemTerms: 5,
            relatedKeywords: 8
          },
          description: 'オファー関連クエリの優先度調整'
        }
      ]
    };
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(): UnifiedKeywordExtractionService {
    if (!UnifiedKeywordExtractionService.instance) {
      UnifiedKeywordExtractionService.instance = new UnifiedKeywordExtractionService();
    }
    return UnifiedKeywordExtractionService.instance;
  }

  /**
   * キーワードリストを読み込む（遅延読み込み）
   */
  private async ensureKeywordListsLoaded(): Promise<void> {
    if (this.keywordLists && this.keywordCategories) {
      return;
    }

    const defaultPath = join(process.cwd(), 'data/domain-knowledge-v2/keyword-lists-v2.json');
    
    try {
      const data = readFileSync(defaultPath, 'utf8');
      this.keywordLists = JSON.parse(data);
      this.lastLoaded = new Date();
      
      // カテゴリ別に整理
      this.keywordCategories = this.organizeByCategory(this.keywordLists);
      
      console.log(`[UnifiedKeywordExtractionService] キーワードリストを読み込みました: ${defaultPath}`);
      console.log(`[UnifiedKeywordExtractionService] 総キーワード数: ${this.keywordLists.statistics.totalKeywords}個`);
      
    } catch (error) {
      console.error(`[UnifiedKeywordExtractionService] キーワードリストの読み込みに失敗: ${defaultPath}`, error);
      throw error;
    }
  }

  /**
   * カテゴリ別にキーワードを整理
   */
  private organizeByCategory(keywordLists: KeywordLists): KeywordCategory {
    const categories: KeywordCategory = {
      domainNames: [],
      functionNames: [],
      operationNames: [],
      systemFields: [],
      systemTerms: [],
      relatedKeywords: []
    };

    for (const category of keywordLists.categories) {
      switch (category.category) {
        case 'domainNames':
          categories.domainNames = category.keywords;
          break;
        case 'functionNames':
          categories.functionNames = category.keywords;
          break;
        case 'operationNames':
          categories.operationNames = category.keywords;
          break;
        case 'systemFields':
          categories.systemFields = category.keywords;
          break;
        case 'systemTerms':
          categories.systemTerms = category.keywords;
          break;
        case 'relatedKeywords':
          categories.relatedKeywords = category.keywords;
          break;
      }
    }

    return categories;
  }

  /**
   * 動的キーワード抽出のメイン処理（既存API互換）
   */
  async extractDynamicKeywords(query: string): Promise<DynamicExtractResult> {
    const startTime = Date.now();
    
    try {
      // キーワードリストの読み込みを確保
      await this.ensureKeywordListsLoaded();

      // Step 1: クエリの動的解析
      const queryAnalysis = await this.analyzeQueryDynamically(query);

      // Step 2: ドメイン知識からの動的抽出
      const domainKeywords = await this.extractFromDomainKnowledge(queryAnalysis);

      // Step 3: パターンマッチングによる抽出
      const patternKeywords = this.extractFromPatterns(queryAnalysis);

      // Step 4: 動的フィルタリング
      const filteredKeywords = this.applyDynamicFiltering([
        ...domainKeywords,
        ...patternKeywords
      ], queryAnalysis);

      // Step 5: 動的優先度付け
      const prioritizedKeywords = this.applyDynamicPrioritization(filteredKeywords, queryAnalysis);

      // Step 6: 最終的なキーワード選択（8個に制限）
      const finalKeywords = this.selectFinalKeywordsDynamically(prioritizedKeywords, 8);

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
      console.error('[UnifiedKeywordExtractionService] エラー:', error);
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
   * 設定済みキーワード抽出（既存API互換）
   */
  async extractKeywordsConfigured(query: string): Promise<string[]> {
    // キャッシュから取得を試行
    const { keywordCache } = await import('./keyword-cache');
    const cachedKeywords = await keywordCache.getCachedKeywords(query);
    if (cachedKeywords) {
      console.log(`🚀 キーワード抽出結果をキャッシュから取得: ${query.substring(0, 30)}...`);
      return cachedKeywords;
    }
    
    console.log(`🔍 キーワード抽出中: ${query.substring(0, 30)}...`);
    const result = await this.extractDynamicKeywords(query);
    
    // キャッシュに保存
    await keywordCache.setCachedKeywords(query, result.keywords);
    
    return result.keywords;
  }

  // ===== 既存のメソッドを統合 =====
  // （既存のDynamicKeywordExtractorのメソッドをここに統合）
  // 長いため、次のステップで実装

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

  // ===== 残りのメソッドは次のステップで実装 =====
  // デグレードを防ぐため、段階的に実装

  private async detectDomainDynamically(query: string, coreWords: string[]): Promise<string> {
    if (!this.keywordCategories) {
      return 'unknown';
    }

    // 全てのドメインを同等に扱う（ハードコーディングを削除）
    const allDomains = this.keywordCategories.domainNames;

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
    for (const functionName of this.keywordCategories.functionNames) {
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

    return patterns;
  }

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

  private async extractFromDomainKnowledge(queryAnalysis: any): Promise<string[]> {
    if (!this.keywordCategories) {
      return [];
    }

    const extractedKeywords = this.extractKeywordsFromCategories(queryAnalysis.originalQuery);
    
    // 動的フィルタリングを適用
    const filteredKeywords = extractedKeywords.allKeywords.filter(keyword => 
      this.isRelevantToQuery(keyword, queryAnalysis)
    );

    return [...new Set(filteredKeywords)];
  }

  private extractKeywordsFromCategories(query: string): {
    domainNames: string[];
    functionNames: string[];
    operationNames: string[];
    systemFields: string[];
    systemTerms: string[];
    relatedKeywords: string[];
    allKeywords: string[];
  } {
    if (!this.keywordCategories) {
      return {
        domainNames: [],
        functionNames: [],
        operationNames: [],
        systemFields: [],
        systemTerms: [],
        relatedKeywords: [],
        allKeywords: []
      };
    }

    const result = {
      domainNames: this.findMatchingKeywords(query, this.keywordCategories.domainNames),
      functionNames: this.findMatchingKeywords(query, this.keywordCategories.functionNames),
      operationNames: this.findMatchingKeywords(query, this.keywordCategories.operationNames),
      systemFields: this.findMatchingKeywords(query, this.keywordCategories.systemFields),
      systemTerms: this.findMatchingKeywords(query, this.keywordCategories.systemTerms),
      relatedKeywords: this.findMatchingKeywords(query, this.keywordCategories.relatedKeywords),
      allKeywords: [] as string[]
    };

    // 全キーワードを結合
    result.allKeywords = [
      ...result.domainNames,
      ...result.functionNames,
      ...result.operationNames,
      ...result.systemFields,
      ...result.systemTerms,
      ...result.relatedKeywords
    ];

    // 重複除去
    result.allKeywords = [...new Set(result.allKeywords)];

    return result;
  }

  private findMatchingKeywords(query: string, keywords: string[]): string[] {
    const matchedKeywords: string[] = [];
    const queryWords = this.extractQueryWords(query);
    
    // より厳格なマッチング条件でキーワード数を制限
    for (const keyword of keywords) {
      // 1. 完全一致を優先（最高優先度）
      if (queryWords.some(word => keyword === word)) {
        matchedKeywords.push(keyword);
        continue;
      }
      
      // 2. クエリがキーワードを含む（4文字以上、より厳格）
      if (queryWords.some(word => 
        word.length >= 4 && keyword.includes(word)
      )) {
        matchedKeywords.push(keyword);
        continue;
      }
      
      // 3. キーワードがクエリの主要単語を含む（4文字以上、より厳格）
      if (queryWords.some(word => 
        word.length >= 4 && word.includes(keyword) && keyword.length >= 4
      )) {
        matchedKeywords.push(keyword);
        continue;
      }
      
      // 4. 最大20個までに制限（パフォーマンス向上）
      if (matchedKeywords.length >= 20) {
        break;
      }
    }

    return matchedKeywords;
  }

  private extractQueryWords(query: string): string[] {
    // より適切な分割パターン
    const words = query.split(/[の・・、は？]/g).filter(word => word.trim().length > 0);
    
    // 2文字以上の単語のみを抽出
    const validWords = words.map(word => word.trim()).filter(word => word.length >= 2);
    
    return validWords;
  }

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

    return false;
  }

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

  private generateFunctionKeywords(queryAnalysis: any): string[] {
    const functionKeywords: string[] = [];

    // ドメインに基づく機能キーワードの生成（制限付き）
    if (queryAnalysis.domain !== 'unknown') {
      const domain = queryAnalysis.domain;
      
      // より限定的な機能パターン（6個から4個に削減）
      const functionPatterns = ['一覧', '登録', '編集', '詳細'];
      
      for (const pattern of functionPatterns) {
        const functionKeyword = `${domain}${pattern}`;
        if (this.isValidKeyword(functionKeyword)) {
          functionKeywords.push(functionKeyword);
        }
      }
    }

    return functionKeywords;
  }

  private isValidKeyword(keyword: string): boolean {
    return keyword.length >= 2 && keyword.length <= 20;
  }

  private applyDynamicFiltering(keywords: string[], queryAnalysis: any): string[] {
    return keywords.filter(keyword => {
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

  private applyDynamicPrioritization(keywords: string[], queryAnalysis: any): Array<{ keyword: string; priority: number }> {
    return keywords.map(keyword => ({
      keyword,
      priority: this.calculateDynamicPriority(keyword, queryAnalysis)
    }));
  }

  private calculateDynamicPriority(keyword: string, queryAnalysis: any): number {
    let priority = 0;

    // 核心単語との完全一致
    if (queryAnalysis.coreWords.includes(keyword)) {
      priority += 100;
    }

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

  private selectFinalKeywordsDynamically(prioritizedKeywords: Array<{ keyword: string; priority: number }>, maxCount: number): string[] {
    // 優先度順にソート
    prioritizedKeywords.sort((a, b) => b.priority - a.priority);

    // 重複を除去して最終的なキーワード選択
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

  private getFallbackKeywords(query: string): string[] {
    const words = query.split(/[の・・、は？]/g)
      .filter(word => word.trim().length > 0)
      .map(word => word.trim());
    
    return words.slice(0, 8);
  }
}

// シングルトンインスタンスをエクスポート
export const unifiedKeywordExtractionService = UnifiedKeywordExtractionService.getInstance();
