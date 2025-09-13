import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import { protos, v1 } from '@google-cloud/aiplatform';

async function readIds(gsUri: string, limit = 5): Promise<string[]> {
  const [, , bucket, ...rest] = gsUri.split('/');
  const filePath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error('GCS file not found: ' + gsUri);
  const stream = file.createReadStream();
  let buf = '';
  const ids: string[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let idx;
      while ((idx = buf.indexOf('\n')) !== -1 && ids.length < limit) {
        const line = buf.slice(0, idx).replace(/^\uFEFF/, '').trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;
        try {
          const o = JSON.parse(line);
          const id: string = o.datapointId || o.id;
          if (id) ids.push(id);
        } catch {}
      }
      if (ids.length >= limit) stream.destroy();
    });
    stream.on('error', reject);
    stream.on('close', () => resolve());
  });
  return ids;
}

async function main() {
  const gsUri = process.argv[2];
  if (!gsUri) {
    console.error('Usage: tsx src/scripts/read-index-datapoints.ts gs://bucket/file.jsonl');
    process.exit(1);
  }
  const indexId = process.env.VERTEX_AI_INDEX_ID as string;
  const location = process.env.VERTEX_AI_LOCATION as string;
  const project = process.env.VERTEX_AI_PROJECT_ID as string;
  if (!indexId || !location || !project) throw new Error('Missing env: VERTEX_AI_INDEX_ID/LOCATION/PROJECT_ID');

  const ids = await readIds(gsUri, 5);
  const client = new v1.IndexServiceClient({ apiEndpoint: `${location}-aiplatform.googleapis.com` });
  const name = `projects/${project}/locations/${location}/indexes/${indexId}`;

  const request: protos.google.cloud.aiplatform.v1.IReadIndexDatapointsRequest = {
    index: name,
    ids,
  };

  const [response] = await client.readIndexDatapoints(request);
  console.log('Requested ids:', ids);
  console.log('Returned datapoints count:', response.datapoints?.length || 0);
  (response.datapoints || []).forEach((dp) => {
    console.log('datapointId:', dp.datapointId);
  });
}

main().catch(e => { console.error(e.message); process.exit(1); });
