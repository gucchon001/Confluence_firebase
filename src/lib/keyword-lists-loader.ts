/*
 * keyword-lists-v2.jsonファイルの読み込みと管理
 * 設定値化されたドメイン知識の活用
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { DynamicPriorityManager } from './dynamic-priority-manager';

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

export class KeywordListsLoader {
  private static instance: KeywordListsLoader;
  private keywordLists: KeywordLists | null = null;
  private keywordCategories: KeywordCategory | null = null;
  private lastLoaded: Date | null = null;
  private dynamicPriorityManager: DynamicPriorityManager;

  private constructor() {
    this.dynamicPriorityManager = DynamicPriorityManager.getInstance();
  }

  static getInstance(): KeywordListsLoader {
    if (!KeywordListsLoader.instance) {
      KeywordListsLoader.instance = new KeywordListsLoader();
    }
    return KeywordListsLoader.instance;
  }

  /**
   * キーワードリストを読み込む
   */
  async loadKeywordLists(filePath?: string): Promise<KeywordLists> {
    const defaultPath = join(process.cwd(), 'data/domain-knowledge-v2/keyword-lists-v2.json');
    const path = filePath || defaultPath;

    try {
      const data = readFileSync(path, 'utf8');
      this.keywordLists = JSON.parse(data);
      this.lastLoaded = new Date();
      
      // カテゴリ別に整理
      this.keywordCategories = this.organizeByCategory(this.keywordLists);
      
      console.log(`[KeywordListsLoader] キーワードリストを読み込みました: ${path}`);
      console.log(`[KeywordListsLoader] 総キーワード数: ${this.keywordLists.statistics.totalKeywords}個`);
      console.log(`[KeywordListsLoader] ドメイン名: ${this.keywordLists.statistics.categories.domainNames}個`);
      console.log(`[KeywordListsLoader] 機能名: ${this.keywordLists.statistics.categories.functionNames}個`);
      console.log(`[KeywordListsLoader] 操作名: ${this.keywordLists.statistics.categories.operationNames}個`);
      console.log(`[KeywordListsLoader] システム項目: ${this.keywordLists.statistics.categories.systemFields}個`);
      console.log(`[KeywordListsLoader] システム用語: ${this.keywordLists.statistics.categories.systemTerms}個`);
      console.log(`[KeywordListsLoader] 関連キーワード: ${this.keywordLists.statistics.categories.relatedKeywords}個`);
      
      return this.keywordLists;
    } catch (error) {
      console.error(`[KeywordListsLoader] キーワードリストの読み込みに失敗: ${path}`, error);
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
   * キャッシュされたキーワードリストを取得
   */
  getKeywordLists(): KeywordLists | null {
    return this.keywordLists;
  }

  /**
   * カテゴリ別キーワードを取得
   */
  getKeywordCategories(): KeywordCategory | null {
    return this.keywordCategories;
  }

  /**
   * クエリから関連するキーワードを抽出（動的優先順位対応版）
   */
  extractKeywords(query: string): {
    domainNames: string[];
    functionNames: string[];
    operationNames: string[];
    systemFields: string[];
    systemTerms: string[];
    relatedKeywords: string[];
    allKeywords: string[];
  } {
    if (!this.keywordCategories) {
      console.warn('[KeywordListsLoader] キーワードリストが読み込まれていません');
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
      relatedKeywords: (() => {
        const regularRelatedKeywords = this.findMatchingKeywords(query, this.keywordCategories.relatedKeywords);
        const problemCauseKeywords = this.extractProblemCauseKeywords(query);
        return [...regularRelatedKeywords, ...problemCauseKeywords];
      })(),
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

    // クエリ関連性によるフィルタリングと優先度付け
    result.allKeywords = this.prioritizeKeywordsByRelevance(query, result.allKeywords);

    return result;
  }

  /**
   * 問題原因特化型キーワードの抽出（部分一致対応版）
   */
  private extractProblemCauseKeywords(query: string): string[] {
    const problemCauseKeywords: string[] = [];
    
    // 教室削除問題の原因キーワード
    if (query.includes('教室削除') && (query.includes('できない') || query.includes('問題') || query.includes('原因'))) {
      const causeKeywords = [
        '求人掲載', '求人掲載状態', '求人掲載状態管理', '求人非掲載', '求人非掲載機能',
        '応募情報', '応募履歴', '応募履歴管理', '採用ステータス', '採用ステータス管理', '採用決定日', '採用決定日管理',
        '教室と求人の紐づけ', '教室と求人の紐づけ管理', '削除制限', '削除制限条件', '削除前チェック', '削除前チェック機能',
        '論理削除', '論理削除機能', '削除権限', '削除権限管理', '削除エラー', '削除エラーメッセージ',
        '削除制限通知', '削除制限通知機能', '削除可能性チェック', '削除可能性チェック機能'
      ];
      
      // 関連キーワードリストから部分一致で抽出
      if (this.keywordCategories) {
        for (const keyword of causeKeywords) {
          // 完全一致
          if (this.keywordCategories.relatedKeywords.includes(keyword)) {
            problemCauseKeywords.push(keyword);
          } else {
            // 部分一致で検索
            const partialMatches = this.keywordCategories.relatedKeywords.filter(related => 
              related.includes(keyword) || keyword.includes(related)
            );
            problemCauseKeywords.push(...partialMatches);
          }
        }
      }
    }
    
    return [...new Set(problemCauseKeywords)]; // 重複除去
  }

  /**
   * クエリ関連性によるキーワードの優先度付け
   */
  private prioritizeKeywordsByRelevance(query: string, keywords: string[]): string[] {
    // クエリから重要単語を抽出
    const queryWords = this.extractQueryWords(query);
    const importantWords = queryWords.filter(word => word.length >= 2);
    
    // キーワードを優先度別に分類
    const highPriority: string[] = [];
    const mediumPriority: string[] = [];
    const lowPriority: string[] = [];
    
    for (const keyword of keywords) {
      const relevance = this.calculateRelevance(keyword, importantWords);
      
      if (relevance >= 0.8) {
        highPriority.push(keyword);
      } else if (relevance >= 0.5) {
        mediumPriority.push(keyword);
      } else if (relevance >= 0.2) {
        lowPriority.push(keyword);
      }
    }
    
    // 優先度順に結合（高優先度 → 中優先度 → 低優先度）
    return [...highPriority, ...mediumPriority, ...lowPriority];
  }

  /**
   * キーワードの関連性を計算
   */
  private calculateRelevance(keyword: string, importantWords: string[]): number {
    let maxRelevance = 0;
    
    for (const word of importantWords) {
      // 完全一致
      if (keyword === word) {
        return 1.0;
      }
      
      // 部分一致（キーワードが単語を含む）
      if (keyword.includes(word)) {
        maxRelevance = Math.max(maxRelevance, 0.9);
      }
      
      // 部分一致（単語がキーワードを含む）
      if (word.includes(keyword)) {
        maxRelevance = Math.max(maxRelevance, 0.8);
      }
      
      // 共通部分文字列
      const commonLength = this.findCommonSubstringLength(keyword, word);
      if (commonLength >= 2) {
        const relevance = commonLength / Math.max(keyword.length, word.length);
        maxRelevance = Math.max(maxRelevance, relevance);
      }
    }
    
    return maxRelevance;
  }

  /**
   * 共通部分文字列の長さを計算
   */
  private findCommonSubstringLength(str1: string, str2: string): number {
    let maxLength = 0;
    
    for (let i = 0; i < str1.length; i++) {
      for (let j = 0; j < str2.length; j++) {
        let length = 0;
        while (i + length < str1.length && j + length < str2.length && 
               str1[i + length] === str2[j + length]) {
          length++;
        }
        maxLength = Math.max(maxLength, length);
      }
    }
    
    return maxLength;
  }

  /**
   * クエリから単語を抽出（改善版）
   */
  private extractQueryWords(query: string): string[] {
    // より適切な分割パターン
    const words = query.split(/[の・・、は？]/g).filter(word => word.trim().length > 0);
    
    // 2文字以上の単語のみを抽出
    const validWords = words.map(word => word.trim()).filter(word => word.length >= 2);
    
    // デバッグ用ログ
    console.log(`[extractQueryWords] クエリ: "${query}"`);
    console.log(`[extractQueryWords] 分割後: [${words.map(w => `"${w}"`).join(', ')}]`);
    console.log(`[extractQueryWords] 有効単語: [${validWords.map(w => `"${w}"`).join(', ')}]`);
    
    return validWords;
  }

  /**
   * キーワードのマッチング（汎用版）
   */
  private findMatchingKeywords(query: string, keywords: string[]): string[] {
    const matchedKeywords: string[] = [];
    
    for (const keyword of keywords) {
      // 完全一致
      if (query.includes(keyword)) {
        matchedKeywords.push(keyword);
        continue;
      }
      
      // 部分一致（キーワードがクエリに含まれる）
      if (keyword.includes(query)) {
        matchedKeywords.push(keyword);
        continue;
      }
      
      // 汎用的な関連性マッチング
      if (this.isRelatedKeyword(keyword, query)) {
        matchedKeywords.push(keyword);
        continue;
      }
    }

    return matchedKeywords;
  }

  /**
   * 汎用的な関連性マッチング
   */
  private isRelatedKeyword(keyword: string, query: string): boolean {
    // クエリを単語に分割
    const queryWords = query.split(/[の・・、は？]/g).filter(word => word.trim().length > 0);
    
    // 各クエリ単語に対して、キーワードが関連しているかチェック
    for (const queryWord of queryWords) {
      const trimmedWord = queryWord.trim();
      if (trimmedWord.length < 2) continue;
      
      // スペースを無視したマッチング
      const normalizedKeyword = keyword.replace(/\s+/g, '');
      const normalizedQueryWord = trimmedWord.replace(/\s+/g, '');
      
      // キーワードがクエリ単語を含む、またはクエリ単語がキーワードを含む
      if (normalizedKeyword.includes(normalizedQueryWord) || normalizedQueryWord.includes(normalizedKeyword)) {
        return true;
      }
      
      // 部分的な文字列マッチング（2文字以上の共通部分）
      if (this.hasCommonSubstring(keyword, trimmedWord, 2)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 共通部分文字列のチェック
   */
  private hasCommonSubstring(str1: string, str2: string, minLength: number): boolean {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    for (let i = 0; i <= shorter.length - minLength; i++) {
      const substring = shorter.substring(i, i + minLength);
      if (longer.includes(substring)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 特定のカテゴリからキーワードを検索
   */
  searchByCategory(category: keyof KeywordCategory, query: string): string[] {
    if (!this.keywordCategories) {
      return [];
    }

    return this.findMatchingKeywords(query, this.keywordCategories[category]);
  }

  /**
   * キーワードの優先度を判定（動的優先順位対応版）
   */
  getKeywordPriority(keyword: string, query?: string): 'critical' | 'high' | 'medium' | 'low' {
    if (!this.keywordCategories) {
      return 'low';
    }

    // クエリが指定されている場合は動的優先順位を使用
    if (query) {
      // ドメイン名
      if (this.keywordCategories.domainNames.includes(keyword)) {
        return this.dynamicPriorityManager.getDynamicKeywordPriority(keyword, 'domainNames', query);
      }

      // 機能名
      if (this.keywordCategories.functionNames.includes(keyword)) {
        return this.dynamicPriorityManager.getDynamicKeywordPriority(keyword, 'functionNames', query);
      }

      // 操作名
      if (this.keywordCategories.operationNames.includes(keyword)) {
        return this.dynamicPriorityManager.getDynamicKeywordPriority(keyword, 'operationNames', query);
      }

      // システム項目
      if (this.keywordCategories.systemFields.includes(keyword)) {
        return this.dynamicPriorityManager.getDynamicKeywordPriority(keyword, 'systemFields', query);
      }

      // システム用語
      if (this.keywordCategories.systemTerms.includes(keyword)) {
        return this.dynamicPriorityManager.getDynamicKeywordPriority(keyword, 'systemTerms', query);
      }

      // 関連キーワード
      if (this.keywordCategories.relatedKeywords.includes(keyword)) {
        return this.dynamicPriorityManager.getDynamicKeywordPriority(keyword, 'relatedKeywords', query);
      }
    }

    // クエリが指定されていない場合は従来の静的優先順位を使用
    // ドメイン名は最高優先度
    if (this.keywordCategories.domainNames.includes(keyword)) {
      return 'critical';
    }

    // 機能名は高優先度
    if (this.keywordCategories.functionNames.includes(keyword)) {
      return 'high';
    }

    // 操作名は高優先度
    if (this.keywordCategories.operationNames.includes(keyword)) {
      return 'high';
    }

    // システム項目は中優先度
    if (this.keywordCategories.systemFields.includes(keyword)) {
      return 'medium';
    }

    // システム用語は中優先度
    if (this.keywordCategories.systemTerms.includes(keyword)) {
      return 'medium';
    }

    // 関連キーワードは低優先度
    if (this.keywordCategories.relatedKeywords.includes(keyword)) {
      return 'low';
    }

    return 'low';
  }

  /**
   * キーワードの詳細情報を取得
   */
  getKeywordInfo(keyword: string): {
    category: string;
    priority: string;
    exists: boolean;
  } {
    if (!this.keywordCategories) {
      return { category: 'unknown', priority: 'low', exists: false };
    }

    if (this.keywordCategories.domainNames.includes(keyword)) {
      return { category: 'domainNames', priority: 'critical', exists: true };
    }
    if (this.keywordCategories.functionNames.includes(keyword)) {
      return { category: 'functionNames', priority: 'high', exists: true };
    }
    if (this.keywordCategories.operationNames.includes(keyword)) {
      return { category: 'operationNames', priority: 'high', exists: true };
    }
    if (this.keywordCategories.systemFields.includes(keyword)) {
      return { category: 'systemFields', priority: 'medium', exists: true };
    }
    if (this.keywordCategories.systemTerms.includes(keyword)) {
      return { category: 'systemTerms', priority: 'medium', exists: true };
    }
    if (this.keywordCategories.relatedKeywords.includes(keyword)) {
      return { category: 'relatedKeywords', priority: 'low', exists: true };
    }

    return { category: 'unknown', priority: 'low', exists: false };
  }

  /**
   * 統計情報を取得
   */
  getStatistics(): KeywordLists['statistics'] | null {
    return this.keywordLists?.statistics || null;
  }

  /**
   * キーワードリストが読み込まれているかチェック
   */
  isLoaded(): boolean {
    return this.keywordLists !== null;
  }

  /**
   * 最後に読み込まれた時刻を取得
   */
  getLastLoaded(): Date | null {
    return this.lastLoaded;
  }

  /**
   * 設定値として使用するための設定オブジェクトを生成
   */
  generateConfig(): {
    domainNames: string[];
    functionNames: string[];
    operationNames: string[];
    systemFields: string[];
    systemTerms: string[];
    relatedKeywords: string[];
  } {
    if (!this.keywordCategories) {
      return {
        domainNames: [],
        functionNames: [],
        operationNames: [],
        systemFields: [],
        systemTerms: [],
        relatedKeywords: []
      };
    }

    return {
      domainNames: this.keywordCategories.domainNames,
      functionNames: this.keywordCategories.functionNames,
      operationNames: this.keywordCategories.operationNames,
      systemFields: this.keywordCategories.systemFields,
      systemTerms: this.keywordCategories.systemTerms,
      relatedKeywords: this.keywordCategories.relatedKeywords
    };
  }
}
