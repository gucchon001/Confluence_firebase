import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';

async function main() {
  const srcUri = process.argv[2];
  if (!srcUri || !srcUri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/convert-jsonl-to-json.ts gs://bucket/path/file.jsonl');
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

  const batchDirName = `vector-batch-${Date.now()}`;
  const outName = `data.json`;
  const outLocal = path.resolve('temp', batchDirName, outName);
  fs.mkdirSync(path.dirname(outLocal), { recursive: true });
  const out: any[] = [];

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
          const datapointId = src.datapointId || src.id;
          const featureVector = src.featureVector || src.embedding;
          const restricts = Array.isArray(src.restricts) ? src.restricts : [];
          out.push({ datapointId, featureVector, restricts });
        } catch {}
      }
    });
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });

  fs.writeFileSync(outLocal, JSON.stringify(out), { encoding: 'utf8' });

  // アップロード先はバッチルート配下の data.json
  const destPath = `${batchDirName}/${outName}`;
  await storage.bucket(bucket).upload(outLocal, { destination: destPath });
  const outGsFile = `gs://${bucket}/${destPath}`;
  const outGsDir = `gs://${bucket}/${batchDirName}/`;
  console.log('Converted and uploaded JSON file:', outGsFile);
  console.log('Batch directory:', outGsDir);
}

main().catch(e => { console.error(e.message); process.exit(1); });
