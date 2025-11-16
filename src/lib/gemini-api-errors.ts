/**
 * Gemini API エラー用のカスタムエラークラス
 * 403エラー（APIキー漏洩）などの致命的なエラーを適切に処理する
 */

/**
 * APIキーが漏洩として報告された場合のエラー
 * このエラーが発生した場合は、新しいAPIキーを生成して設定を更新する必要があります
 */
export class GeminiApiKeyLeakedError extends Error {
  readonly statusCode: number = 403;
  readonly isFatal: boolean = true;
  
  constructor(message: string, public readonly originalError?: any) {
    super(message);
    this.name = 'GeminiApiKeyLeakedError';
    
    // スタックトレースを保持
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GeminiApiKeyLeakedError);
    }
  }

  /**
   * エラーが403エラー（APIキー漏洩）かどうかを判定
   */
  static isApiKeyLeakedError(error: any): boolean {
    if (error instanceof GeminiApiKeyLeakedError) {
      return true;
    }
    
    // エラーメッセージから判定
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('api key was reported as leaked') ||
        message.includes('permission_denied') ||
        (message.includes('403') && message.includes('leaked'))
      );
    }
    
    // HTTPステータスコードから判定
    if (error?.status === 403 || error?.statusCode === 403) {
      const errorMessage = String(error?.message || '').toLowerCase();
      return errorMessage.includes('leaked') || errorMessage.includes('permission_denied');
    }
    
    return false;
  }
}

/**
 * Gemini API関連の致命的なエラー
 */
export class GeminiApiFatalError extends Error {
  readonly isFatal: boolean = true;
  
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'GeminiApiFatalError';
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GeminiApiFatalError);
    }
  }
}

