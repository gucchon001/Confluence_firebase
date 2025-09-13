import 'dotenv/config';
import { Storage } from '@google-cloud/storage';

async function main() {
  const uri = process.argv[2];
  if (!uri || !uri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/compare-gcs-embeddings.ts gs://bucket/path/file.json');
    process.exit(1);
  }
  const [, , bucket, ...rest] = uri.split('/');
  const filePath = rest.join('/');

  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);

  const [exists] = await file.exists();
  if (!exists) {
    console.error('File not found in GCS:', uri);
    process.exit(1);
  }

  const stream = file.createReadStream();
  let buf = '';
  const lines: string[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1 && lines.length < 5) {
        const line = buf.slice(0, idx).replace(/^\uFEFF/, '').trim();
        buf = buf.slice(idx + 1);
        if (line) lines.push(line);
      }
      if (lines.length >= 5) {
        stream.destroy();
      }
    });
    stream.on('close', () => resolve());
    stream.on('error', reject);
  });

  if (lines.length === 0) {
    console.error('No lines read.');
    process.exit(1);
  }

  const sigs = lines.map((l, i) => {
    const o = JSON.parse(l);
    const vec: number[] = (o.embedding || o.featureVector) as number[];
    if (!Array.isArray(vec)) throw new Error(`Line ${i} has no embedding/featureVector array`);
    const sig = vec.slice(0, 10).map(v => Number((v as number).toFixed(6))).join(',');
    return sig;
  });
  const base = sigs[0];
  sigs.forEach((s, i) => {
    const same = s === base;
    console.log(`Record ${i} sameAs0=${same} first10=${s}`);
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
