import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

async function readFirstVector(gsUri: string): Promise<number[]> {
  const [, , bucket, ...rest] = gsUri.split('/');
  const filePath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error('GCS file not found: ' + gsUri);

  const stream = file.createReadStream();
  let buf = '';
  return await new Promise((resolve, reject) => {
    stream.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      const idx = buf.indexOf('\n');
      if (idx !== -1) {
        const line = buf.slice(0, idx).replace(/^\uFEFF/, '').trim();
        try {
          const o = JSON.parse(line);
          const vec: number[] = o.featureVector || o.embedding;
          resolve(vec);
          stream.destroy();
        } catch (e) {
          reject(e);
        }
      }
    });
    stream.on('error', reject);
    stream.on('close', () => reject(new Error('No line read')));
  });
}

async function findNeighbors(vec: number[]) {
  const project = process.env.VERTEX_AI_PROJECT_ID as string;
  const location = process.env.VERTEX_AI_LOCATION as string;
  const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID as string;
  const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID as string;
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
  const body = {
    deployedIndexId,
    queries: [{ neighborCount: 5, datapoint: { featureVector: vec } }]
  };
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const resp = await axios.post(url, body, { headers: { Authorization: `Bearer ${token.token || token}` } });
  return resp.data;
}

async function main() {
  const gsUri = process.argv[2];
  if (!gsUri) {
    console.error('Usage: tsx src/scripts/check-index-has-datapoint.ts gs://bucket/file.jsonl');
    process.exit(1);
  }
  const vec = await readFirstVector(gsUri);
  const data = await findNeighbors(vec);
  const neighbors = data.nearestNeighbors?.[0]?.neighbors || [];
  console.log('Neighbor count:', neighbors.length);
  console.log('Distances:', neighbors.map((n: any) => n.distance));
}

main().catch(e => { console.error(e.message); process.exit(1); });
