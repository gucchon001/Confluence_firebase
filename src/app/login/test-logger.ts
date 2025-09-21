import * as fs from 'fs';
import * as path from 'path';

/**
 * 画面テスト用のログ出力機能
 */
export class TestLogger {
  private logDir: string;
  private logFile: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'src', 'app', 'login');
    this.logFile = path.join(this.logDir, 'ui-test.log');
    
    // ログディレクトリが存在しない場合は作成
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * ログを出力する
   */
  log(level: 'INFO' | 'DEBUG' | 'ERROR', message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data: data || null
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
      fs.appendFileSync(this.logFile, logLine);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * テスト開始をログ出力
   */
  startTest(testName: string, query: string): void {
    this.log('INFO', `Starting UI test: ${testName}`, { query });
  }

  /**
   * テスト終了をログ出力
   */
  endTest(testName: string, success: boolean, duration: number): void {
    this.log('INFO', `Ending UI test: ${testName}`, { success, duration });
  }

  /**
   * RAG処理の詳細をログ出力
   */
  logRagProcess(step: string, data: any): void {
    this.log('DEBUG', `RAG Process: ${step}`, data);
  }

  /**
   * 検索結果をログ出力
   */
  logSearchResults(results: any[]): void {
    this.log('DEBUG', 'Search Results', {
      count: results.length,
      results: results.map(r => ({
        title: r.title,
        source: r.source,
        scoreText: r.scoreText,
        distance: r.distance
      }))
    });
  }

  /**
   * エラーをログ出力
   */
  logError(error: Error, context?: string): void {
    this.log('ERROR', `Error${context ? ` in ${context}` : ''}`, {
      message: error.message,
      stack: error.stack
    });
  }

  /**
   * ログファイルをクリア
   */
  clearLog(): void {
    try {
      fs.writeFileSync(this.logFile, '');
    } catch (error) {
      console.error('Failed to clear log file:', error);
    }
  }

  /**
   * ログファイルの内容を取得
   */
  getLogContent(): string {
    try {
      return fs.readFileSync(this.logFile, 'utf-8');
    } catch (error) {
      console.error('Failed to read log file:', error);
      return '';
    }
  }
}

// シングルトンインスタンス
export const testLogger = new TestLogger();
