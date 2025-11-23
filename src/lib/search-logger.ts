/**
 * 検索ログ保存サービス
 * 検索実行時のログをファイルに保存する
 */

import * as fs from 'fs';
import * as path from 'path';

interface SearchLogEntry {
  timestamp: string;
  query: string;
  results: Array<{
    title: string;
    page_id?: number;
    compositeScore?: number;
    rrfScore?: number;
    structuredLabel?: {
      feature?: string;
      domain?: string;
      category?: string;
    };
    scoreBreakdown?: {
      vectorContribution?: number;
      bm25Contribution?: number;
      titleContribution?: number;
      labelContribution?: number;
    };
  }>;
  debugLogs?: string[];
}

export class SearchLogger {
  private static instance: SearchLogger;
  private logFile: string;
  private debugLogs: string[] = [];

  private constructor() {
    try {
      const logsDir = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      this.logFile = path.join(logsDir, `search-${timestamp}.jsonl`);
    } catch (error) {
      console.warn('[SearchLogger] Failed to initialize logger directory:', error);
      this.logFile = path.join(process.cwd(), 'search.log');
    }
  }

  public static getInstance(): SearchLogger {
    if (!SearchLogger.instance) {
      SearchLogger.instance = new SearchLogger();
    }
    return SearchLogger.instance;
  }

  /**
   * デバッグログを追加
   */
  public addDebugLog(message: string): void {
    // NODE_ENVがdevelopmentまたは未設定（開発環境）の場合にログを追加
    // 本番環境（NODE_ENV=production）の場合のみスキップ
    if (process.env.NODE_ENV !== 'production') {
      this.debugLogs.push(`[${new Date().toISOString()}] ${message}`);
    }
  }

  /**
   * BigIntをNumberまたはStringに変換するヘルパー関数
   * ★★★ 修正: BigIntのシリアライズ問題を解決 ★★★
   */
  private bigIntReplacer(key: string, value: any): any {
    if (typeof value === 'bigint') {
      const num = Number(value);
      if (Number.isSafeInteger(num)) {
        return num;
      }
      return value.toString();
    }
    return value;
  }

  /**
   * 検索ログを保存
   */
  public saveSearchLog(query: string, results: any[]): void {
    try {
      const logEntry: SearchLogEntry = {
        timestamp: new Date().toISOString(),
        query,
        results: results.slice(0, 10).map(r => ({
          title: r.title || 'No Title',
          // ★★★ 修正: page_idがBigIntの場合にNumberに変換 ★★★
          page_id: typeof r.page_id === 'bigint' ? Number(r.page_id) : r.page_id,
          compositeScore: r._compositeScore,
          rrfScore: r._rrfScore,
          structuredLabel: r.structured_feature ? {
            feature: r.structured_feature,
            domain: r.structured_domain,
            category: r.structured_category,
          } : undefined,
          scoreBreakdown: r._scoreBreakdown,
        })),
        debugLogs: this.debugLogs.length > 0 ? [...this.debugLogs] : undefined,
      };

      // ★★★ 修正: JSON.stringifyにreplacer関数を追加（BigInt対応） ★★★
      const logLine = JSON.stringify(logEntry, this.bigIntReplacer.bind(this)) + '\n';
      fs.appendFileSync(this.logFile, logLine, 'utf8');
      
      // デバッグログをクリア
      this.debugLogs = [];
      
      // 本番環境以外でコンソールに出力
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[SearchLogger] ✅ Search log saved to: ${this.logFile}`);
      }
    } catch (error) {
      console.error('[SearchLogger] Failed to save search log:', error);
    }
  }

  /**
   * ログファイルのパスを取得
   */
  public getLogFilePath(): string {
    return this.logFile;
  }
}

// シングルトンインスタンスをエクスポート
export const searchLogger = SearchLogger.getInstance();

