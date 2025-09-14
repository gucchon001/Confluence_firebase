import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import path from 'path';

async function main() {
  const srcGs = process.argv[2];
  if (!srcGs || !srcGs.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/convert-batch-to-official-keys.ts gs://bucket/vector-batch-<ts>/data.json');
    process.exit(1);
  }
  const [, , bucket, ...rest] = srcGs.split('/');
  const srcPath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(srcPath);
  const [exists] = await file.exists();
  if (!exists) { console.error('not found:', srcGs); process.exit(1); }

  const [buf] = await file.download();
  const arr = JSON.parse(buf.toString('utf8')) as any[];
  const out = arr.map((o) => ({ id: o.datapointId ?? o.id, embedding: o.featureVector ?? o.embedding, restricts: Array.isArray(o.restricts) ? o.restricts : [] }))
                 .filter((o) => typeof o.id === 'string' && Array.isArray(o.embedding));

  const batchDir = `vector-batch-${Date.now()}`;
  const destPath = `${batchDir}/data.json`;
  await storage.bucket(bucket).file(destPath).save(JSON.stringify(out), { resumable: false, contentType: 'application/json' });
  console.log('Converted file records:', out.length);
  console.log('Output:', `gs://${bucket}/${destPath}`);
  console.log('Batch directory:', `gs://${bucket}/${batchDir}/`);
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });


