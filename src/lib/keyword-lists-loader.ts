/*
 * keyword-lists-v2.jsonファイルの読み込みと管理
 * 設定値化されたドメイン知識の活用
 */

import { readFileSync } from 'fs';
import { join } from 'path';

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

  private constructor() {}

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
   * クエリから関連するキーワードを抽出
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
      
      // キーワードがクエリ単語を含む、またはクエリ単語がキーワードを含む
      if (keyword.includes(trimmedWord) || trimmedWord.includes(keyword)) {
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
   * キーワードの優先度を判定
   */
  getKeywordPriority(keyword: string): 'critical' | 'high' | 'medium' | 'low' {
    if (!this.keywordCategories) {
      return 'low';
    }

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
