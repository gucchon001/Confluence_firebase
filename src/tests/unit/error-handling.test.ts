import { describe, it, expect, vi } from 'vitest';

// エラーレスポンスの型定義
interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// エラーハンドリング関数
function parseErrorResponse(response: any): ErrorResponse | null {
  if (response && response.error && response.error.code && response.error.message) {
    return response as ErrorResponse;
  }
  return null;
}

function getErrorMessage(error: ErrorResponse): string {
  const errorMessages: Record<string, string> = {
    'unauthorized': 'セッションが切れました。再度ログインしてください。',
    'confluence_api_error': '仕様書の取得に失敗しました。時間をおいて再度お試しください。',
    'llm_api_error': '回答の生成中にエラーが発生しました。別の質問をお試しください。',
    'vector_search_error': '内部エラーが発生しました。管理者にお問い合わせください。',
    'database_write_error': '会話履歴の保存に失敗しました。',
    'resource_not_found': 'お探しの会話履歴は見つかりませんでした。',
    'bad_request': 'リクエストの形式が正しくありません。'
  };
  
  return errorMessages[error.error.code] || '予期しないエラーが発生しました。';
}

function shouldRedirectToLogin(error: ErrorResponse): boolean {
  return error.error.code === 'unauthorized';
}

function getHttpStatusFromError(error: ErrorResponse): number {
  const statusMap: Record<string, number> = {
    'unauthorized': 401,
    'bad_request': 400,
    'resource_not_found': 404,
    'database_write_error': 500,
    'vector_search_error': 500,
    'confluence_api_error': 503,
    'llm_api_error': 503
  };
  
  return statusMap[error.error.code] || 500;
}

describe('エラーハンドリング', () => {
  describe('エラーレスポンスのパース', () => {
    it('正しい形式のエラーレスポンスをパースできる', () => {
      const response = {
        error: {
          code: 'unauthorized',
          message: '認証トークンが無効です。'
        }
      };
      
      const parsed = parseErrorResponse(response);
      expect(parsed).not.toBeNull();
      expect(parsed?.error.code).toBe('unauthorized');
      expect(parsed?.error.message).toBe('認証トークンが無効です。');
    });
    
    it('不正な形式のレスポンスはnullを返す', () => {
      const invalidResponses = [
        null,
        undefined,
        {},
        { error: null },
        { error: { code: 'test' } }, // messageがない
        { error: { message: 'test' } }, // codeがない
        { code: 'test', message: 'test' } // errorプロパティがない
      ];
      
      invalidResponses.forEach(response => {
        expect(parseErrorResponse(response)).toBeNull();
      });
    });
  });
  
  describe('エラーメッセージの取得', () => {
    it('各エラーコードに対して適切なメッセージを返す', () => {
      const testCases = [
        {
          error: { error: { code: 'unauthorized', message: '' } },
          expected: 'セッションが切れました。再度ログインしてください。'
        },
        {
          error: { error: { code: 'confluence_api_error', message: '' } },
          expected: '仕様書の取得に失敗しました。時間をおいて再度お試しください。'
        },
        {
          error: { error: { code: 'llm_api_error', message: '' } },
          expected: '回答の生成中にエラーが発生しました。別の質問をお試しください。'
        },
        {
          error: { error: { code: 'vector_search_error', message: '' } },
          expected: '内部エラーが発生しました。管理者にお問い合わせください。'
        },
        {
          error: { error: { code: 'database_write_error', message: '' } },
          expected: '会話履歴の保存に失敗しました。'
        },
        {
          error: { error: { code: 'resource_not_found', message: '' } },
          expected: 'お探しの会話履歴は見つかりませんでした。'
        },
        {
          error: { error: { code: 'bad_request', message: '' } },
          expected: 'リクエストの形式が正しくありません。'
        }
      ];
      
      testCases.forEach(({ error, expected }) => {
        expect(getErrorMessage(error)).toBe(expected);
      });
    });
    
    it('未知のエラーコードに対してデフォルトメッセージを返す', () => {
      const error = { error: { code: 'unknown_error', message: '' } };
      expect(getErrorMessage(error)).toBe('予期しないエラーが発生しました。');
    });
  });
  
  describe('ログインリダイレクトの判定', () => {
    it('unauthorizedエラーの場合はtrueを返す', () => {
      const error = { error: { code: 'unauthorized', message: '' } };
      expect(shouldRedirectToLogin(error)).toBe(true);
    });
    
    it('その他のエラーの場合はfalseを返す', () => {
      const errorCodes = [
        'confluence_api_error',
        'llm_api_error',
        'vector_search_error',
        'database_write_error',
        'resource_not_found',
        'bad_request'
      ];
      
      errorCodes.forEach(code => {
        const error = { error: { code, message: '' } };
        expect(shouldRedirectToLogin(error)).toBe(false);
      });
    });
  });
  
  describe('HTTPステータスコードの取得', () => {
    it('各エラーコードに対して適切なステータスコードを返す', () => {
      const testCases = [
        { code: 'unauthorized', expectedStatus: 401 },
        { code: 'bad_request', expectedStatus: 400 },
        { code: 'resource_not_found', expectedStatus: 404 },
        { code: 'database_write_error', expectedStatus: 500 },
        { code: 'vector_search_error', expectedStatus: 500 },
        { code: 'confluence_api_error', expectedStatus: 503 },
        { code: 'llm_api_error', expectedStatus: 503 }
      ];
      
      testCases.forEach(({ code, expectedStatus }) => {
        const error = { error: { code, message: '' } };
        expect(getHttpStatusFromError(error)).toBe(expectedStatus);
      });
    });
    
    it('未知のエラーコードに対して500を返す', () => {
      const error = { error: { code: 'unknown_error', message: '' } };
      expect(getHttpStatusFromError(error)).toBe(500);
    });
  });
  
  describe('エラーリトライロジック', () => {
    it('一時的なエラーはリトライ可能と判定される', () => {
      const retryableErrors = ['confluence_api_error', 'llm_api_error', 'vector_search_error'];
      const isRetryable = (code: string) => retryableErrors.includes(code);
      
      expect(isRetryable('confluence_api_error')).toBe(true);
      expect(isRetryable('llm_api_error')).toBe(true);
      expect(isRetryable('vector_search_error')).toBe(true);
    });
    
    it('永続的なエラーはリトライ不可と判定される', () => {
      const nonRetryableErrors = ['unauthorized', 'bad_request', 'resource_not_found'];
      const isRetryable = (code: string) => !nonRetryableErrors.includes(code);
      
      expect(isRetryable('unauthorized')).toBe(false);
      expect(isRetryable('bad_request')).toBe(false);
      expect(isRetryable('resource_not_found')).toBe(false);
    });
  });
  
  describe('エラーログ記録', () => {
    it('エラー情報を適切にフォーマットする', () => {
      const formatErrorLog = (error: ErrorResponse, context: any) => {
        return {
          timestamp: new Date().toISOString(),
          errorCode: error.error.code,
          errorMessage: error.error.message,
          userMessage: getErrorMessage(error),
          context
        };
      };
      
      const error = { error: { code: 'confluence_api_error', message: 'API timeout' } };
      const context = { userId: 'test-user', action: 'askQuestion' };
      
      const log = formatErrorLog(error, context);
      
      expect(log.errorCode).toBe('confluence_api_error');
      expect(log.errorMessage).toBe('API timeout');
      expect(log.userMessage).toBe('仕様書の取得に失敗しました。時間をおいて再度お試しください。');
      expect(log.context).toEqual(context);
      expect(log.timestamp).toBeDefined();
    });
  });
});
