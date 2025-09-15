import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

async function embed(text: string): Promise<number[]> {
  // 簡易: 将来的に local/vertex 切替を導入
  const { ai } = await import('../../../ai/genkit');
  const out: any = await ai.embed({ embedder: 'googleai/text-embedding-004', content: text });
  const vec = Array.isArray(out) ? out[0].embedding : out.embedding;
  const n = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0)) || 1;
  return vec.map((v: number) => v / n);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 5;
    const filters: Record<string, string | string[]> | undefined = body?.filters;
    if (!query) return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });

    const vec = await embed(query);
    const db = await lancedb.connect('.lancedb');
    const tbl = await db.openTable('confluence');

    let q = tbl.search(vec).limit(topK);
    if (filters) {
      const clauses: string[] = [];
      for (const [k, v] of Object.entries(filters)) {
        if (Array.isArray(v)) clauses.push(`${k} IN (${v.map((x) => `'${x}'`).join(',')})`);
        else clauses.push(`${k} = '${v}'`);
      }
      if (clauses.length) q = q.where(clauses.join(' AND '));
    }
    const res = await q.execute();
    const ids = res.map((r: any) => r.id);

    const docs = await Promise.all(
      ids.map(async (id: string) => {
        const snap = await admin.firestore().collection('chunks').doc(id).get();
        return { id, distance: 0, ...(snap.exists ? snap.data() : {}) };
      })
    );

    return new Response(JSON.stringify({ results: docs }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}


