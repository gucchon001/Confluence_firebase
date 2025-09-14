import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const srcGs = process.argv[2];
  const count = Number(process.argv[3] || 10);
  if (!srcGs || !srcGs.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/make-mini-batch.ts gs://bucket/path/data.json [count=10]');
    process.exit(1);
  }
  const [, , bucket, ...rest] = srcGs.split('/');
  const filePath = rest.join('/');
  const baseDir = path.posix.dirname(filePath);
  const batchDir = `mini-batch-${Date.now()}`;
  const destPath = `${baseDir}/${batchDir}/data.json`;

  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);
  const [buf] = await file.download();
  const arr = JSON.parse(buf.toString('utf8')) as any[];
  const sliced = arr.slice(0, count).map((r) => ({ id: r.id ?? r.datapointId, embedding: r.embedding ?? r.featureVector, restricts: r.restricts || [] }));

  const local = path.resolve('temp', 'mini-data.json');
  fs.mkdirSync(path.dirname(local), { recursive: true });
  fs.writeFileSync(local, JSON.stringify(sliced));

  await storage.bucket(bucket).upload(local, { destination: destPath, contentType: 'application/json' });
  const outFolder = `gs://${bucket}/${baseDir}/${batchDir}/`;
  console.log('Mini batch folder:', outFolder);
  console.log('records:', sliced.length);
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });


