import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askQuestion } from '@/app/actions';

// RAG Flowのモック
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';

vi.mock('@/ai/flows/retrieve-relevant-docs-lancedb');
vi.mock('@/ai/flows/summarize-confluence-docs');

describe.skip('Ask Question Action', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    
    // モック実装
    (retrieveRelevantDocs as any).mockImplementation(async ({ question }) => {
      if (question.includes('ログイン')) {
        return [
          {
            title: '[AUTH-10] ログイン認証仕様書',
            url: 'https://example.com/auth',
            content: 'ログイン認証の仕様'
          }
        ];
      }
      return [];
    });

    (summarizeConfluenceDocs as any).mockImplementation(async ({ question, context }) => {
      if (context.length === 0) {
        return {
          summary: '関連する仕様書が見つかりませんでした。',
          sources: []
        };
      }
      
      return {
        summary: `「${question}」に対する回答です。${context[0].title}に基づいた情報です。`,
        sources: context.map(doc => ({ title: doc.title, url: doc.url }))
      };
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should process a question and return a summary with sources', async () => {
    const question = 'ログイン認証の仕組みはどうなっていますか？';
    
    const result = await askQuestion(question);
    
    expect(result.summary).toContain('ログイン認証の仕組み');
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].title).toBe('[AUTH-10] ログイン認証仕様書');
  });
  
  it('should return a message when no relevant docs are found', async () => {
    const question = '存在しない仕様についての質問';
    
    const result = await askQuestion(question);
    
    expect(result.summary).toContain('関連する仕様書が見つかりませんでした');
    expect(result.sources).toHaveLength(0);
  });
  
  it('should throw an error when question is empty', async () => {
    await expect(askQuestion('')).rejects.toThrow('Question is required');
  });
});
