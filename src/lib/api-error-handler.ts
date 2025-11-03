/**
 * 統一されたAPI エラーハンドリングユーティリティ
 * 重複コードを解消し、一貫したエラーレスポンスを提供
 */

import { NextResponse } from 'next/server';

export interface APIError {
  code: string;
  message: string;
  details?: any;
}

export interface APIErrorResponse {
  error: APIError;
  timestamp?: string;
}

/**
 * 統一されたAPI エラーレスポンス生成
 */
export class APIErrorHandler {
  /**
   * バリデーションエラー
   */
  static validationError(message: string, details?: any): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message,
          details
        },
        timestamp: new Date().toISOString()
      } as APIErrorResponse,
      { status: 400 }
    );
  }

  /**
   * 認証エラー
   */
  static authenticationError(message: string = 'Authentication required'): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: 'authentication_error',
          message
        },
        timestamp: new Date().toISOString()
      } as APIErrorResponse,
      { status: 401 }
    );
  }

  /**
   * 権限エラー
   */
  static authorizationError(message: string = 'Insufficient permissions'): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: 'authorization_error',
          message
        },
        timestamp: new Date().toISOString()
      } as APIErrorResponse,
      { status: 403 }
    );
  }

  /**
   * リソース未発見エラー
   */
  static notFoundError(message: string = 'Resource not found'): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: 'not_found_error',
          message
        },
        timestamp: new Date().toISOString()
      } as APIErrorResponse,
      { status: 404 }
    );
  }

  /**
   * 内部サーバーエラー
   */
  static internalServerError(
    message: string = 'Internal server error',
    details?: any
  ): NextResponse {
    console.error('[API Error]', { message, details });
    
    return NextResponse.json(
      {
        error: {
          code: 'internal_server_error',
          message,
          details: process.env.NODE_ENV === 'development' ? details : undefined
        },
        timestamp: new Date().toISOString()
      } as APIErrorResponse,
      { status: 500 }
    );
  }

  /**
   * サービス利用不可エラー
   */
  static serviceUnavailableError(
    message: string = 'Service temporarily unavailable',
    details?: any
  ): NextResponse {
    return NextResponse.json(
      {
        error: {
          code: 'service_unavailable_error',
          message,
          details
        },
        timestamp: new Date().toISOString()
      } as APIErrorResponse,
      { status: 503 }
    );
  }

  /**
   * 統一初期化エラーハンドリング
   */
  static async handleUnifiedInitialization(): Promise<boolean> {
    try {
      // unified-initializerはアーカイブに移動済み。代わりにstartup-optimizerを使用
      const { initializeStartupOptimizations } = await import('./startup-optimizer');
      await initializeStartupOptimizations();
      console.log('✅ Startup initialization completed');
      return true;
    } catch (error) {
      console.warn('⚠️ Unified initialization failed:', error);
      return false;
    }
  }

  /**
   * 汎用エラーハンドリング（try-catch用）
   */
  static handleError(error: any, context?: string): NextResponse {
    const errorMessage = error?.message || 'Unknown error occurred';
    const errorCode = error?.code || 'unknown_error';
    
    console.error(`[API Error${context ? ` - ${context}` : ''}]`, error);

    // 既知のエラータイプに基づいて適切なレスポンスを選択
    if (errorCode.includes('validation') || errorMessage.includes('required')) {
      return this.validationError(errorMessage);
    }
    
    if (errorCode.includes('auth') || errorMessage.includes('authentication')) {
      return this.authenticationError(errorMessage);
    }
    
    if (errorCode.includes('permission') || errorMessage.includes('permission')) {
      return this.authorizationError(errorMessage);
    }
    
    if (errorCode.includes('not_found') || errorMessage.includes('not found')) {
      return this.notFoundError(errorMessage);
    }
    
    if (errorCode.includes('service') || errorMessage.includes('unavailable')) {
      return this.serviceUnavailableError(errorMessage);
    }

    // デフォルトは内部サーバーエラー
    return this.internalServerError(errorMessage, error);
  }
}

/**
 * API ルート用の統一エラーハンドリングデコレータ
 */
export function withAPIErrorHandling<T extends any[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error: any) {
      return APIErrorHandler.handleError(error, 'API Route');
    }
  };
}
