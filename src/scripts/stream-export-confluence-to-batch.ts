import 'dotenv/config';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import { Storage } from '@google-cloud/storage';
import * as admin from 'firebase-admin';
import { getAllSpaceContent } from '@/lib/confluence-client';

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

function chunkText(text: string, maxChunkSize: number = Number(process.env.CHUNK_SIZE || 1000)): string[] {
  if (!text) return [];
  if (text.length <= maxChunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  let end = maxChunkSize;
  while (start < text.length) {
    if (end < text.length) {
      const lastPeriod = text.substring(start, end).lastIndexOf('。');
      if (lastPeriod !== -1) end = start + lastPeriod + 1;
    }
    chunks.push(text.substring(start, end));
    start = end;
    end = Math.min(text.length, start + maxChunkSize);
  }
  return chunks.filter(Boolean);
}

async function getAccessToken(): Promise<string> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token || !token.token) throw new Error('Failed to obtain access token');
  return token.token as string;
}

async function embed(content: string, projectId: string, location: string, token: string): Promise<number[]> {
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`;
  const resp = await axios.post(url, { instances: [{ content }] }, { headers: { Authorization: `Bearer ${token}` } });
  return resp.data.predictions[0].embeddings.values as number[];
}

async function main() {
  const projectId = process.env.VERTEX_AI_PROJECT_ID as string;
  const location = process.env.VERTEX_AI_LOCATION as string;
  const bucket = process.env.VERTEX_AI_STORAGE_BUCKET as string;
  const spaceKey = process.env.CONFLUENCE_SPACE_KEY as string;
  if (!projectId || !location || !bucket || !spaceKey) {
    console.error('Missing env: VERTEX_AI_PROJECT_ID / VERTEX_AI_LOCATION / VERTEX_AI_STORAGE_BUCKET / CONFLUENCE_SPACE_KEY');
    process.exit(1);
  }

  const batchDir = `vector-batch-${Date.now()}`;
  const objectName = `${batchDir}/data.json`;
  const storage = new Storage();
  const file = storage.bucket(bucket).file(objectName);
  const ws = file.createWriteStream({ contentType: 'application/json' });

  console.log(`[export] Start stream export → gs://${bucket}/${objectName}`);
  const token = await getAccessToken();
  const pages = await getAllSpaceContent(spaceKey, 'page');
  console.log(`[export] pages: ${pages.length}`);
  const limit = process.env.PAGE_LIMIT ? parseInt(process.env.PAGE_LIMIT, 10) : undefined;
  const target = limit ? pages.slice(0, limit) : pages;

  let first = true;
  let produced = 0;
  ws.write('[');
  for (const page of target) {
    const pageId: string = page.id;
    const title: string = page.title;
    const html: string = page.body?.storage?.value || '';
    const text = html
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const chunks = chunkText(text);
    console.log(`[export] ${title} (${pageId}) chunks=${chunks.length}`);
    for (let i = 0; i < chunks.length; i++) {
      const vec = await embed(chunks[i], projectId, location, token);
      const rec = { datapointId: `${pageId}-${i}`, featureVector: vec, restricts: [] as any[] };
      const json = JSON.stringify(rec);
      if (!first) ws.write(',');
      ws.write(json);
      first = false;
      produced++;
      if (produced % 50 === 0) console.log(`[export] produced: ${produced}`);
    }
  }
  ws.write(']');
  await new Promise<void>((resolve, reject) => {
    ws.end(() => resolve());
    ws.on('error', reject);
  });
  console.log(`[export] Completed. records=${produced}`);
  console.log(`[export] Batch directory: gs://${bucket}/${batchDir}/`);
}

main().catch((e) => { console.error('Error:', e?.response?.data || e?.message || e); process.exit(1); });


