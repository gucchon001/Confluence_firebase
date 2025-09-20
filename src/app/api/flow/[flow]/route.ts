// src/app/api/flow/[flow]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { answerWithRag } from '@/lib/rag-engine';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ flow: string }> }
) {
  try {
    const body = await req.json();
    const params = await context.params;
    const flow = params.flow;

    switch (flow) {
      case 'retrieveRelevantDocs': {
        const { question, labels, labelFilters } = body ?? {};
        if (typeof question !== 'string' || question.length === 0) {
          return NextResponse.json(
            { error: 'Invalid input: question is required' },
            { status: 400 }
          );
        }
        const docs = await retrieveRelevantDocs({ question, labels, labelFilters });
        return NextResponse.json(docs);
      }
      case 'summarizeConfluenceDocs': {
        const result = await summarizeConfluenceDocs(body);
        return NextResponse.json(result);
      }
      case 'answerWithRag': {
        const { question, labelFilters } = body ?? {};
        if (typeof question !== 'string' || question.length === 0) {
          return NextResponse.json(
            { error: 'Invalid input: question is required' },
            { status: 400 }
          );
        }
        const result = await answerWithRag(question, { labelFilters });
        return NextResponse.json(result);
      }
      default:
        return NextResponse.json({ error: 'Flow not found' }, { status: 404 });
    }
  } catch (e: any) {
    console.error('[API Error]', e);
    return NextResponse.json(
      { error: e?.message || 'Internal Error' },
      { status: 500 }
    );
  }
}

