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
    lastUpdated: z.string().nullable().optional(),
    distance: z.number().optional(), // 距離（類似度スコア）を追加
    source: z.enum(['vector', 'keyword']).optional() // 検索ソース（vector/keyword）を追加
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

  try {
    // 1. ドキュメントを検索 (リトライ付き) (変更なし)
    const relevantDocs = await withRetry(
      () => callFlow<any[]>('retrieveRelevantDocs', { question, labelFilters }),
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
    // レスポンス構造を確認してログに出力
    console.log('[askQuestion Action] Raw response structure:', JSON.stringify(summaryResponse, null, 2));
    
    // レスポンスの詳細をログ出力
    if (summaryResponse && summaryResponse.references) {
      console.log('[askQuestion Action] References details:');
      summaryResponse.references.forEach((ref: any, idx: number) => {
        console.log(`[askQuestion Action] Reference ${idx+1}: title=${ref.title}, source=${ref.source}`);
      });
    }

    // sourcesをreferencesに変換（必要な場合）
    if (summaryResponse && summaryResponse.sources && !summaryResponse.references) {
      summaryResponse.references = summaryResponse.sources;
      delete summaryResponse.sources;
    }

    // 修正したZodスキーマでレスポンスを検証
    const parsedResult = SummarizeFlowOutputSchema.safeParse(summaryResponse);

    if (!parsedResult.success) {
      console.error('[askQuestion Action Validation Error]', parsedResult.error.flatten());
      
      // 検証に失敗した場合、最小限の構造を返す
      const fallbackAnswer = summaryResponse.answer || '回答の取得に失敗しました。';
      const fallbackReferences = summaryResponse.references || summaryResponse.sources || [];
      
      console.log('[askQuestion Action] Using fallback response:', {
        answer: fallbackAnswer,
        referencesCount: fallbackReferences.length
      });
      
      return {
        answer: fallbackAnswer,
        references: fallbackReferences
      };
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
