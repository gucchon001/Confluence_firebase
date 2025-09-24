/**
 * 動的優先順位マネージャー
 * クエリの内容に応じてキーワードの優先順位を動的に調整
 */

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

export class DynamicPriorityManager {
  private static instance: DynamicPriorityManager;
  private config: DynamicPriorityConfig;

  private constructor() {
    this.config = {
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

  public static getInstance(): DynamicPriorityManager {
    if (!DynamicPriorityManager.instance) {
      DynamicPriorityManager.instance = new DynamicPriorityManager();
    }
    return DynamicPriorityManager.instance;
  }

  /**
   * クエリに基づいて優先度を動的に調整
   */
  public adjustPriority(query: string, keywordType: keyof DynamicPriorityConfig['basePriority']): number {
    const basePriority = this.config.basePriority[keywordType];
    let adjustment = 0;

    for (const rule of this.config.rules) {
      if (rule.pattern.test(query)) {
        adjustment += rule.priorityAdjustments[keywordType];
      }
    }

    return Math.max(0, basePriority + adjustment);
  }

  /**
   * 全てのキーワードタイプの優先度を取得
   */
  public getAllPriorities(query: string): DynamicPriorityConfig['basePriority'] {
    return {
      domainNames: this.adjustPriority(query, 'domainNames'),
      functionNames: this.adjustPriority(query, 'functionNames'),
      operationNames: this.adjustPriority(query, 'operationNames'),
      systemFields: this.adjustPriority(query, 'systemFields'),
      systemTerms: this.adjustPriority(query, 'systemTerms'),
      relatedKeywords: this.adjustPriority(query, 'relatedKeywords')
    };
  }

  /**
   * 設定を更新
   */
  public updateConfig(config: Partial<DynamicPriorityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): DynamicPriorityConfig {
    return { ...this.config };
  }
}
