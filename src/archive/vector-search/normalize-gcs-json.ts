import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';

function toJsonlLinesFromArray(arr: any[]): string[] {
  return arr
    .map((r) => ({
      id: r.id ?? r.datapointId,
      embedding: r.embedding ?? r.featureVector,
      restricts: Array.isArray(r.restricts) ? r.restricts : [],
    }))
    .filter((o) => typeof o.id === 'string' && Array.isArray(o.embedding))
    .map((o) => JSON.stringify(o));
}

function normalizeJsonlLine(line: string): string | null {
  const t = line.trim();
  if (!t) return null;
  try {
    const obj = JSON.parse(t);
    const id = obj.id ?? obj.datapointId;
    const embedding = obj.embedding ?? obj.featureVector;
    const restricts = Array.isArray(obj.restricts) ? obj.restricts : [];
    if (typeof id !== 'string' || !Array.isArray(embedding)) return null;
    return JSON.stringify({ id, embedding, restricts });
  } catch {
    return null;
  }
}

async function main() {
  const gs = process.argv[2];
  if (!gs || !gs.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/normalize-gcs-json.ts gs://bucket/path/data.json');
    process.exit(1);
  }
  const [, , bucket, ...rest] = gs.split('/');
  const objectPath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(objectPath);
  const [exists] = await file.exists();
  if (!exists) {
    console.error('Not found:', gs);
    process.exit(1);
  }

  const [buf] = await file.download();
  const text = buf.toString('utf8').replace(/^\uFEFF/, '');

  let outLines: string[] = [];
  if (text.trim().startsWith('[')) {
    // JSON 配列 → JSONL
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error('Top-level is not array');
      outLines = toJsonlLinesFromArray(arr);
    } catch (e: any) {
      console.error('Parse error:', e?.message || e);
      process.exit(1);
    }
  } else {
    // 既に JSONL（1行=1オブジェクト）想定。キーを正規化。
    outLines = text
      .split(/\r?\n/)
      .map((ln) => normalizeJsonlLine(ln))
      .filter((ln): ln is string => !!ln);
  }

  const outText = outLines.join('\n');
  await file.save(outText, { contentType: 'application/json', resumable: false, validation: 'crc32c' });
  console.log('Normalized and overwritten:', gs);
  console.log('records:', outLines.length);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});


