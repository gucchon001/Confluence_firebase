/*
 * ドメイン知識ファイルの読み込みと管理
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export interface DomainKnowledge {
  metadata: {
    extractedAt: string;
    version: string;
    description: string;
  };
  statistics: {
    totalPages: number;
    totalKeywords: number;
    domainNames: number;
    reductionRate: number;
    protectedKeywords: number;
  };
  domainNames: string[];
  functionNames?: string[];
  operationNames?: string[];
  systemFields?: string[];
  systemTerms?: string[];
  relatedKeywords?: string[];
}

export class DomainKnowledgeLoader {
  private static instance: DomainKnowledgeLoader;
  private domainKnowledge: DomainKnowledge | null = null;
  private lastLoaded: Date | null = null;

  private constructor() {}

  static getInstance(): DomainKnowledgeLoader {
    if (!DomainKnowledgeLoader.instance) {
      DomainKnowledgeLoader.instance = new DomainKnowledgeLoader();
    }
    return DomainKnowledgeLoader.instance;
  }

  /**
   * ドメイン知識を読み込む
   */
  async loadDomainKnowledge(filePath?: string): Promise<DomainKnowledge> {
    const defaultPath = join(process.cwd(), 'data/domain-knowledge-v2/final-domain-knowledge-v2.json');
    const path = filePath || defaultPath;

    try {
      const data = readFileSync(path, 'utf8');
      this.domainKnowledge = JSON.parse(data);
      this.lastLoaded = new Date();
      
      console.log(`[DomainKnowledgeLoader] ドメイン知識を読み込みました: ${path}`);
      console.log(`[DomainKnowledgeLoader] ドメイン名: ${this.domainKnowledge.domainNames.length}個`);
      console.log(`[DomainKnowledgeLoader] 機能名: ${this.domainKnowledge.functionNames?.length || 0}個`);
      console.log(`[DomainKnowledgeLoader] 操作名: ${this.domainKnowledge.operationNames?.length || 0}個`);
      
      return this.domainKnowledge;
    } catch (error) {
      console.error(`[DomainKnowledgeLoader] ドメイン知識の読み込みに失敗: ${path}`, error);
      throw error;
    }
  }

  /**
   * キャッシュされたドメイン知識を取得
   */
  getDomainKnowledge(): DomainKnowledge | null {
    return this.domainKnowledge;
  }

  /**
   * ドメイン名から関連するキーワードを抽出
   */
  extractDomainKeywords(query: string): string[] {
    if (!this.domainKnowledge) {
      console.warn('[DomainKnowledgeLoader] ドメイン知識が読み込まれていません');
      return [];
    }

    const matchedKeywords: string[] = [];
    
    // ドメイン名とのマッチング
    for (const domainName of this.domainKnowledge.domainNames) {
      if (query.includes(domainName)) {
        matchedKeywords.push(domainName);
      }
    }

    // 機能名とのマッチング
    if (this.domainKnowledge.functionNames) {
      for (const functionName of this.domainKnowledge.functionNames) {
        if (query.includes(functionName)) {
          matchedKeywords.push(functionName);
        }
      }
    }

    // 操作名とのマッチング
    if (this.domainKnowledge.operationNames) {
      for (const operationName of this.domainKnowledge.operationNames) {
        if (query.includes(operationName)) {
          matchedKeywords.push(operationName);
        }
      }
    }

    // システム用語とのマッチング
    if (this.domainKnowledge.systemTerms) {
      for (const systemTerm of this.domainKnowledge.systemTerms) {
        if (query.includes(systemTerm)) {
          matchedKeywords.push(systemTerm);
        }
      }
    }

    // 関連キーワードとのマッチング
    if (this.domainKnowledge.relatedKeywords) {
      for (const relatedKeyword of this.domainKnowledge.relatedKeywords) {
        if (query.includes(relatedKeyword)) {
          matchedKeywords.push(relatedKeyword);
        }
      }
    }

    // 重複除去
    return [...new Set(matchedKeywords)];
  }

  /**
   * 特定のドメインに関連するキーワードを取得
   */
  getRelatedKeywords(domain: string): string[] {
    if (!this.domainKnowledge) {
      return [];
    }

    const relatedKeywords: string[] = [];
    
    // ドメイン名に含まれるキーワードを検索
    for (const domainName of this.domainKnowledge.domainNames) {
      if (domainName.includes(domain)) {
        relatedKeywords.push(domainName);
      }
    }

    // 機能名に含まれるキーワードを検索
    if (this.domainKnowledge.functionNames) {
      for (const functionName of this.domainKnowledge.functionNames) {
        if (functionName.includes(domain)) {
          relatedKeywords.push(functionName);
        }
      }
    }

    return [...new Set(relatedKeywords)];
  }

  /**
   * キーワードの優先度を判定
   */
  getKeywordPriority(keyword: string): 'high' | 'medium' | 'low' {
    if (!this.domainKnowledge) {
      return 'low';
    }

    // ドメイン名は高優先度
    if (this.domainKnowledge.domainNames.includes(keyword)) {
      return 'high';
    }

    // 機能名は中優先度
    if (this.domainKnowledge.functionNames?.includes(keyword)) {
      return 'medium';
    }

    // 操作名は中優先度
    if (this.domainKnowledge.operationNames?.includes(keyword)) {
      return 'medium';
    }

    // システム用語は中優先度
    if (this.domainKnowledge.systemTerms?.includes(keyword)) {
      return 'medium';
    }

    // 関連キーワードは低優先度
    if (this.domainKnowledge.relatedKeywords?.includes(keyword)) {
      return 'low';
    }

    return 'low';
  }

  /**
   * ドメイン知識の統計情報を取得
   */
  getStatistics(): DomainKnowledge['statistics'] | null {
    return this.domainKnowledge?.statistics || null;
  }

  /**
   * ドメイン知識が読み込まれているかチェック
   */
  isLoaded(): boolean {
    return this.domainKnowledge !== null;
  }

  /**
   * 最後に読み込まれた時刻を取得
   */
  getLastLoaded(): Date | null {
    return this.lastLoaded;
  }
}
