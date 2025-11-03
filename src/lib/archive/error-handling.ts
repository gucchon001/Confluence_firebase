import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

/**
 * エラーコードの定義
 */
export enum ErrorCode {
  // API関連エラー
  UNAUTHORIZED = 'unauthorized',
  CONFLUENCE_API_ERROR = 'confluence_api_error',
  LLM_API_ERROR = 'llm_api_error',
  VECTOR_SEARCH_ERROR = 'vector_search_error',
  
  // データ処理エラー
  DATABASE_WRITE_ERROR = 'database_write_error',
  RESOURCE_NOT_FOUND = 'resource_not_found',
  BAD_REQUEST = 'bad_request',
  
  // バッチ処理エラー
  PAYLOAD_SIZE_EXCEEDED = 'payload_size_exceeded',
  API_RATE_LIMIT = 'api_rate_limit',
  AUTHENTICATION_ERROR = 'authentication_error',
  BATCH_PROCESSING_ERROR = 'batch_processing_error'
}

/**
 * エラーログのインターフェース
 */
export interface ErrorLog {
  operation: string;
  code: string;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  stack?: string;
}

/**
 * エラーハンドリングユーティリティクラス
 */
export class ErrorHandler {
  /**
   * エラーログを構造化して記録する
   * @param operation 操作名
   * @param error エラーオブジェクト
   * @param context コンテキスト情報
   */
  static async logError(operation: string, error: any, context: Record<string, any> = {}): Promise<void> {
    const errorDetails: ErrorLog = {
      operation,
      code: error.code || ErrorCode.BATCH_PROCESSING_ERROR,
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      context,
      // スタックトレースは開発環境のみ
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    };
    
    console.error(JSON.stringify(errorDetails));
    
    // Firestoreにエラーログを保存（ユーザー、チャット、ログ機能は維持）
    try {
      if (admin.apps.length) {
        const db = admin.firestore();
        await db.collection('errorLogs').add({
          ...errorDetails,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // ローカルファイルにもエラーログを保存
      try {
        const logDir = path.resolve(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFileName = `error_${new Date().toISOString().replace(/:/g, '-')}.json`;
        const logFilePath = path.join(logDir, logFileName);
        
        fs.writeFileSync(logFilePath, JSON.stringify(errorDetails, null, 2));
      } catch (fileError) {
        console.error('Failed to save error log to file:', fileError);
      }
    } catch (logError) {
      // ログ保存自体のエラーは標準エラー出力のみ
      console.error('Failed to save error log:', logError);
    }
  }
  
  /**
   * 指数バックオフでリトライする関数
   * @param operation 実行する関数
   * @param maxRetries 最大リトライ回数
   * @param initialDelay 初期待機時間（ミリ秒）
   * @param backoffFactor バックオフ係数
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000,
    backoffFactor = 2
  ): Promise<T> {
    let retries = 0;
    let delay = initialDelay;
    
    while (true) {
      try {
        return await operation();
      } catch (error: any) {
        retries++;
        
        if (retries > maxRetries) {
          console.error(`Failed after ${maxRetries} retries:`, error.message);
          throw error;
        }
        
        // 指数バックオフでリトライ
        console.log(`Retry ${retries}/${maxRetries} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffFactor;
      }
    }
  }
  
  /**
   * コンテンツサイズに基づいて最適なバッチサイズを計算する
   * @param contents コンテンツの配列
   * @param maxPayloadSize 最大ペイロードサイズ（バイト）
   * @param minBatchSize 最小バッチサイズ
   * @param maxBatchSize 最大バッチサイズ
   */
  static calculateOptimalBatchSize(
    contents: any[],
    maxPayloadSize = 30000,
    minBatchSize = 1,
    maxBatchSize = 50
  ): number {
    if (!contents || contents.length === 0) {
      return maxBatchSize;
    }
    
    // 各コンテンツのサイズ（バイト）を計算
    const contentSizes = contents.map(c => 
      Buffer.byteLength(JSON.stringify({text: c.content || ''}), 'utf8'));
    
    // 平均サイズを計算
    const avgSize = contentSizes.reduce((sum, size) => sum + size, 0) / contentSizes.length;
    
    // 最適なバッチサイズを計算（最低minBatchSize、最大maxBatchSize）
    const optimalSize = Math.floor(maxPayloadSize / avgSize);
    return Math.max(minBatchSize, Math.min(maxBatchSize, optimalSize));
  }
  
  /**
   * 冪等性を確保した処理実行
   * @param operation 操作名
   * @param idempotencyKey 冪等性キー
   * @param processFn 実行する関数
   */
  static async processWithIdempotency<T>(
    operation: string,
    idempotencyKey: string,
    processFn: () => Promise<T>
  ): Promise<T> {
    // 冪等性キャッシュファイルのパス
    const cacheDir = path.resolve(process.cwd(), '.cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const cacheFilePath = path.join(cacheDir, `idempotency_${idempotencyKey.replace(/[^a-zA-Z0-9]/g, '_')}.json`);
    
    // キャッシュファイルを確認
    if (fs.existsSync(cacheFilePath)) {
      try {
        const cacheData = JSON.parse(fs.readFileSync(cacheFilePath, 'utf-8'));
        if (cacheData.status === 'completed') {
          console.log(`Operation ${operation} with key ${idempotencyKey} already completed, skipping`);
          return cacheData.result;
        }
      } catch (error) {
        console.warn(`Failed to read idempotency cache file: ${error}`);
        // キャッシュファイルが壊れている場合は続行
      }
    }
    
    // 処理開始を記録
    const processingState = {
      operation,
      idempotencyKey,
      status: 'processing',
      startedAt: new Date().toISOString()
    };
    fs.writeFileSync(cacheFilePath, JSON.stringify(processingState, null, 2));
    
    try {
      // 処理実行
      const result = await processFn();
      
      // 処理完了を記録
      const completedState = {
        ...processingState,
        status: 'completed',
        result,
        completedAt: new Date().toISOString()
      };
      fs.writeFileSync(cacheFilePath, JSON.stringify(completedState, null, 2));
      
      return result;
    } catch (error: any) {
      // エラー状態を記録
      const failedState = {
        ...processingState,
        status: 'failed',
        error: error.message,
        failedAt: new Date().toISOString()
      };
      fs.writeFileSync(cacheFilePath, JSON.stringify(failedState, null, 2));
      
      throw error;
    }
  }
  
  /**
   * 大きなテキストを前処理して適切なサイズに調整する
   * @param text 処理するテキスト
   * @param maxLength 最大文字数
   */
  static preprocessLargeText(text: string, maxLength = 5000): string {
    if (!text || text.length <= maxLength) return text;
    
    // テキストを短縮（先頭と末尾を残し、中間を省略）
    const headLength = Math.floor(maxLength * 0.6);
    const tailLength = maxLength - headLength - 20; // 省略記号の長さを考慮
    
    const head = text.substring(0, headLength);
    const tail = text.substring(text.length - tailLength);
    
    return `${head} [...中間約${text.length - maxLength}文字省略...] ${tail}`;
  }
}