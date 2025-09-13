import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';
import { ai } from '@/ai/genkit';

// AIモジュールのモック
vi.mock('@/ai/genkit', () => ({
  ai: {
    embed: vi.fn(),
    generate: vi.fn(),
    defineTool: vi.fn().mockImplementation((config, fn) => fn),
    defineFlow: vi.fn().mockImplementation((config, fn) => fn)
  }
}));

describe('RAG Flow', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('retrieveRelevantDocs', () => {
    it('should retrieve relevant documents based on a question', async () => {
      const mockEmbedding = { embedding: new Array(768).fill(0.1) };
      (ai.embed as any).mockResolvedValueOnce(mockEmbedding);
      
      const question = 'ログイン認証の仕組みはどうなっていますか？';
      const result = await retrieveRelevantDocs({ question });
      
      expect(ai.embed).toHaveBeenCalledWith({
        embedder: 'googleai/text-embedding-004',
        content: question
      });
      
      // モックの実装によって、質問に「ログイン」が含まれる場合は2つのドキュメントを返す
      expect(result).toHaveLength(2);
      expect(result[0].title).toContain('ログイン認証');
    });
    
    it('should return empty array when no relevant documents are found', async () => {
      const mockEmbedding = { embedding: new Array(768).fill(0.1) };
      (ai.embed as any).mockResolvedValueOnce(mockEmbedding);
      
      const question = '存在しない仕様についての質問';
      const result = await retrieveRelevantDocs({ question });
      
      expect(result).toHaveLength(0);
    });
  });
  
  describe('summarizeConfluenceDocs', () => {
    it('should summarize documents based on a question and context', async () => {
      // textをプロパティとしてモックする（メソッドではなく）
      const mockResponse = { text: '要約されたテキスト' };
      (ai.generate as any).mockResolvedValueOnce(mockResponse);
      
      const question = 'ログイン認証の仕組みはどうなっていますか？';
      const context = [
        {
          title: '[AUTH-10] ログイン認証仕様書',
          url: 'https://example.com/auth',
          content: 'ログイン認証の仕様'
        }
      ];
      
      const result = await summarizeConfluenceDocs({ question, context });
      
      expect(ai.generate).toHaveBeenCalledWith({
        model: expect.anything(),
        prompt: expect.any(String),
      });
      
      expect(result.answer).toBe('要約されたテキスト');
      expect(result.references).toHaveLength(1);
      expect(result.references[0].title).toBe('[AUTH-10] ログイン認証仕様書');
    });
    
    it('should return a default message when no context is provided', async () => {
      const question = 'ログイン認証の仕組みはどうなっていますか？';
      const context = [];
      
      const result = await summarizeConfluenceDocs({ question, context });
      
      expect(ai.generate).not.toHaveBeenCalled();
      expect(result.answer).toContain('参考情報の中に関連する記述が見つかりませんでした');
      expect(result.references).toHaveLength(0);
    });
  });
});
