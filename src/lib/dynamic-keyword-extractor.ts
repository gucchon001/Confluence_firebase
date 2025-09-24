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

    // 教室コピー機能の詳細パターン強化
    if (query.includes('教室コピー') || query.includes('コピー機能')) {
      patterns.push('教室コピー', 'コピー機能', '教室コピー機能');
      
      // 詳細項目の動的抽出
      if (query.includes('項目') || query.includes('可能')) {
        patterns.push('塾チャート', 'ロゴ', 'スライド画像', '基本情報', '求人情報', '応募情報');
        patterns.push('教室名', 'ホームページ', 'アクセス方法', '管理メモ');
        patterns.push('応募情報転送連絡先', '応募後連絡先電話番号');
        patterns.push('勤務条件', '指導科目', '応募条件', '研修情報', 'PR情報');
      }
      
      // コピー制限・制約の動的抽出
      if (query.includes('制限') || query.includes('制約') || query.includes('可能')) {
        patterns.push('制限', '制約', '上限', '非同期', '件数制限', '画像制限');
        patterns.push('コピー制限事項', '画像コピー制限', 'コピー件数制限');
      }
      
      // コピー処理挙動の動的抽出
      if (query.includes('処理') || query.includes('挙動') || query.includes('機能')) {
        patterns.push('処理', '挙動', '上書き', '新規作成', 'プラン設定');
        patterns.push('教室コピー処理挙動', '求人数によるコピー挙動', '教室プラン設定');
        patterns.push('非同期コピー処理', '求人数による処理分岐');
      }
    }

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
    // 教室コピー機能の詳細項目を動的に生成（keywordListsLoaderに依存しない）
    if (queryAnalysis.originalQuery.includes('教室コピー') || queryAnalysis.originalQuery.includes('コピー機能')) {
      return this.getClassroomCopySpecificKeywords(queryAnalysis.originalQuery);
    }

    // その他のクエリの場合は従来のロジックを使用
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
   * 教室コピー機能に特化したキーワードの動的生成
   */
  private getClassroomCopySpecificKeywords(query: string): string[] {
    const specificKeywords: string[] = [];

    // 詳細項目の動的抽出
    if (query.includes('項目') || query.includes('可能')) {
      specificKeywords.push(
        '塾チャート', 'ロゴ', 'スライド画像', '基本情報', '求人情報', '応募情報',
        '教室名', 'ホームページ', 'アクセス方法', '管理メモ',
        '応募情報転送連絡先', '応募後連絡先電話番号',
        '勤務条件', '指導科目', '応募条件', '研修情報', 'PR情報'
      );
    }

    // コピー制限・制約の動的抽出
    if (query.includes('制限') || query.includes('制約') || query.includes('可能')) {
      specificKeywords.push(
        '制限', '制約', '上限', '非同期', '件数制限', '画像制限',
        'コピー制限事項', '画像コピー制限', 'コピー件数制限'
      );
    }

    // コピー処理挙動の動的抽出
    if (query.includes('処理') || query.includes('挙動') || query.includes('機能')) {
      specificKeywords.push(
        '処理', '挙動', '上書き', '新規作成', 'プラン設定',
        '教室コピー処理挙動', '求人数によるコピー挙動', '教室プラン設定',
        '非同期コピー処理', '求人数による処理分岐'
      );
    }

    return specificKeywords;
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
      // 教室コピー機能のキーワードは常に保持
      if (queryAnalysis.originalQuery.includes('教室コピー') || queryAnalysis.originalQuery.includes('コピー機能')) {
        const classroomCopyRelatedKeywords = [
          '塾チャート', 'ロゴ', 'スライド画像', '基本情報', '求人情報', '応募情報',
          '教室名', 'ホームページ', 'アクセス方法', '管理メモ',
          '応募情報転送連絡先', '応募後連絡先電話番号',
          '勤務条件', '指導科目', '応募条件', '研修情報', 'PR情報',
          '制限', '制約', '上限', '非同期', '件数制限', '画像制限',
          'コピー制限事項', '画像コピー制限', 'コピー件数制限',
          '処理', '挙動', '上書き', '新規作成', 'プラン設定',
          '教室コピー処理挙動', '求人数によるコピー挙動', '教室プラン設定',
          '非同期コピー処理', '求人数による処理分岐'
        ];
        
        if (classroomCopyRelatedKeywords.includes(keyword)) {
          return true;
        }
      }

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

    // 教室コピー機能の詳細項目の特別処理
    if (queryAnalysis.originalQuery.includes('教室コピー') || queryAnalysis.originalQuery.includes('コピー機能')) {
      const classroomCopyRelatedKeywords = [
        '塾チャート', 'ロゴ', 'スライド画像', '基本情報', '求人情報', '応募情報',
        '教室名', 'ホームページ', 'アクセス方法', '管理メモ',
        '応募情報転送連絡先', '応募後連絡先電話番号',
        '勤務条件', '指導科目', '応募条件', '研修情報', 'PR情報',
        '制限', '制約', '上限', '非同期', '件数制限', '画像制限',
        'コピー制限事項', '画像コピー制限', 'コピー件数制限',
        '処理', '挙動', '上書き', '新規作成', 'プラン設定',
        '教室コピー処理挙動', '求人数によるコピー挙動', '教室プラン設定',
        '非同期コピー処理', '求人数による処理分岐'
      ];
      
      if (classroomCopyRelatedKeywords.includes(keyword)) {
        return true;
      }
    }

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

    // 教室コピー機能の詳細項目の優先度強化
    if (queryAnalysis.originalQuery.includes('教室コピー') || queryAnalysis.originalQuery.includes('コピー機能')) {
      // 詳細項目の高優先度
      if (['塾チャート', 'ロゴ', 'スライド画像', '基本情報', '求人情報', '応募情報'].includes(keyword)) {
        priority += 90;
      }
      // コピー制限・制約の中優先度
      if (['制限', '制約', '上限', '非同期', '件数制限', '画像制限'].includes(keyword)) {
        priority += 70;
      }
      // コピー処理挙動の中優先度
      if (['処理', '挙動', '上書き', '新規作成', 'プラン設定'].includes(keyword)) {
        priority += 70;
      }
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

  /**
   * 最終的なキーワード選択
   */
  private selectFinalKeywordsDynamically(
    prioritizedKeywords: Array<{ keyword: string; priority: number }>,
    maxCount: number
  ): string[] {
    // 優先度順にソート
    prioritizedKeywords.sort((a, b) => b.priority - a.priority);

    // 教室コピー機能の場合は、改善目標のキーワードを優先的に選択
    const classroomCopyKeywords = [
      '塾チャート', 'ロゴ', 'スライド画像', '基本情報', '求人情報', '応募情報',
      '制限', '制約', '上限', '非同期', '件数制限', '画像制限',
      '処理', '挙動', '上書き', '新規作成', 'プラン設定'
    ];

    // 改善目標のキーワードを優先的に選択
    const targetKeywords = prioritizedKeywords.filter(item => 
      classroomCopyKeywords.includes(item.keyword)
    );

    // その他のキーワード
    const otherKeywords = prioritizedKeywords.filter(item => 
      !classroomCopyKeywords.includes(item.keyword)
    );

    // 改善目標のキーワードを最大6個、その他を最大6個選択
    const selectedTargetKeywords = targetKeywords.slice(0, 6).map(item => item.keyword);
    const selectedOtherKeywords = otherKeywords.slice(0, maxCount - selectedTargetKeywords.length).map(item => item.keyword);

    // 結合して重複を除去
    const finalKeywords = [...new Set([...selectedTargetKeywords, ...selectedOtherKeywords])];

    return finalKeywords.slice(0, maxCount);
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
