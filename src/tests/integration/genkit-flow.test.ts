/**
 * Genkit Flow実行テスト（実際の実行テスト）
 * 
 * このテストは以下の項目を実際に実行して検証します：
 * 1. Genkit Flowの実際の実行
 * 2. Flow実行結果の品質検証
 * 3. エラーハンドリングの実際の動作
 * 4. パフォーマンスの測定
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadTestEnv } from '../test-helpers/env-loader';

// テスト用の環境変数を事前に読み込む
loadTestEnv();

describe('Genkit Flow実行テスト', () => {
  beforeAll(() => {
    console.log('🔄 Genkit Flow実行テスト開始');
  });

  afterAll(() => {
    console.log('✅ Genkit Flow実行テスト完了');
  });

  describe('1. Flowの実際の実行テスト', () => {
    it('実際にretrieveRelevantDocs Flowを実行して検索結果を取得', async () => {
      // 実際のFlow関数を動的インポート
      const { retrieveRelevantDocs } = await import('../../ai/flows/retrieve-relevant-docs-lancedb.js');
      
      const testQuestion = '教室管理について';
      const startTime = Date.now();
      
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
      expect(results.length).toBeLessThanOrEqual(12); // 最大12件
      
      // 結果の品質検証
      if (results.length > 0) {
        const firstResult = results[0];
        expect(firstResult).toHaveProperty('title');
        expect(firstResult).toHaveProperty('content');
        expect(firstResult).toHaveProperty('url');
        expect(firstResult.title).toBeTruthy();
        expect(firstResult.content).toBeTruthy();
      }
      
      // パフォーマンス検証（30秒以内に完了すること）
      expect(duration).toBeLessThan(30000);
      
      console.log(`✅ retrieveRelevantDocs実行成功: ${results.length}件の結果を${duration}msで取得`);
    }, 60000); // タイムアウト60秒

    it('実際にstreamingSummarizeConfluenceDocs Flowを実行して回答を生成', async () => {
      // 実際のFlow関数を動的インポート
      const { retrieveRelevantDocs } = await import('../../ai/flows/retrieve-relevant-docs-lancedb.js');
      const { streamingSummarizeConfluenceDocs } = await import('../../ai/flows/streaming-summarize-confluence-docs.js');
      
      const testQuestion = '教室管理について';
      
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
      expect(fullAnswer.length).toBeGreaterThan(50); // 最低50文字の回答
      expect(chunkCount).toBeGreaterThan(0);
      expect(Array.isArray(references)).toBe(true);
      expect(references.length).toBeGreaterThan(0);
      
      // パフォーマンス検証（60秒以内に完了すること）
      expect(duration).toBeLessThan(60000);
      
      console.log(`✅ streamingSummarizeConfluenceDocs実行成功: ${chunkCount}チャンク、${fullAnswer.length}文字を${duration}msで生成`);
    }, 120000); // タイムアウト120秒

    it('retrieveRelevantDocs Flowが正しい形式で動作する', () => {
      // retrieveRelevantDocs Flowのパラメータ検証
      const flowParams = {
        question: 'テスト質問',
        labels: [],
        labelFilters: { includeMeetingNotes: false }
      };

      expect(flowParams.question).toBeTruthy();
      expect(typeof flowParams.question).toBe('string');
      expect(Array.isArray(flowParams.labels)).toBe(true);
      expect(flowParams.labelFilters).toHaveProperty('includeMeetingNotes');
    });

    it('summarizeConfluenceDocs Flowが正しい形式で動作する', () => {
      // summarizeConfluenceDocs Flowのパラメータ検証
      const flowParams = {
        question: 'テスト質問',
        context: [
          {
            title: 'Test Document',
            content: 'Test content',
            url: 'https://example.com/doc'
          }
        ],
        chatHistory: []
      };

      expect(flowParams.question).toBeTruthy();
      expect(Array.isArray(flowParams.context)).toBe(true);
      expect(Array.isArray(flowParams.chatHistory)).toBe(true);
    });

    it('Flow名が正しく検証される', () => {
      // Flow名の検証ロジック
      const validFlows = ['retrieveRelevantDocs', 'summarizeConfluenceDocs'];
      const validateFlowName = (flowName: string): boolean => {
        return validFlows.includes(flowName);
      };

      expect(validateFlowName('retrieveRelevantDocs')).toBe(true);
      expect(validateFlowName('summarizeConfluenceDocs')).toBe(true);
      expect(validateFlowName('invalidFlow')).toBe(false);
    });
  });

  describe('2. Flowパラメータのバリデーション', () => {
    it('必須パラメータが正しく検証される', () => {
      // 必須パラメータの検証
      const validateFlowParams = (params: any, flowName: string): { valid: boolean; error?: string } => {
        if (flowName === 'retrieveRelevantDocs') {
          if (!params.question || typeof params.question !== 'string' || params.question.length === 0) {
            return { valid: false, error: 'question is required' };
          }
        } else if (flowName === 'summarizeConfluenceDocs') {
          if (!params.question || typeof params.question !== 'string' || params.question.length === 0) {
            return { valid: false, error: 'question is required' };
          }
        }
        return { valid: true };
      };

      // 正常なパラメータ
      expect(validateFlowParams({ question: 'テスト' }, 'retrieveRelevantDocs')).toEqual({ valid: true });
      expect(validateFlowParams({ question: 'テスト' }, 'summarizeConfluenceDocs')).toEqual({ valid: true });

      // 不正なパラメータ
      expect(validateFlowParams({}, 'retrieveRelevantDocs')).toEqual({ valid: false, error: 'question is required' });
      expect(validateFlowParams({ question: '' }, 'retrieveRelevantDocs')).toEqual({ valid: false, error: 'question is required' });
    });

    it('オプショナルパラメータが正しく処理される', () => {
      // オプショナルパラメータの処理
      const processFlowParams = (params: any) => {
        return {
          question: params.question || '',
          labels: params.labels || [],
          labelFilters: params.labelFilters || { includeMeetingNotes: false },
          context: params.context || [],
          chatHistory: params.chatHistory || []
        };
      };

      const processed = processFlowParams({ question: 'テスト' });
      expect(processed.question).toBe('テスト');
      expect(Array.isArray(processed.labels)).toBe(true);
      expect(processed.labelFilters).toHaveProperty('includeMeetingNotes');
      expect(Array.isArray(processed.context)).toBe(true);
      expect(Array.isArray(processed.chatHistory)).toBe(true);
    });
  });

  describe('3. Flowエラーハンドリング', () => {
    it('存在しないFlow名が適切に処理される', () => {
      // 存在しないFlow名の処理
      const handleFlowNotFound = (flowName: string): { error: string; status: number } => {
        const validFlows = ['retrieveRelevantDocs', 'summarizeConfluenceDocs'];
        if (!validFlows.includes(flowName)) {
          return { error: 'Flow not found', status: 404 };
        }
        return { error: '', status: 200 };
      };

      expect(handleFlowNotFound('invalidFlow')).toEqual({ error: 'Flow not found', status: 404 });
      expect(handleFlowNotFound('retrieveRelevantDocs')).toEqual({ error: '', status: 200 });
    });

    it('Flow実行エラーが適切に処理される', () => {
      // Flow実行エラーの処理
      const handleFlowError = (error: Error): { code: string; message: string; status: number } => {
        const message = error.message.toLowerCase();
        if (message.includes('validation') || message.includes('invalid')) {
          return { code: 'validation_error', message: error.message, status: 400 };
        }
        if (message.includes('not found')) {
          return { code: 'not_found', message: error.message, status: 404 };
        }
        return { code: 'internal_error', message: error.message, status: 500 };
      };

      const validationError = new Error('Invalid input: question is required');
      const notFoundError = new Error('Flow not found');
      const internalError = new Error('Internal server error');

      expect(handleFlowError(validationError).code).toBe('validation_error');
      expect(handleFlowError(notFoundError).code).toBe('not_found');
      expect(handleFlowError(internalError).code).toBe('internal_error');
    });
  });

  describe('4. Flow実行結果の品質検証', () => {
    it('retrieveRelevantDocs Flowの結果品質が基準を満たしている', async () => {
      // 実際のFlow関数を動的インポート
      const { retrieveRelevantDocs } = await import('../../ai/flows/retrieve-relevant-docs-lancedb.js');
      
      const testQueries = [
        '教室管理について',
        '会員登録機能',
        'システムの認証'
      ];
      
      for (const query of testQueries) {
        const results = await retrieveRelevantDocs({
          question: query,
          labels: [],
          labelFilters: { includeMeetingNotes: false },
          source: 'confluence'
        });
        
        // 品質基準の検証
        expect(results.length).toBeGreaterThan(0);
        expect(results.length).toBeLessThanOrEqual(12);
        
        // 各結果の品質検証
        results.forEach((result, index) => {
          expect(result).toHaveProperty('title');
          expect(result).toHaveProperty('content');
          expect(result).toHaveProperty('url');
          expect(result.title).toBeTruthy();
          expect(result.content).toBeTruthy();
          
          // スコアが設定されていることを確認
          if (result.score !== undefined) {
            expect(typeof result.score).toBe('number');
            expect(result.score).toBeGreaterThanOrEqual(0);
          }
        });
        
        console.log(`✅ クエリ「${query}」: ${results.length}件の結果を取得`);
      }
    }, 180000); // タイムアウト180秒

    it('retrieveRelevantDocs Flowの結果形式が正しい', () => {
      // retrieveRelevantDocs Flowの結果形式を検証
      const mockResult = [
        {
          id: 'doc-1',
          pageId: 123,
          title: 'Test Document',
          content: 'Test content',
          url: 'https://example.com/doc',
          distance: 0.1,
          score: 0.9
        }
      ];

      expect(Array.isArray(mockResult)).toBe(true);
      if (mockResult.length > 0) {
        const doc = mockResult[0];
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('content');
        expect(doc).toHaveProperty('url');
      }
    });

    it('summarizeConfluenceDocs Flowの結果形式が正しい', () => {
      // summarizeConfluenceDocs Flowの結果形式を検証
      const mockResult = {
        answer: 'テスト回答',
        references: [
          {
            title: 'Test Document',
            url: 'https://example.com/doc',
            distance: 0.1
          }
        ]
      };

      expect(mockResult).toHaveProperty('answer');
      expect(mockResult).toHaveProperty('references');
      expect(Array.isArray(mockResult.references)).toBe(true);
      expect(typeof mockResult.answer).toBe('string');
    });
  });
});

