import 'dotenv/config';
import { Storage } from '@google-cloud/storage';
import { v1 } from '@google-cloud/aiplatform';

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
          resolve((o.featureVector || o.embedding) as number[]);
          stream.destroy();
        } catch (e) { reject(e); }
      }
    });
    stream.on('error', reject);
    stream.on('close', () => reject(new Error('No line read')));
  });
}

async function main() {
  const gsUri = process.argv[2];
  if (!gsUri) {
    console.error('Usage: tsx src/scripts/query-neighbors-sdk.ts gs://bucket/file.jsonl');
    process.exit(1);
  }
  const projectId = process.env.VERTEX_AI_PROJECT_ID as string;
  const location = process.env.VERTEX_AI_LOCATION as string;
  const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID as string;
  const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID as string;

  const matchClient = new v1.MatchServiceClient({ apiEndpoint: `${location}-aiplatform.googleapis.com` });
  const endpoint = `projects/${projectId}/locations/${location}/indexEndpoints/${indexEndpointId}`;

  const vec = await readFirstVector(gsUri);

  const request: v1.protos['google.cloud.aiplatform.v1.IFindNeighborsRequest'] = {
    indexEndpoint: endpoint,
    deployedIndexId,
    queries: [{ neighborCount: 5, datapoint: { featureVector: vec } }],
  } as any;

  const [response] = await (matchClient as any).findNeighbors(request);
  const neighbors = response.nearestNeighbors?.[0]?.neighbors || [];
  console.log('Neighbor count:', neighbors.length);
  console.log('Distances:', neighbors.map((n: any) => n.distance));
}

main().catch(e => { console.error(e.message); process.exit(1); });
