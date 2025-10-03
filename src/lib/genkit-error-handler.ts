/**
 * Genkit統一エラーハンドリングユーティリティ
 * 既存のエラーハンドリングと並行動作し、段階的に移行
 */

import { ai } from '@/ai/genkit';

export interface ErrorContext {
  operation: string;
  userId?: string;
  requestId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorResponse {
  error: boolean;
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

/**
 * Genkit統一エラーハンドラー
 */
export class GenkitErrorHandler {
  private static instance: GenkitErrorHandler;

  private constructor() {}

  public static getInstance(): GenkitErrorHandler {
    if (!GenkitErrorHandler.instance) {
      GenkitErrorHandler.instance = new GenkitErrorHandler();
    }
    return GenkitErrorHandler.instance;
  }

  /**
   * エラーを統一形式で処理
   */
  public async handleError(
    error: Error | unknown,
    context: ErrorContext
  ): Promise<ErrorResponse> {
    const errorResponse: ErrorResponse = {
      error: true,
      message: 'An error occurred',
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
    };

    try {
      // エラーの分類と詳細情報の抽出
      const errorInfo = this.categorizeError(error);
      
      // Genkitのログ機能を使用してエラーを記録
      await this.logError(error, context, errorInfo);
      
      // エラーレスポンスの構築
      errorResponse.message = errorInfo.userMessage;
      errorResponse.code = errorInfo.code;
      errorResponse.details = {
        ...errorInfo.details,
        operation: context.operation,
        ...context.additionalData,
      };

      // 既存のコンソールログも維持（段階的移行のため）
      console.error(`[GenkitErrorHandler] ${context.operation}:`, {
        error: errorInfo.technicalMessage,
        context,
        details: errorResponse.details,
      });

      return errorResponse;

    } catch (loggingError) {
      // ログ処理自体でエラーが発生した場合のフォールバック
      console.error('[GenkitErrorHandler] Logging failed:', loggingError);
      
      errorResponse.message = 'An internal error occurred';
      errorResponse.code = 'LOGGING_ERROR';
      errorResponse.details = {
        originalError: error instanceof Error ? error.message : String(error),
        loggingError: loggingError instanceof Error ? loggingError.message : String(loggingError),
      };

      return errorResponse;
    }
  }

  /**
   * エラーの分類と詳細情報の抽出
   */
  private categorizeError(error: Error | unknown): {
    code: string;
    userMessage: string;
    technicalMessage: string;
    details: Record<string, any>;
  } {
    if (error instanceof Error) {
      // 既知のエラーパターンの分類
      if (error.message.includes('EADDRINUSE')) {
        return {
          code: 'PORT_IN_USE',
          userMessage: 'サービスが既に起動中です',
          technicalMessage: error.message,
          details: { port: 9003 },
        };
      }

      if (error.message.includes('ECONNREFUSED')) {
        return {
          code: 'CONNECTION_REFUSED',
          userMessage: 'データベースへの接続に失敗しました',
          technicalMessage: error.message,
          details: { service: 'database' },
        };
      }

      if (error.message.includes('UNAUTHENTICATED')) {
        return {
          code: 'AUTHENTICATION_ERROR',
          userMessage: '認証に失敗しました',
          technicalMessage: error.message,
          details: { service: 'firebase' },
        };
      }

      if (error.message.includes('AbortError')) {
        return {
          code: 'REQUEST_ABORTED',
          userMessage: 'リクエストがキャンセルされました',
          technicalMessage: error.message,
          details: { type: 'abort' },
        };
      }

      // デフォルトエラー
      return {
        code: 'UNKNOWN_ERROR',
        userMessage: '予期しないエラーが発生しました',
        technicalMessage: error.message,
        details: {
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5), // スタックトレースの最初の5行
        },
      };
    }

    // 非Errorオブジェクトの場合
    return {
      code: 'NON_ERROR_OBJECT',
      userMessage: 'システムエラーが発生しました',
      technicalMessage: String(error),
      details: { type: typeof error },
    };
  }

  /**
   * Genkitを使用してエラーをログに記録
   */
  private async logError(
    error: Error | unknown,
    context: ErrorContext,
    errorInfo: any
  ): Promise<void> {
    try {
      // Genkitのログ機能を使用（将来的にCloud Loggingに統合）
      const logData = {
        level: 'error',
        message: `Error in ${context.operation}`,
        error: {
          code: errorInfo.code,
          message: errorInfo.technicalMessage,
          userMessage: errorInfo.userMessage,
        },
        context: {
          operation: context.operation,
          userId: context.userId,
          requestId: context.requestId,
        },
        details: errorInfo.details,
        timestamp: new Date().toISOString(),
      };

      // 現在はコンソールログを使用（Genkitのログ機能が利用可能になったら置き換え）
      console.error('[GenkitErrorHandler] Structured Log:', JSON.stringify(logData, null, 2));

    } catch (loggingError) {
      console.error('[GenkitErrorHandler] Failed to log error:', loggingError);
    }
  }

  /**
   * エラーレスポンスの生成（APIレスポンス用）
   */
  public createErrorResponse(
    error: Error | unknown,
    context: ErrorContext,
    httpStatus: number = 500
  ): { status: number; body: ErrorResponse } {
    // 同期的なエラー処理（非同期処理の代替）
    const errorInfo = this.categorizeError(error);
    
    const errorResponse: ErrorResponse = {
      error: true,
      message: errorInfo.userMessage,
      code: errorInfo.code,
      details: {
        ...errorInfo.details,
        operation: context.operation,
        ...context.additionalData,
      },
      timestamp: new Date().toISOString(),
      requestId: context.requestId,
    };

    // 既存のコンソールログも維持
    console.error(`[GenkitErrorHandler] ${context.operation}:`, {
      error: errorInfo.technicalMessage,
      context,
      details: errorResponse.details,
    });

    return {
      status: httpStatus,
      body: errorResponse,
    };
  }
}

// シングルトンインスタンス
export const genkitErrorHandler = GenkitErrorHandler.getInstance();

/**
 * エラーハンドリングのヘルパー関数
 */
export function withGenkitErrorHandling<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  operation: string,
  context?: Partial<ErrorContext>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      const errorResponse = await genkitErrorHandler.handleError(error, {
        operation,
        ...context,
      });
      
      // エラーレスポンスをそのまま投げる（既存のエラーハンドリングとの互換性）
      throw new Error(errorResponse.message);
    }
  };
}

/**
 * APIエラーレスポンス生成ヘルパー
 */
export function createAPIErrorResponse(
  error: Error | unknown,
  operation: string,
  httpStatus: number = 500,
  context?: Partial<ErrorContext>
) {
  return genkitErrorHandler.createErrorResponse(error, {
    operation,
    ...context,
  }, httpStatus);
}
