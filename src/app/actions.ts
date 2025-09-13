'use server';

import * as z from 'zod';
import { withRetry } from '@/lib/retry-utils';

// ===== [修正点 1] =====
// フローの実際の出力に合わせたZodスキーマを定義
const SummarizeFlowOutputSchema = z.object({
  answer: z.string(),
  references: z.array(z.object({
    title: z.string(),
    url: z.string(),
    spaceName: z.string().optional(),
    lastUpdated: z.string().optional()
  })).default([]),
});

// フロントエンドが期待する最終的な出力形式の型
// Zodスキーマから直接型を推論することで、一貫性を保証します
export type AskQuestionOutput = z.infer<typeof SummarizeFlowOutputSchema>;


const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:9002';

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

export async function askQuestion(question: string, chatHistory: any[]): Promise<AskQuestionOutput> {
  if (!question) {
    throw new Error('Question is required.');
  }

  try {
    // 1. ドキュメントを検索 (リトライ付き) (変更なし)
    const relevantDocs = await withRetry(
      () => callFlow<any[]>('retrieveRelevantDocs', { question }),
      {
        maxRetries: 2,
        onRetry: (error, retryCount, delay) => {
          console.log(`[Retry] Retrieving documents (${retryCount}/2) after ${delay}ms due to: ${error.message}`);
        }
      }
    );

    // 2. ドキュメントを要約 (変更なし)
    // 修正された 'summarizeConfluenceDocs' フローを呼び出す
    const summaryResponse = await callFlow<any>(
      'summarizeConfluenceDocs', 
      { question, context: relevantDocs, chatHistory }
    );

    // ===== [修正点 2] =====
    // 修正したZodスキーマでレスポンスを検証
    const parsedResult = SummarizeFlowOutputSchema.safeParse(summaryResponse);

    if (!parsedResult.success) {
      console.error('[askQuestion Action Validation Error]', parsedResult.error.flatten());
      throw new Error('Invalid response structure from the summarize flow.');
    }
    
    // ===== [修正点 3] =====
    // 検証済みのデータをそのまま返す (型はAskQuestionOutputと一致)
    return parsedResult.data;

  } catch (error: any) {
    console.error('[askQuestion Action Error]', error);
    
    // 構造化されたエラーを返す (変更なし)
    const structuredError = {
      error: {
        code: 'flow_execution_error',
        message: error.message || 'An unknown error occurred in the askQuestion action.'
      }
    };
    
    throw new Error(JSON.stringify(structuredError));
  }
}
