import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import * as path from 'path';
import * as fs from 'fs';

async function main() {
  const srcGs = process.argv[2];
  const shards = Number(process.argv[3] || 10);
  if (!srcGs || !srcGs.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/split-gcs-batch-into-shards.ts gs://bucket/path/data.json [shards=10]');
    process.exit(1);
  }
  const [, , bucket, ...rest] = srcGs.split('/');
  const filePath = rest.join('/');
  const baseDir = path.posix.dirname(filePath); // vector-batch-*/

  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    console.error('GCS file not found:', srcGs);
    process.exit(1);
  }
  const [buf] = await file.download();
  const arr = JSON.parse(buf.toString('utf8')) as any[];
  const n = arr.length;
  const per = Math.ceil(n / shards);

  console.log(`source records: ${n}`);
  console.log(`writing ${shards} shards, ~${per} per shard`);

  const outUris: string[] = [];
  for (let s = 0; s < shards; s += 1) {
    const start = s * per;
    if (start >= n) break;
    const end = Math.min(start + per, n);
    const slice = arr.slice(start, end).map((r) => ({ id: r.id ?? r.datapointId, embedding: r.embedding ?? r.featureVector, restricts: r.restricts || [] }));

    const local = path.resolve('temp', `shard-${s}.json`);
    fs.mkdirSync(path.dirname(local), { recursive: true });
    fs.writeFileSync(local, JSON.stringify(slice));

    const dest = `${baseDir}/shards/shard-${s}.json`;
    await storage.bucket(bucket).upload(local, { destination: dest });
    const uri = `gs://${bucket}/${dest}`;
    outUris.push(uri);
    console.log(`shard ${s}: ${uri} (${slice.length})`);
  }

  const shardFolder = `gs://${bucket}/${baseDir}/shards/`;
  console.log('Shard folder:', shardFolder);
  console.log('Shard files:', outUris.length);
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });


