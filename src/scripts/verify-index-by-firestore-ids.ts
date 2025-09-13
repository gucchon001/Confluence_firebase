import 'dotenv/config';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { ai } from '../ai/genkit';

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

async function embedTextL2(text: string): Promise<number[]> {
  const embedding: any = await ai.embed({ embedder: 'googleai/text-embedding-004', content: text.slice(0, 8000) });
  const raw = Array.isArray(embedding) ? embedding[0].embedding : embedding.embedding;
  const norm = Math.sqrt(raw.reduce((s: number, v: number) => s + (Number(v) ** 2), 0)) || 1;
  return raw.map((v: number) => Number(v) / norm);
}

async function findNeighbors(vec: number[]) {
  const project = process.env.VERTEX_AI_PROJECT_ID as string;
  const location = process.env.VERTEX_AI_LOCATION as string;
  const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID as string;
  const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID as string;
  const publicEndpoint = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN as string;
  const url = `https://${publicEndpoint}/v1/projects/${process.env.VERTEX_AI_NUMERIC_PROJECT_ID}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
  const body = { deployedIndexId, queries: [{ neighborCount: 3, datapoint: { featureVector: vec } }] };
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const resp = await axios.post(url, body, { headers: { Authorization: `Bearer ${token.token || token}` } });
  return resp.data.nearestNeighbors?.[0]?.neighbors || [];
}

async function main() {
  const ids = process.argv.slice(2);
  let targetIds: string[] = ids;
  if (targetIds.length === 0) {
    const snap = await admin.firestore().collection('chunks').limit(10).get();
    targetIds = snap.docs.map((d) => (d.data().id as string)).filter(Boolean);
  }
  console.log('Verifying ids:', targetIds);

  const results: { id: string; ok: boolean; topId?: string; distance?: number }[] = [];
  for (const id of targetIds) {
    const doc = await admin.firestore().collection('chunks').doc(id).get();
    if (!doc.exists) { results.push({ id, ok: false }); continue; }
    const content = (doc.data() as any)?.content || '';
    const vec = await embedTextL2(content);
    const neighbors = await findNeighbors(vec);
    const top = neighbors[0];
    const topId = top?.datapoint?.datapointId;
    const ok = topId === id;
    results.push({ id, ok, topId, distance: top?.distance });
    console.log(`- ${id} => top=${topId} dist=${top?.distance} ${ok ? 'OK' : 'MISMATCH'}`);
  }

  const okCount = results.filter(r => r.ok).length;
  console.log(`Summary: ${okCount}/${results.length} matched`);
}

main().catch((e) => { console.error('Error:', e?.response?.data || e?.message || e); process.exit(1); });


