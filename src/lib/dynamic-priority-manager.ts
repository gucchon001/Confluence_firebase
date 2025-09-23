/*
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
    this.config = this.createDefaultConfig();
  }

  static getInstance(): DynamicPriorityManager {
    if (!DynamicPriorityManager.instance) {
      DynamicPriorityManager.instance = new DynamicPriorityManager();
    }
    return DynamicPriorityManager.instance;
  }

  /**
   * デフォルト設定の作成
   */
  private createDefaultConfig(): DynamicPriorityConfig {
    return {
      basePriority: {
        domainNames: 5,      // critical
        functionNames: 4,     // high
        operationNames: 4,   // high
        systemFields: 3,     // medium
        systemTerms: 3,      // medium
        relatedKeywords: 2   // low
      },
      rules: [
        // 教室削除問題のルール（緩和版）
        {
          pattern: /教室.*削除.*(できない|問題|原因|制限)/,
          priorityAdjustments: {
            domainNames: -1,      // ドメイン名の優先度を少し下げる（緩和）
            functionNames: +1,    // 機能名の優先度を上げる（緩和）
            operationNames: +1,   // 操作名の優先度を上げる
            systemFields: +1,     // システム項目の優先度を上げる
            systemTerms: +1,      // システム用語の優先度を上げる
            relatedKeywords: +1   // 関連キーワードの優先度を上げる（追加）
          },
          description: '教室削除問題: 機能名と関連キーワードを優先（緩和版）'
        },
        // 教室管理問題のルール
        {
          pattern: /教室.*管理.*(詳細|機能|一覧|登録|編集|削除)/,
          priorityAdjustments: {
            domainNames: -1,      // ドメイン名の優先度を少し下げる
            functionNames: +1,   // 機能名の優先度を上げる
            operationNames: +1,   // 操作名の優先度を上げる
            systemFields: 0,     // システム項目は変更なし
            systemTerms: 0,      // システム用語は変更なし
            relatedKeywords: 0   // 関連キーワードは変更なし
          },
          description: '教室管理問題: 機能名と操作名を優先'
        },
        // オファー機能問題のルール
        {
          pattern: /オファー.*(機能|種類|問題|制限)/,
          priorityAdjustments: {
            domainNames: -1,      // ドメイン名の優先度を少し下げる
            functionNames: +1,   // 機能名の優先度を上げる
            operationNames: +1,   // 操作名の優先度を上げる
            systemFields: +1,     // システム項目の優先度を上げる
            systemTerms: 0,      // システム用語は変更なし
            relatedKeywords: 0   // 関連キーワードは変更なし
          },
          description: 'オファー機能問題: 機能名と操作名を優先'
        },
        // 会員ログイン問題のルール
        {
          pattern: /(会員|ユーザー).*(ログイン|認証|問題|できない)/,
          priorityAdjustments: {
            domainNames: -1,      // ドメイン名の優先度を少し下げる
            functionNames: +1,   // 機能名の優先度を上げる
            operationNames: +1,   // 操作名の優先度を上げる
            systemFields: +1,     // システム項目の優先度を上げる
            systemTerms: +1,      // システム用語の優先度を上げる
            relatedKeywords: 0   // 関連キーワードは変更なし
          },
          description: '会員ログイン問題: 機能名と操作名を優先'
        },
        // 問題解決系のクエリのルール
        {
          pattern: /(問題|原因|できない|制限|エラー|失敗)/,
          priorityAdjustments: {
            domainNames: -1,      // ドメイン名の優先度を少し下げる
            functionNames: +1,   // 機能名の優先度を上げる
            operationNames: +1,   // 操作名の優先度を上げる
            systemFields: +1,     // システム項目の優先度を上げる
            systemTerms: +1,      // システム用語の優先度を上げる
            relatedKeywords: 0   // 関連キーワードは変更なし
          },
          description: '問題解決系: 機能名と操作名を優先'
        },
        // 求人・応募関連問題のルール
        {
          pattern: /(求人|応募|採用|掲載).*(問題|原因|できない|制限|エラー)/,
          priorityAdjustments: {
            domainNames: 0,       // ドメイン名は変更なし
            functionNames: +1,   // 機能名の優先度を上げる
            operationNames: +1,   // 操作名の優先度を上げる
            systemFields: +2,     // システム項目の優先度を大幅に上げる
            systemTerms: +2,      // システム用語の優先度を大幅に上げる
            relatedKeywords: +2   // 関連キーワードの優先度を大幅に上げる
          },
          description: '求人・応募問題: システム項目と関連キーワードを最優先'
        },
        // 削除制限問題のルール
        {
          pattern: /(削除|削除機能).*(制限|条件|チェック|前|前チェック)/,
          priorityAdjustments: {
            domainNames: 0,       // ドメイン名は変更なし
            functionNames: +1,   // 機能名の優先度を上げる
            operationNames: +2,   // 操作名の優先度を大幅に上げる
            systemFields: +1,     // システム項目の優先度を上げる
            systemTerms: +1,      // システム用語の優先度を上げる
            relatedKeywords: +1   // 関連キーワードの優先度を上げる
          },
          description: '削除制限問題: 操作名と関連キーワードを優先'
        }
      ]
    };
  }

  /**
   * クエリに基づいて動的優先順位を計算
   */
  calculateDynamicPriority(query: string): {
    domainNames: number;
    functionNames: number;
    operationNames: number;
    systemFields: number;
    systemTerms: number;
    relatedKeywords: number;
  } {
    let adjustedPriority = { ...this.config.basePriority };
    let appliedRules: string[] = [];

    // 各ルールを適用
    for (const rule of this.config.rules) {
      if (rule.pattern.test(query)) {
        appliedRules.push(rule.description);
        
        // 優先度調整を適用
        adjustedPriority.domainNames += rule.priorityAdjustments.domainNames;
        adjustedPriority.functionNames += rule.priorityAdjustments.functionNames;
        adjustedPriority.operationNames += rule.priorityAdjustments.operationNames;
        adjustedPriority.systemFields += rule.priorityAdjustments.systemFields;
        adjustedPriority.systemTerms += rule.priorityAdjustments.systemTerms;
        adjustedPriority.relatedKeywords += rule.priorityAdjustments.relatedKeywords;
      }
    }

    // 優先度を1-5の範囲に正規化
    const normalizedPriority = this.normalizePriority(adjustedPriority);

    console.log(`[DynamicPriorityManager] クエリ: "${query}"`);
    console.log(`[DynamicPriorityManager] 適用されたルール: [${appliedRules.join(', ')}]`);
    console.log(`[DynamicPriorityManager] 調整後の優先度:`, normalizedPriority);

    return normalizedPriority;
  }

  /**
   * 優先度を1-5の範囲に正規化
   */
  private normalizePriority(priority: {
    domainNames: number;
    functionNames: number;
    operationNames: number;
    systemFields: number;
    systemTerms: number;
    relatedKeywords: number;
  }): {
    domainNames: number;
    functionNames: number;
    operationNames: number;
    systemFields: number;
    systemTerms: number;
    relatedKeywords: number;
  } {
    const normalized: any = {};
    
    for (const [category, value] of Object.entries(priority)) {
      // 1-5の範囲に制限
      normalized[category] = Math.max(1, Math.min(5, Math.round(value)));
    }

    return normalized;
  }

  /**
   * キーワードの動的優先度を取得
   */
  getDynamicKeywordPriority(
    keyword: string, 
    category: 'domainNames' | 'functionNames' | 'operationNames' | 'systemFields' | 'systemTerms' | 'relatedKeywords',
    query: string
  ): 'critical' | 'high' | 'medium' | 'low' {
    const dynamicPriority = this.calculateDynamicPriority(query);
    const priorityValue = dynamicPriority[category];

    // 優先度値を文字列に変換
    if (priorityValue >= 5) return 'critical';
    if (priorityValue >= 4) return 'high';
    if (priorityValue >= 3) return 'medium';
    return 'low';
  }

  /**
   * 設定の更新
   */
  updateConfig(newConfig: Partial<DynamicPriorityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[DynamicPriorityManager] 設定を更新しました');
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): DynamicPriorityConfig {
    return { ...this.config };
  }

  /**
   * ルールの追加
   */
  addRule(rule: PriorityRule): void {
    this.config.rules.push(rule);
    console.log(`[DynamicPriorityManager] 新しいルールを追加: ${rule.description}`);
  }

  /**
   * ルールの削除
   */
  removeRule(pattern: RegExp): void {
    const initialLength = this.config.rules.length;
    this.config.rules = this.config.rules.filter(rule => rule.pattern.source !== pattern.source);
    
    if (this.config.rules.length < initialLength) {
      console.log(`[DynamicPriorityManager] ルールを削除しました: ${pattern.source}`);
    } else {
      console.log(`[DynamicPriorityManager] 削除するルールが見つかりませんでした: ${pattern.source}`);
    }
  }
}
