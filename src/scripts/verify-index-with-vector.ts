import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

async function readFirstVectorFromArrayJson(gsUri: string): Promise<number[]> {
  const [, , bucket, ...rest] = gsUri.split('/');
  const filePath = rest.join('/');
  const storage = new Storage();
  const file = storage.bucket(bucket).file(filePath);
  const [exists] = await file.exists();
  if (!exists) throw new Error('GCS file not found: ' + gsUri);
  const [buf] = await file.download();
  const arr = JSON.parse(buf.toString('utf8')) as any[];
  const vec = (arr[0]?.featureVector || arr[0]?.embedding) as number[];
  if (!Array.isArray(vec)) throw new Error('No vector found in first element');
  return vec;
}

async function findNeighbors(vec: number[]) {
  const project = process.env.VERTEX_AI_PROJECT_ID as string;
  const location = process.env.VERTEX_AI_LOCATION as string;
  const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID as string;
  const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID as string;
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
  const body = { deployedIndexId, queries: [{ neighborCount: 5, datapoint: { featureVector: vec } }] };
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const resp = await axios.post(url, body, { headers: { Authorization: `Bearer ${token.token || token}` } });
  return resp.data;
}

async function main() {
  const gsUri = process.argv[2];
  if (!gsUri) {
    console.error('Usage: tsx src/scripts/verify-index-with-vector.ts gs://bucket/vector-batch-<ts>/data.json');
    process.exit(1);
  }
  const vec = await readFirstVectorFromArrayJson(gsUri);
  console.log('Vector dims:', vec.length);
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  console.log('Vector L2 norm:', norm.toFixed(6));
  const result = await findNeighbors(vec);
  const neighbors = result.nearestNeighbors?.[0]?.neighbors || [];
  console.log('Neighbor count:', neighbors.length);
  neighbors.forEach((n: any, i: number) => {
    console.log(`#${i + 1} id=${n.datapoint?.datapointId} dist=${n.distance}`);
  });
}

main().catch(e => { console.error('Error:', e?.response?.data || e?.message || e); process.exit(1); });


