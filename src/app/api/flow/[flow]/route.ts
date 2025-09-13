// src/app/api/flow/[flow]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs';

export async function POST(
  req: NextRequest,
  { params }: { params: { flow: string } }
) {
  try {
    const body = await req.json();

    switch (params.flow) {
      case 'retrieveRelevantDocs': {
        const { question } = body ?? {};
        if (typeof question !== 'string' || question.length === 0) {
          return NextResponse.json(
            { error: 'Invalid input: question is required' },
            { status: 400 }
          );
        }
        const docs = await retrieveRelevantDocs({ question });
        return NextResponse.json(docs);
      }
      case 'summarizeConfluenceDocs': {
        const result = await summarizeConfluenceDocs(body);
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

