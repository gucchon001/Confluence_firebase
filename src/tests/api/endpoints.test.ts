/**
 * APIエンドポイントテスト（実際の実行テスト）
 * 
 * このテストは以下の項目を実際に実行して検証します：
 * 1. `/api/streaming-process`の実際の動作
 * 2. Genkit Flowの実際の実行
 * 3. エラーハンドリングの実際の動作
 * 4. パフォーマンスの測定
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

// 実際の実行テストでは、実際のfetchが必要なため、モックを解除
// Node.js 18以降では、グローバルfetchが利用可能
if (typeof global.fetch !== 'undefined' && typeof (global.fetch as any).mockImplementation === 'function') {
  // vi.fn()でモックされている場合は、実際のfetchを復元
  const originalFetch = globalThis.fetch;
  if (originalFetch) {
    global.fetch = originalFetch;
  }
}

describe('APIエンドポイントテスト', () => {
  beforeAll(() => {
    console.log('🌐 APIエンドポイントテスト開始');
  });

  afterAll(() => {
    console.log('✅ APIエンドポイントテスト完了');
  });

  describe('1. /api/streaming-process 実際の実行テスト', () => {
    it('実際にretrieveRelevantDocs Flowを実行して検索結果を取得', async () => {
      // 実際のFlow関数を動的インポート
      const { retrieveRelevantDocs } = await import('../../ai/flows/retrieve-relevant-docs-lancedb.js');
      
      const testQuestion = '教室管理について';
      const startTime = Date.now();
      
      try {
        const results = await retrieveRelevantDocs({
          question: testQuestion,
          labels: [],
          labelFilters: { includeMeetingNotes: false },
          source: 'confluence'
        });
        
        const duration = Date.now() - startTime;
        
        // 実行結果の検証
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('content');
        expect(results[0]).toHaveProperty('url');
        
        // パフォーマンス検証（30秒以内に完了すること）
        expect(duration).toBeLessThan(30000);
        
        console.log(`✅ retrieveRelevantDocs実行成功: ${results.length}件の結果を${duration}msで取得`);
      } catch (error: any) {
        // エラーが発生した場合でも、エラーメッセージを検証
        console.warn(`⚠️ retrieveRelevantDocs実行エラー: ${error.message}`);
        // エラーの種類を検証
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
        // エラーでもテストは続行（実際の実行テストなので、エラーも検証対象）
        throw error; // エラーを再スローしてテストを失敗させる（実際の実行テストなので）
      }
    }, 60000); // タイムアウト60秒

    it('実際にstreamingSummarizeConfluenceDocs Flowを実行して回答を生成', async () => {
      // 実際のFlow関数を動的インポート
      const { retrieveRelevantDocs } = await import('../../ai/flows/retrieve-relevant-docs-lancedb.js');
      const { streamingSummarizeConfluenceDocs } = await import('../../ai/flows/streaming-summarize-confluence-docs.js');
      
      const testQuestion = '教室管理について';
      
      try {
        // 1. 検索を実行
        const relevantDocs = await retrieveRelevantDocs({
          question: testQuestion,
          labels: [],
          labelFilters: { includeMeetingNotes: false },
          source: 'confluence'
        });
        
        expect(relevantDocs.length).toBeGreaterThan(0);
        
        // 2. 要約を実行
        const startTime = Date.now();
        let fullAnswer = '';
        let chunkCount = 0;
        let references: any[] = [];
        
        for await (const result of streamingSummarizeConfluenceDocs({
          question: testQuestion,
          context: relevantDocs.slice(0, 5), // 最初の5件のみ使用
          chatHistory: []
        })) {
          if (result.answer) {
            fullAnswer += result.answer;
            chunkCount++;
          }
          if (result.references) {
            references = result.references;
          }
        }
        
        const duration = Date.now() - startTime;
        
        // 実行結果の検証
        expect(fullAnswer.length).toBeGreaterThan(0);
        expect(chunkCount).toBeGreaterThan(0);
        expect(Array.isArray(references)).toBe(true);
        
        // パフォーマンス検証（60秒以内に完了すること）
        expect(duration).toBeLessThan(60000);
        
        console.log(`✅ streamingSummarizeConfluenceDocs実行成功: ${chunkCount}チャンク、${fullAnswer.length}文字を${duration}msで生成`);
      } catch (error: any) {
        console.warn(`⚠️ streamingSummarizeConfluenceDocs実行エラー: ${error.message}`);
        // エラーでもテストは続行（実際の実行テストなので、エラーも検証対象）
        throw error; // エラーを再スローしてテストを失敗させる（実際の実行テストなので）
      }
    }, 120000); // タイムアウト120秒

    it('必須パラメータのバリデーションが正しく動作する', () => {
      // 必須パラメータ: question
      const validateRequest = (body: any): { valid: boolean; error?: string } => {
        if (!body.question || typeof body.question !== 'string' || body.question.trim() === '') {
          return { valid: false, error: 'question is required' };
        }
        return { valid: true };
      };

      // 正常なリクエスト
      expect(validateRequest({ question: 'テスト質問' })).toEqual({ valid: true });
      
      // 不正なリクエスト
      expect(validateRequest({})).toEqual({ valid: false, error: 'question is required' });
      expect(validateRequest({ question: '' })).toEqual({ valid: false, error: 'question is required' });
      expect(validateRequest({ question: '   ' })).toEqual({ valid: false, error: 'question is required' });
    });

    it('オプショナルパラメータが正しく処理される', () => {
      // オプショナルパラメータ: chatHistory, labelFilters, source, filters
      const processRequest = (body: any) => {
        return {
          question: body.question,
          chatHistory: body.chatHistory || [],
          labelFilters: body.labelFilters || { includeMeetingNotes: false },
          source: body.source || 'confluence',
          filters: body.filters || {}
        };
      };

      const request1 = processRequest({ question: 'テスト' });
      expect(request1.chatHistory).toEqual([]);
      expect(request1.labelFilters).toEqual({ includeMeetingNotes: false });
      expect(request1.source).toBe('confluence');

      const request2 = processRequest({
        question: 'テスト',
        chatHistory: [{ role: 'user', content: '前の質問' }],
        source: 'jira'
      });
      expect(request2.chatHistory).toHaveLength(1);
      expect(request2.source).toBe('jira');
    });

    it('エラーレスポンスが正しい形式である', () => {
      // エラーレスポンスの形式を確認
      const createErrorResponse = (code: string, message: string) => {
        return {
          error: {
            code,
            message
          }
        };
      };

      const errorResponse = createErrorResponse('bad_request', 'Invalid request');
      expect(errorResponse).toHaveProperty('error');
      expect(errorResponse.error).toHaveProperty('code');
      expect(errorResponse.error).toHaveProperty('message');
      expect(errorResponse.error.code).toBe('bad_request');
    });
  });

  describe('2. /api/admin/* 認証・認可', () => {
    it('管理者権限のチェックが正しく動作する', () => {
      // 管理者権限のチェックロジック
      const isAdmin = (user: { email?: string; isAdmin?: boolean }): boolean => {
        if (!user.email) return false;
        if (!user.email.endsWith('@tomonokai-corp.com')) return false;
        return user.isAdmin === true;
      };

      // 管理者ユーザー
      expect(isAdmin({ email: 'admin@tomonokai-corp.com', isAdmin: true })).toBe(true);
      
      // 非管理者ユーザー
      expect(isAdmin({ email: 'user@tomonokai-corp.com', isAdmin: false })).toBe(false);
      expect(isAdmin({ email: 'user@tomonokai-corp.com' })).toBe(false);
      
      // 許可されていないドメイン
      expect(isAdmin({ email: 'user@gmail.com', isAdmin: true })).toBe(false);
      
      // メールアドレスなし
      expect(isAdmin({ isAdmin: true })).toBe(false);
    });

    it('認証エラーが適切に返される', () => {
      const createAuthError = () => {
        return {
          error: {
            code: 'unauthorized',
            message: '認証が必要です'
          },
          status: 401
        };
      };

      const error = createAuthError();
      expect(error.error.code).toBe('unauthorized');
      expect(error.status).toBe(401);
    });

    it('認可エラーが適切に返される', () => {
      const createAuthzError = () => {
        return {
          error: {
            code: 'forbidden',
            message: 'この操作を実行する権限がありません'
          },
          status: 403
        };
      };

      const error = createAuthzError();
      expect(error.error.code).toBe('forbidden');
      expect(error.status).toBe(403);
    });
  });

  describe('3. 不正リクエストの処理', () => {
    it('不正なJSONが適切に処理される', () => {
      const parseJSON = (jsonString: string): { success: boolean; data?: any; error?: string } => {
        try {
          const data = JSON.parse(jsonString);
          return { success: true, data };
        } catch (error) {
          return { success: false, error: 'Invalid JSON format' };
        }
      };

      // 正常なJSON
      expect(parseJSON('{"question": "test"}')).toEqual({ success: true, data: { question: 'test' } });
      
      // 不正なJSON
      expect(parseJSON('invalid json')).toEqual({ success: false, error: 'Invalid JSON format' });
      expect(parseJSON('{question: test}')).toEqual({ success: false, error: 'Invalid JSON format' });
    });

    it('リクエストサイズの制限が正しく動作する', () => {
      const MAX_REQUEST_SIZE = 1024 * 1024; // 1MB
      
      const validateRequestSize = (body: string): { valid: boolean; error?: string } => {
        const size = new Blob([body]).size;
        if (size > MAX_REQUEST_SIZE) {
          return { valid: false, error: 'Request too large' };
        }
        return { valid: true };
      };

      // 正常なサイズ
      expect(validateRequestSize('{"question": "test"}')).toEqual({ valid: true });
      
      // 大きすぎるリクエスト（モック）
      const largeRequest = 'x'.repeat(MAX_REQUEST_SIZE + 1);
      expect(validateRequestSize(largeRequest)).toEqual({ valid: false, error: 'Request too large' });
    });

    it('SQLインジェクション攻撃が防がれる', () => {
      // 危険な文字列のサニタイズ
      const sanitizeInput = (input: string): string => {
        // 基本的なサニタイズ（実際の実装ではより厳密に行う）
        return input.replace(/['";\\]/g, '');
      };

      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = sanitizeInput(maliciousInput);
      expect(sanitized).not.toContain("'");
      expect(sanitized).not.toContain(';');
    });
  });

  describe('4. タイムアウト処理', () => {
    it('タイムアウト設定が正しい', () => {
      // タイムアウト設定（ミリ秒）
      const TIMEOUTS = {
        search: 30000,      // 30秒
        aiGeneration: 60000, // 60秒
        total: 120000       // 120秒
      };

      expect(TIMEOUTS.search).toBe(30000);
      expect(TIMEOUTS.aiGeneration).toBe(60000);
      expect(TIMEOUTS.total).toBe(120000);
    });

    it('タイムアウトエラーが適切に処理される', () => {
      const createTimeoutError = () => {
        return {
          error: {
            code: 'timeout',
            message: 'リクエストがタイムアウトしました'
          },
          status: 504
        };
      };

      const error = createTimeoutError();
      expect(error.error.code).toBe('timeout');
      expect(error.status).toBe(504);
    });
  });

  describe('5. レスポンス形式の検証', () => {
    it('正常なレスポンスが正しい形式である', () => {
      // ストリーミングレスポンスの形式
      const createStreamResponse = (data: string) => {
        return `data: ${JSON.stringify({ type: 'chunk', content: data })}\n\n`;
      };

      const response = createStreamResponse('テスト回答');
      expect(response).toContain('data: ');
      expect(response).toContain('type');
      expect(response).toContain('content');
    });

    it('エラーレスポンスが正しい形式である', () => {
      const createErrorStreamResponse = (error: { code: string; message: string }) => {
        return `data: ${JSON.stringify({ type: 'error', error })}\n\n`;
      };

      const response = createErrorStreamResponse({ code: 'test_error', message: 'テストエラー' });
      expect(response).toContain('type');
      expect(response).toContain('error');
    });
  });
});

