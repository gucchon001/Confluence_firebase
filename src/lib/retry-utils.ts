/**
 * リトライ機能を提供するユーティリティ
 * 
 * 一時的なエラー（ネットワークエラーやAPIの一時的な障害など）が発生した場合に、
 * 指数バックオフ（徐々に間隔を広げる）方式で自動的に再試行します。
 */

// リトライ可能なエラーコードのリスト
const RETRYABLE_ERROR_CODES = [
  'confluence_api_error',   // Confluence API関連のエラー
  'llm_api_error',          // LLM API関連のエラー
  'vector_search_error',    // ベクトル検索関連のエラー
  'network_error',          // ネットワーク関連のエラー
  'timeout_error',          // タイムアウト関連のエラー
  'rate_limit_error',       // レート制限エラー（429）
  'server_error',           // サーバーエラー（500番台）
];

// リトライ不可能なエラーコードのリスト
const NON_RETRYABLE_ERROR_CODES = [
  'unauthorized',           // 認証エラー
  'bad_request',            // リクエスト形式のエラー
  'resource_not_found',     // リソースが存在しないエラー
];

/**
 * エラーがリトライ可能かどうかを判定する
 * @param error エラーオブジェクト
 * @returns リトライ可能な場合はtrue、そうでない場合はfalse
 */
function isRetryableError(error: any): boolean {
  // エラーがない場合はリトライ不要
  if (!error) return false;
  
  // ネットワークエラーの場合はリトライ可能
  if (error instanceof TypeError && error.message.includes('network')) {
    return true;
  }
  
  // オフライン状態の場合はリトライ不可
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  
  // エラーコードに基づいて判定
  const errorCode = error.error?.code || error.code;
  if (errorCode) {
    if (NON_RETRYABLE_ERROR_CODES.includes(errorCode)) {
      return false;
    }
    if (RETRYABLE_ERROR_CODES.includes(errorCode)) {
      return true;
    }
  }
  
  // HTTPステータスコードに基づいて判定
  const statusCode = error.status || error.response?.status;
  if (statusCode === 429 || (statusCode >= 500 && statusCode < 600)) {
    return true; // レート制限（429）とサーバーエラー（500番台）はリトライ可能
  }
  
  // エラーメッセージに基づいて判定
  const errorMessage = error.message || error.error?.message || '';
  const retryableKeywords = ['timeout', 'network', 'connection', 'temporary', 'retry', 'rate limit'];
  
  return retryableKeywords.some(keyword => 
    errorMessage.toLowerCase().includes(keyword)
  );
}

/**
 * 指数バックオフ方式で待機時間を計算する
 * @param retryCount リトライ回数
 * @param baseDelay 基本待機時間（ミリ秒）
 * @param maxDelay 最大待機時間（ミリ秒）
 * @returns 待機時間（ミリ秒）
 */
function calculateBackoff(
  retryCount: number,
  baseDelay: number = 300,
  maxDelay: number = 10000
): number {
  // 2のリトライ回数乗に基本待機時間をかける（例: 1回目は300ms、2回目は600ms、3回目は1200ms...）
  const delay = Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  
  // ジッター（ランダム要素）を追加して、同時リトライの集中を避ける
  const jitter = Math.random() * 0.5 * delay;
  
  return delay + jitter;
}

/**
 * 指定された関数を、必要に応じてリトライしながら実行する
 * @param fn 実行する関数
 * @param options リトライオプション
 * @returns 関数の実行結果
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;        // 最大リトライ回数
    baseDelay?: number;         // 基本待機時間（ミリ秒）
    maxDelay?: number;          // 最大待機時間（ミリ秒）
    onRetry?: (error: any, retryCount: number, delay: number) => void; // リトライ時のコールバック
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 300,
    maxDelay = 10000,
    onRetry = () => {}
  } = options;
  
  let retryCount = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      // 最大リトライ回数に達した場合はエラーを投げる
      if (retryCount >= maxRetries) {
        throw error;
      }
      
      // リトライ不可能なエラーの場合はエラーを投げる
      if (!isRetryableError(error)) {
        throw error;
      }
      
      // 待機時間を計算
      const delay = calculateBackoff(retryCount, baseDelay, maxDelay);
      
      // リトライコールバックを呼び出す
      onRetry(error, retryCount + 1, delay);
      
      // 待機
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // リトライカウントを増やす
      retryCount++;
    }
  }
}
