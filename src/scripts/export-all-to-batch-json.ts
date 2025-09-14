import 'dotenv/config';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import path from 'path';

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

type ChunkDoc = {
  id: string;
  embedding?: number[];
  featureVector?: number[];
  restricts?: any[];
};

async function main() {
  const bucket = process.env.VERTEX_AI_STORAGE_BUCKET as string;
  if (!bucket) {
    console.error('VERTEX_AI_STORAGE_BUCKET is not set');
    process.exit(1);
  }

  const batchDir = `vector-batch-${Date.now()}`;
  const objectName = `${batchDir}/data.json`;

  console.log(`[export] Reading all chunk docs from Firestore...`);
  const db = admin.firestore();
  const snapshot = await db.collection('chunks').get();
  console.log(`[export] chunks: ${snapshot.size}`);

  const out: any[] = [];
  snapshot.forEach((doc) => {
    const d = doc.data() as ChunkDoc;
    const datapointId = d.id || doc.id;
    const featureVector = d.featureVector || d.embedding;
    const restricts = Array.isArray(d.restricts) ? d.restricts : [];
    if (datapointId && Array.isArray(featureVector)) {
      out.push({ datapointId, featureVector, restricts });
    }
  });

  console.log(`[export] valid records: ${out.length}`);
  const storage = new Storage();
  const tmpLocal = path.resolve('temp', batchDir, 'data.json');
  await storage.bucket(bucket).file(objectName).save(JSON.stringify(out), { resumable: false, contentType: 'application/json' });
  const gsUri = `gs://${bucket}/${objectName}`;
  console.log(`[export] Uploaded: ${gsUri}`);
  console.log(`[export] Batch directory: gs://${bucket}/${batchDir}/`);
}

main().catch((e) => { console.error(e?.message || e); process.exit(1); });


