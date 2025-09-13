import 'dotenv/config';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';

async function main() {
  const uri = process.argv[2];
  if (!uri || !uri.startsWith('gs://')) {
    console.error('Usage: tsx src/scripts/verify-firestore-vs-gcs.ts gs://bucket/path/file.json');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  const db = admin.firestore();

  const [, , bucket, ...rest] = uri.split('/');
  const filePath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);
  const [exists] = await file.exists();
  if (!exists) {
    console.error('GCS file not found:', uri);
    process.exit(1);
  }

  const stream = file.createReadStream();
  let buf = '';
  const ids: string[] = [];

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1 && ids.length < 10) {
        const line = buf.slice(0, idx).replace(/^\uFEFF/, '').trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const o = JSON.parse(line);
          if (o && o.id) ids.push(o.id);
        } catch {}
      }
      if (ids.length >= 10) stream.destroy();
    });
    stream.on('close', () => resolve());
    stream.on('error', reject);
  });

  console.log('Checking Firestore for IDs:', ids);
  let found = 0;
  for (const id of ids) {
    const snap = await db.collection('chunks').doc(id).get();
    console.log(`id=${id} exists=${snap.exists}`);
    if (snap.exists) found++;
  }
  console.log(`Found ${found}/${ids.length} docs in Firestore.`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
