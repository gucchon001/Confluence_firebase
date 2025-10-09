/**
 * 画面テスト用ログ出力サービス
 * コンソールログ + ファイル出力で画面テストのログを記録
 */

import * as fs from 'fs';
import * as path from 'path';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: 'search' | 'ai' | 'performance' | 'general';
  message: string;
  data?: any;
}

export class ScreenTestLogger {
  private static instance: ScreenTestLogger;
  private logFile: string;
  private logs: LogEntry[] = [];

  private constructor() {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFile = path.join(logsDir, `screen-test-${timestamp}.json`);
    } catch (error) {
      console.warn('Failed to initialize logger directory:', error);
      this.logFile = path.join(process.cwd(), 'screen-test.log');
    }
  }

  public static getInstance(): ScreenTestLogger {
    if (!ScreenTestLogger.instance) {
      ScreenTestLogger.instance = new ScreenTestLogger();
    }
    return ScreenTestLogger.instance;
  }

  /**
   * ログを記録（コンソール + ファイル）
   */
  private log(level: 'info' | 'warn' | 'error', category: LogEntry['category'], message: string, data?: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data
    };

    // コンソールに出力
    const consoleMessage = `[${entry.timestamp}] [${category.toUpperCase()}] ${message}`;
    if (level === 'error') {
      console.error(consoleMessage, data || '');
    } else if (level === 'warn') {
      console.warn(consoleMessage, data || '');
    } else {
      console.log(consoleMessage, data || '');
    }

    // メモリに保存
    this.logs.push(entry);

    // ファイルに保存（非同期）
    this.saveToFile(entry);
  }

  /**
   * 情報ログ
   */
  public info(category: LogEntry['category'], message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  /**
   * 警告ログ
   */
  public warn(category: LogEntry['category'], message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  /**
   * エラーログ
   */
  public error(category: LogEntry['category'], message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  /**
   * 検索パフォーマンスログ
   */
  public logSearchPerformance(query: string, searchTime: number, results: number, details?: any): void {
    this.info('search', `Search completed: "${query}"`, {
      searchTime: `${searchTime.toFixed(2)}ms`,
      results,
      ...details
    });
  }

  /**
   * AI生成パフォーマンスログ
   */
  public logAIPerformance(question: string, aiTime: number, answerLength: number, details?: any): void {
    this.info('ai', `AI generation completed: "${question}"`, {
      aiTime: `${aiTime.toFixed(2)}ms`,
      answerLength,
      ...details
    });
  }

  /**
   * 総合パフォーマンスログ
   */
  public logOverallPerformance(query: string, totalTime: number, breakdown: any): void {
    this.info('performance', `Overall performance: "${query}"`, {
      totalTime: `${totalTime.toFixed(2)}ms`,
      breakdown
    });
  }

  /**
   * ファイルに保存
   */
  private saveToFile(entry: LogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to save log to file:', error);
    }
  }

  /**
   * ログファイルのパスを取得
   */
  public getLogFilePath(): string {
    return this.logFile;
  }

  /**
   * メモリ内のログを取得
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * ログをクリア
   */
  public clearLogs(): void {
    this.logs = [];
  }

  /**
   * サマリーを生成
   */
  public generateSummary(): any {
    const logs = this.logs;
    const summary = {
      totalLogs: logs.length,
      categories: {} as any,
      performance: {
        searchTimes: [] as number[],
        aiTimes: [] as number[],
        totalTimes: [] as number[],
        searchStats: { count: 0, average: 0, min: 0, max: 0 },
        aiStats: { count: 0, average: 0, min: 0, max: 0 },
        totalStats: { count: 0, average: 0, min: 0, max: 0 }
      },
      errors: [] as string[]
    };

    logs.forEach(log => {
      // カテゴリ別集計
      if (!summary.categories[log.category]) {
        summary.categories[log.category] = 0;
      }
      summary.categories[log.category]++;

      // エラー集計
      if (log.level === 'error') {
        summary.errors.push(log.message);
      }

      // パフォーマンスデータ抽出
      if (log.data) {
        if (log.data.searchTime) {
          const time = parseFloat(log.data.searchTime.replace('ms', ''));
          if (!isNaN(time)) summary.performance.searchTimes.push(time);
        }
        if (log.data.aiTime) {
          const time = parseFloat(log.data.aiTime.replace('ms', ''));
          if (!isNaN(time)) summary.performance.aiTimes.push(time);
        }
        if (log.data.totalTime) {
          const time = parseFloat(log.data.totalTime.replace('ms', ''));
          if (!isNaN(time)) summary.performance.totalTimes.push(time);
        }
      }
    });

    // 統計計算
    const calculateStats = (times: number[]) => ({
      count: times.length,
      average: times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0,
      min: times.length > 0 ? Math.min(...times) : 0,
      max: times.length > 0 ? Math.max(...times) : 0
    });

    summary.performance.searchStats = calculateStats(summary.performance.searchTimes);
    summary.performance.aiStats = calculateStats(summary.performance.aiTimes);
    summary.performance.totalStats = calculateStats(summary.performance.totalTimes);

    return summary;
  }
}

// シングルトンインスタンスをエクスポート
export const screenTestLogger = ScreenTestLogger.getInstance();