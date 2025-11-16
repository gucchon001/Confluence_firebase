/**
 * エラー分析サービス
 * エラーログを分析し、エラー種別、発生率、解決状況を管理します
 */

import type { PostLog, ErrorLog } from '@/types';

// エラー分析結果の型
export interface ErrorAnalysis {
  // エラー種別別の統計
  byCategory: {
    search: ErrorCategoryStats;
    ai: ErrorCategoryStats;
    system: ErrorCategoryStats;
    auth: ErrorCategoryStats;
  };
  // エラーレベル別の統計
  byLevel: {
    error: number;
    warning: number;
    info: number;
  };
  // エラー発生率（時間別）
  errorRateByHour: ErrorRateDataPoint[];
  // エラー発生率（日別）
  errorRateByDay: ErrorRateDataPoint[];
  // 解決状況
  resolutionStatus: {
    resolved: number;
    unresolved: number;
    investigating: number;
  };
  // 最近のエラー（上位N件）
  recentErrors: ErrorLog[];
  // エラーパターン分析
  errorPatterns: ErrorPattern[];
}

// エラーカテゴリ別統計
export interface ErrorCategoryStats {
  count: number;
  percentage: number;
  recentErrors: ErrorLog[];
  avgOccurrencesPerDay: number;
}

// エラー発生率データポイント
export interface ErrorRateDataPoint {
  time: string; // 時間または日付
  errorCount: number;
  totalCount: number;
  errorRate: number; // パーセンテージ
}

// エラーパターン
export interface ErrorPattern {
  pattern: string; // エラーメッセージのパターン
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  category: ErrorLog['category'];
  level: ErrorLog['level'];
  examples: ErrorLog[];
}

export class ErrorAnalysisService {
  private static instance: ErrorAnalysisService;

  private constructor() {}

  public static getInstance(): ErrorAnalysisService {
    if (!ErrorAnalysisService.instance) {
      ErrorAnalysisService.instance = new ErrorAnalysisService();
    }
    return ErrorAnalysisService.instance;
  }

  /**
   * 投稿ログからエラー分析を実行
   */
  public analyzeErrors(postLogs: PostLog[]): ErrorAnalysis {
    // すべてのエラーログを抽出
    const allErrors: ErrorLog[] = [];
    postLogs.forEach(log => {
      if (log.errors && log.errors.length > 0) {
        allErrors.push(...log.errors);
      }
    });

    if (allErrors.length === 0) {
      return this.getEmptyAnalysis();
    }

    // エラー種別別の統計
    const byCategory = this.analyzeByCategory(allErrors, postLogs);

    // エラーレベル別の統計
    const byLevel = this.analyzeByLevel(allErrors);

    // 時間別エラー発生率
    const errorRateByHour = this.calculateErrorRateByHour(postLogs);

    // 日別エラー発生率
    const errorRateByDay = this.calculateErrorRateByDay(postLogs);

    // 解決状況
    const resolutionStatus = this.analyzeResolutionStatus(allErrors);

    // 最近のエラー（上位20件）
    const recentErrors = allErrors
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    // エラーパターン分析
    const errorPatterns = this.analyzeErrorPatterns(allErrors);

    return {
      byCategory,
      byLevel,
      errorRateByHour,
      errorRateByDay,
      resolutionStatus,
      recentErrors,
      errorPatterns,
    };
  }

  /**
   * エラー種別別の統計を分析
   */
  private analyzeByCategory(
    errors: ErrorLog[],
    postLogs: PostLog[]
  ): ErrorAnalysis['byCategory'] {
    const categories: ErrorLog['category'][] = ['search', 'ai', 'system', 'auth'];
    const stats: ErrorAnalysis['byCategory'] = {
      search: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
      ai: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
      system: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
      auth: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
    };

    categories.forEach(category => {
      const categoryErrors = errors.filter(e => e.category === category);
      stats[category] = {
        count: categoryErrors.length,
        percentage: errors.length > 0 ? (categoryErrors.length / errors.length) * 100 : 0,
        recentErrors: categoryErrors
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5),
        avgOccurrencesPerDay: this.calculateAvgOccurrencesPerDay(categoryErrors, postLogs),
      };
    });

    return stats;
  }

  /**
   * エラーレベル別の統計を分析
   */
  private analyzeByLevel(errors: ErrorLog[]): ErrorAnalysis['byLevel'] {
    return {
      error: errors.filter(e => e.level === 'error').length,
      warning: errors.filter(e => e.level === 'warning').length,
      info: errors.filter(e => e.level === 'info').length,
    };
  }

  /**
   * 時間別エラー発生率を計算（過去24時間、1時間間隔）
   */
  private calculateErrorRateByHour(postLogs: PostLog[]): ErrorRateDataPoint[] {
    const now = new Date();
    const dataPoints: ErrorRateDataPoint[] = [];

    for (let i = 23; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourEnd = new Date(now.getTime() - (i - 1) * 60 * 60 * 1000);

      const logsInHour = postLogs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= hourStart && logTime < hourEnd;
      });

      const errorCount = logsInHour.filter(log => log.errors && log.errors.length > 0).length;
      const totalCount = logsInHour.length;
      const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

      dataPoints.push({
        time: `${hourStart.getHours()}:00`,
        errorCount,
        totalCount,
        errorRate,
      });
    }

    return dataPoints;
  }

  /**
   * 日別エラー発生率を計算（過去7日間）
   */
  private calculateErrorRateByDay(postLogs: PostLog[]): ErrorRateDataPoint[] {
    const now = new Date();
    const dataPoints: ErrorRateDataPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setDate(dayStart.getDate() - i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const logsInDay = postLogs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= dayStart && logTime <= dayEnd;
      });

      const errorCount = logsInDay.filter(log => log.errors && log.errors.length > 0).length;
      const totalCount = logsInDay.length;
      const errorRate = totalCount > 0 ? (errorCount / totalCount) * 100 : 0;

      dataPoints.push({
        time: dayStart.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        errorCount,
        totalCount,
        errorRate,
      });
    }

    return dataPoints;
  }

  /**
   * 解決状況を分析
   */
  private analyzeResolutionStatus(
    errors: ErrorLog[]
  ): ErrorAnalysis['resolutionStatus'] {
    return {
      resolved: errors.filter(e => e.resolved).length,
      unresolved: errors.filter(e => !e.resolved).length,
      investigating: errors.filter(e => !e.resolved && e.level === 'error').length, // エラーレベルの未解決を調査中とみなす
    };
  }

  /**
   * エラーパターンを分析
   */
  private analyzeErrorPatterns(errors: ErrorLog[]): ErrorPattern[] {
    // エラーメッセージを正規化してグループ化
    const patternMap = new Map<string, ErrorLog[]>();

    errors.forEach(error => {
      // エラーメッセージから動的な部分（ID、タイムスタンプなど）を除去してパターン化
      const pattern = this.normalizeErrorMessage(error.message);
      
      if (!patternMap.has(pattern)) {
        patternMap.set(pattern, []);
      }
      patternMap.get(pattern)!.push(error);
    });

    // パターンを集計
    const patterns: ErrorPattern[] = Array.from(patternMap.entries())
      .map(([pattern, examples]) => {
        const sortedExamples = examples.sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        return {
          pattern,
          count: examples.length,
          firstOccurrence: new Date(sortedExamples[0].timestamp),
          lastOccurrence: new Date(sortedExamples[sortedExamples.length - 1].timestamp),
          category: examples[0].category,
          level: examples[0].level,
          examples: sortedExamples.slice(0, 3), // 最初の3件を例として保存
        };
      })
      .sort((a, b) => b.count - a.count) // 発生回数でソート
      .slice(0, 10); // 上位10パターン

    return patterns;
  }

  /**
   * エラーメッセージを正規化（動的な部分を除去）
   */
  private normalizeErrorMessage(message: string): string {
    // UUID、タイムスタンプ、数値などを置換
    return message
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<UUID>')
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<TIMESTAMP>')
      .replace(/\d+/g, '<NUMBER>')
      .trim();
  }

  /**
   * 1日あたりの平均発生回数を計算
   */
  private calculateAvgOccurrencesPerDay(
    errors: ErrorLog[],
    postLogs: PostLog[]
  ): number {
    if (errors.length === 0 || postLogs.length === 0) {
      return 0;
    }

    // ログの期間を計算
    const timestamps = postLogs.map(log => new Date(log.timestamp).getTime());
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);
    const daysDiff = (maxTime - minTime) / (1000 * 60 * 60 * 24);

    if (daysDiff === 0) {
      return errors.length;
    }

    return errors.length / daysDiff;
  }

  /**
   * 空の分析結果を返す
   */
  private getEmptyAnalysis(): ErrorAnalysis {
    return {
      byCategory: {
        search: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
        ai: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
        system: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
        auth: { count: 0, percentage: 0, recentErrors: [], avgOccurrencesPerDay: 0 },
      },
      byLevel: {
        error: 0,
        warning: 0,
        info: 0,
      },
      errorRateByHour: [],
      errorRateByDay: [],
      resolutionStatus: {
        resolved: 0,
        unresolved: 0,
        investigating: 0,
      },
      recentErrors: [],
      errorPatterns: [],
    };
  }

  /**
   * エラーを解決済みにマーク
   */
  public resolveError(error: ErrorLog, resolvedBy: string): ErrorLog {
    return {
      ...error,
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy,
    };
  }

  /**
   * エラーのカテゴリ名を日本語で取得
   */
  public getCategoryName(category: ErrorLog['category']): string {
    const names: Record<ErrorLog['category'], string> = {
      search: '検索エラー',
      ai: 'AI生成エラー',
      system: 'システムエラー',
      auth: '認証エラー',
    };
    return names[category];
  }

  /**
   * エラーレベルの表示名を取得
   */
  public getLevelName(level: ErrorLog['level']): string {
    const names: Record<ErrorLog['level'], string> = {
      error: 'エラー',
      warning: '警告',
      info: '情報',
    };
    return names[level];
  }
}

// シングルトンインスタンスをエクスポート
export const errorAnalysisService = ErrorAnalysisService.getInstance();

