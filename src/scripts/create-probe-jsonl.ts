import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ai } from '../ai/genkit';

async function main() {
  const query = process.argv[2] || '教室登録の仕様について教えてください';
  const outDir = path.resolve(process.cwd(), 'temp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log(`Creating probe JSONL for query: "${query}"`);

  const embedding: any = await ai.embed({
    embedder: 'googleai/text-embedding-004',
    content: query,
  });

  const rawVector: number[] = Array.isArray(embedding) ? embedding[0].embedding : embedding.embedding;
  // Normalize to match query-time normalization
  const norm = Math.sqrt(rawVector.reduce((s, v) => s + Number(v) * Number(v), 0)) || 1;
  const normalized = rawVector.map((v: number) => Number(v) / norm);

  const record = {
    id: 'probe-1',
    pageId: 'probe',
    title: 'probe',
    spaceKey: 'PROBE',
    labels: [] as string[],
    content: query,
    embedding: normalized,
  };

  const fileName = `probe-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(record) + '\n', 'utf8');

  console.log(`Probe JSONL created at ${outPath}`);
  // Print just the file name for downstream scripts
  console.log(fileName);
}

main().catch((e) => {
  console.error('Failed to create probe JSONL:', e);
  process.exit(1);
});


