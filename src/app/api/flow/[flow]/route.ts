// src/app/api/flow/[flow]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { summarizeConfluenceDocs } from '@/ai/flows/summarize-confluence-docs';
import { retrieveRelevantDocs } from '@/ai/flows/retrieve-relevant-docs-lancedb';
import { initializeOnStartup } from '@/lib/startup-initializer';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ flow: string }> }
) {
  try {
    // Lunr Indexの初期化を確実に実行
    try {
      await initializeOnStartup();
      console.log('✅ Lunr Index initialization completed in flow API');
    } catch (error) {
      console.warn('⚠️ Lunr Index initialization failed in flow API:', error);
      // 初期化に失敗しても処理は継続
    }

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

