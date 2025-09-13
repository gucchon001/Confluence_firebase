import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { ai } from '../ai/genkit';

async function main() {
  const outDir = path.resolve(process.cwd(), 'temp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const text = process.argv.slice(2).join(' ') || '最小検証ドキュメント';

  // 768次元の埋め込みを生成
  const emb: any = await ai.embed({ embedder: 'googleai/text-embedding-004', content: text });
  const vec: number[] = (Array.isArray(emb) ? emb[0].embedding : emb.embedding).map(Number);
  const l2 = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  const normalized = vec.map(v => v / l2);

  const id = 'probe-min-1-0';
  const now = new Date().toISOString();

  // contentsDeltaUri で使う自前フォーマット（既存スキーマ互換）
  const recordA = {
    id,
    pageId: 'probe-min-1',
    title: '検証: 最小レコード',
    spaceKey: 'TEST',
    spaceName: '検証',
    url: 'https://example.com/probe',
    lastUpdated: now,
    chunkIndex: 0,
    content: text,
    labels: ['probe'],
    embedding: normalized
  };

  // :import でのMatching Engine推奨に近い形（簡略）
  // 実際のスキーマは index の metadataSchemaUri に準拠
  const recordB = {
    datapoint_id: id,
    feature_vector: normalized,
    metadata: { title: '検証: 最小レコード', spaceKey: 'TEST', labels: ['probe'] }
  } as any;

  const fileA = path.join(outDir, `minimal-contents-${now.replace(/[:.]/g, '-')}.jsonl`);
  const fileB = path.join(outDir, `minimal-import-${now.replace(/[:.]/g, '-')}.jsonl`);

  fs.writeFileSync(fileA, JSON.stringify(recordA) + '\n');
  fs.writeFileSync(fileB, JSON.stringify(recordB) + '\n');

  console.log('Created:', path.basename(fileA));
  console.log('Created:', path.basename(fileB));
}

main().catch((e) => { console.error(e); process.exit(1); });
