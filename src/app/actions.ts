'use server';

import * as z from 'zod';
import { withRetry } from '@/lib/retry-utils';
import { testLogger } from '@/app/login/test-logger';

// ===== [修正点 1] =====
// フローの実際の出力に合わせたZodスキーマを定義
const SummarizeFlowOutputSchema = z.object({
  answer: z.string(),
  references: z.array(z.object({
    title: z.string(),
    url: z.string(),
    spaceName: z.string().optional(),
    lastUpdated: z.string().nullable().optional(),
    distance: z.number().optional(), // 距離（類似度スコア）を追加
    // 検索ソース（vector/keyword/bm25/hybrid）を許容
    source: z.enum(['vector', 'keyword', 'bm25', 'hybrid']).optional(),
    // スコア表示用テキスト
    scoreText: z.string().optional()
  })).default([]),
});

// フロントエンドが期待する最終的な出力形式の型
// Zodスキーマから直接型を推論することで、一貫性を保証します
export type AskQuestionOutput = z.infer<typeof SummarizeFlowOutputSchema>;


const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:9003';

// 汎用的なフロー呼び出し関数 (変更なし)
async function callFlow<T>(flowId: string, input: any): Promise<T> {
  const flowUrl = `${BASE_URL}/api/flow/${flowId}`;
  
  const response = await fetch(flowUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Flow Error: ${flowId}] Server returned an error page:`, errorText);
    throw new Error(`Flow '${flowId}' failed with status ${response.status}.`);
  }

  const result = await response.json();
  return result as T;
}

export async function askQuestion(question: string, chatHistory: any[], labelFilters?: { includeMeetingNotes: boolean; includeArchived: boolean }): Promise<AskQuestionOutput> {
  if (!question) {
    throw new Error('Question is required.');
  }

  const startTime = Date.now();
  testLogger.startTest('askQuestion', question);

  try {
    testLogger.logRagProcess('Calling answerWithRag API', { question, labelFilters });
    
    // スクリプトと同一フロー: answerWithRag を直接呼ぶ
    const rag = await withRetry(
      () => callFlow<any>('answerWithRag', { question, labelFilters }),
      {
        maxRetries: 1,
        onRetry: (error, retryCount, delay) => {
          console.log(`[Retry] answerWithRag (${retryCount}/1) after ${delay}ms due to: ${error.message}`);
          testLogger.log('DEBUG', `Retry ${retryCount}/1`, { error: error.message, delay });
        }
      }
    );

    testLogger.logRagProcess('Received RAG response', { 
      hasSummary: !!rag?.summary, 
      citationsCount: rag?.citations?.length || 0 
    });

    // rag-engine.ts の出力 { summary, bullets, citations } をUI期待形に変換
    const answer = String(rag?.summary || '');
    const references = Array.isArray(rag?.citations)
      ? rag.citations.map((c: any) => ({
          title: c.title,
          url: c.url || '',
          spaceName: c.spaceName || '',
          lastUpdated: c.lastUpdated || null,
          distance: undefined,
          source: c.source || 'vector',
          // スコア表示用（UI側で利用できるよう残す）
          scoreText: c.scoreText
        }))
      : [];

    testLogger.logSearchResults(references);

    // スキーマ検証（安全側）
    const parsed = SummarizeFlowOutputSchema.safeParse({ answer, references });
    if (!parsed.success) {
      console.error('[askQuestion Action Validation Error]', parsed.error.flatten());
      testLogger.logError(new Error('Schema validation failed'), 'askQuestion');
      return { answer, references } as AskQuestionOutput;
    }

    const duration = Date.now() - startTime;
    testLogger.endTest('askQuestion', true, duration);
    
    return parsed.data;

  } catch (error: any) {
    console.error('[askQuestion Action Error]', error);
    testLogger.logError(error, 'askQuestion');
    
    const duration = Date.now() - startTime;
    testLogger.endTest('askQuestion', false, duration);
    
    // 例外ではなく安全なフォールバックを返す（UIエラー抑止）
    return {
      answer: '申し訳ありません。回答の生成に失敗しました。もう一度お試しください。',
      references: []
    } as AskQuestionOutput;
  }
}
