/**
 * ラベル管理システム - 統一されたラベルフィルタリング機能
 */
import { LabelFilterOptions } from './search-weights';
import { getLabelsAsArray } from './label-utils';

export interface LabelManagerConfig {
  /** 常に除外するラベル */
  excludeAlways: string[];
  /** 条件付き除外ラベルのマッピング */
  excludeConditional: Record<string, keyof LabelFilterOptions>;
}

export class LabelManager {
  private config: LabelManagerConfig;

  constructor(config?: Partial<LabelManagerConfig>) {
    this.config = {
      excludeAlways: ['スコープ外', 'メールテンプレート', 'フォルダ', 'アーカイブ'],
      excludeConditional: {
        '議事録': 'includeMeetingNotes',
        'meeting-notes': 'includeMeetingNotes',
        'アーカイブ': 'includeArchived',
        'archive': 'includeArchived'
      },
      ...config
    };
  }

  /**
   * フィルタオプションに基づいて除外ラベルリストを生成
   */
  buildExcludeLabels(filterOptions: LabelFilterOptions): string[] {
    const excludeLabels: string[] = [];

    // 常に除外するラベルを追加
    excludeLabels.push(...this.config.excludeAlways);

    // 条件付き除外ラベルをチェック
    for (const [label, optionKey] of Object.entries(this.config.excludeConditional)) {
      const shouldInclude = filterOptions[optionKey];
      if (!shouldInclude) {
        excludeLabels.push(label);
      }
    }

    return excludeLabels;
  }

  /**
   * ラベルが除外対象かどうかを判定
   */
  isExcluded(labels: any, excludeLabels: string[]): boolean {
    if (!excludeLabels || excludeLabels.length === 0) {
      return false;
    }

    const labelArray = getLabelsAsArray(labels);
    if (!labelArray || labelArray.length === 0) {
      return false;
    }

    return labelArray.some(label => 
      excludeLabels.some(excludeLabel => 
        String(label).toLowerCase() === excludeLabel.toLowerCase()
      )
    );
  }


  /**
   * 結果リストにラベルフィルタリングを適用
   */
  filterResults<T extends { labels?: any }>(
    results: T[],
    filterOptions: LabelFilterOptions
  ): T[] {
    const excludeLabels = this.buildExcludeLabels(filterOptions);
    
    return results.filter(result => {
      if (this.isExcluded(result.labels, excludeLabels)) {
        console.log(`[LabelManager] Excluded result: ${(result as any).title || 'Unknown'}`);
        return false;
      }
      return true;
    });
  }

  /**
   * デフォルトのラベルフィルタオプションを取得
   */
  getDefaultFilterOptions(): LabelFilterOptions {
    return {
      includeMeetingNotes: false,
      includeArchived: false
    };
  }

  /**
   * 設定を更新
   */
  updateConfig(config: Partial<LabelManagerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// シングルトンインスタンス
export const labelManager = new LabelManager();
