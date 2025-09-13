import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

async function main() {
  const srcUri = process.argv[2];
  if (!srcUri || !srcUri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/convert-gcs-to-prod.ts gs://bucket/path/file.json');
    process.exit(1);
  }
  const [, , bucket, ...rest] = srcUri.split('/');
  const srcPath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(srcPath);
  const [exists] = await file.exists();
  if (!exists) {
    console.error('Source file not found:', srcUri);
    process.exit(1);
  }

  const outName = `vector-prod-${Date.now()}.jsonl`;
  const outLocal = path.resolve('temp', outName);
  fs.mkdirSync(path.dirname(outLocal), { recursive: true });
  const out = fs.createWriteStream(outLocal, { encoding: 'utf8' });

  const stream = file.createReadStream();
  let buf = '';
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, idx).replace(/^\uFEFF/, '').trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const src = JSON.parse(line);
          const datapointId = src.id || src.datapointId;
          const featureVector = src.embedding || src.featureVector;
          const restricts = Array.isArray(src.restricts) ? src.restricts : [];
          const converted = { datapointId, featureVector, restricts };
          out.write(JSON.stringify(converted) + '\n');
        } catch {}
      }
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  out.end();

  // Upload converted file to bucket root
  await storage.bucket(bucket).upload(outLocal, { destination: path.basename(outLocal) });
  const outGs = `gs://${bucket}/${path.basename(outLocal)}`;
  console.log('Converted and uploaded:', outGs);
}

main().catch(e => { console.error(e.message); process.exit(1); });
