import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/ai/genkit';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (typeof text !== 'string' || text.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: text is required' },
        { status: 400 }
      );
    }

    const res = await ai.embed({ embedder: 'googleai/text-embedding-004', value: text });
    // res can be an array or single depending on runtime; normalize to number[]
    const vector = Array.isArray(res)
      ? (res[0] as any).embedding
      : (res as any).embedding;

    if (!Array.isArray(vector)) {
      return NextResponse.json(
        { error: 'Embedding generation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ embedding: vector });
  } catch (e: any) {
    console.error('[generate-embedding] Error', e);
    return NextResponse.json(
      { error: e?.message || 'Internal Error' },
      { status: 500 }
    );
  }
}
