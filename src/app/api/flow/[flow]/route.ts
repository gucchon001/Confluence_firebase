// src/app/api/flow/[flow]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { APIErrorHandler, withAPIErrorHandling } from '@/lib/api-error-handler';
import { screenTestLogger } from '@/lib/screen-test-logger';
import { createAPIErrorResponse } from '@/lib/genkit-error-handler';

export const POST = withAPIErrorHandling(async (
  req: NextRequest,
  context: { params: Promise<{ flow: string }> }
) => {
  try {
    // 統一初期化サービスを使用
    await APIErrorHandler.handleUnifiedInitialization();

    const body = await req.json();
    const params = await context.params;
    const flow = params.flow;

    switch (flow) {
      case 'retrieveRelevantDocs': {
        const { question, labels, labelFilters } = body ?? {};
        if (typeof question !== 'string' || question.length === 0) {
          return APIErrorHandler.validationError('Invalid input: question is required');
        }
        const docs = await retrieveRelevantDocs({ question, labels, labelFilters });
        return NextResponse.json(docs);
      }
      case 'summarizeConfluenceDocs': {
        const aiStartTime = performance.now();
        screenTestLogger.info('ai', `AI summarization request: "${body.question}"`, { contextLength: body.context?.length || 0 });
        
        const result = await summarizeConfluenceDocs(body);
        
        const aiEndTime = performance.now();
        const aiTime = aiEndTime - aiStartTime;
        
        screenTestLogger.logAIPerformance(body.question, aiTime, result.answer?.length || 0, {
          contextDocs: body.context?.length || 0,
          answerLength: result.answer?.length || 0,
          references: result.references?.length || 0
        });
        
        return NextResponse.json(result);
      }
      default:
        return APIErrorHandler.notFoundError('Flow not found');
    }
  } catch (error) {
    // Genkitエラーハンドリングを追加（既存のエラーハンドリングと並行動作）
    const genkitErrorResponse = createAPIErrorResponse(
      error,
      'flow-api',
      500,
      { requestId: crypto.randomUUID() }
    );
    
    console.log('[GenkitErrorHandler] Additional error handling applied');
    
    // 既存のエラーハンドリングを優先（段階的移行のため）
    throw error;
  }
});

