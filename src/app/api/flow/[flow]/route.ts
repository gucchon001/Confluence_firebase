// src/app/api/flow/[flow]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { APIErrorHandler, withAPIErrorHandling } from '@/lib/api-error-handler';

export const POST = withAPIErrorHandling(async (
  req: NextRequest,
  context: { params: Promise<{ flow: string }> }
) => {
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
        const result = await summarizeConfluenceDocs(body);
        return NextResponse.json(result);
      }
      default:
        return APIErrorHandler.notFoundError('Flow not found');
    }
});

