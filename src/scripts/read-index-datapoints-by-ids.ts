import 'dotenv/config';
import { protos, v1 } from '@google-cloud/aiplatform';

async function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) {
    console.error('Usage: tsx src/scripts/read-index-datapoints-by-ids.ts <id1> <id2> ...');
    process.exit(1);
  }

  const location = process.env.VERTEX_AI_LOCATION as string;
  const project = process.env.VERTEX_AI_PROJECT_ID as string;
  const indexId = process.env.VERTEX_AI_INDEX_ID as string;
  if (!location || !project || !indexId) {
    throw new Error('Missing env: VERTEX_AI_LOCATION / VERTEX_AI_PROJECT_ID / VERTEX_AI_INDEX_ID');
  }

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
    const vec = dp.featureVector || [];
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    console.log(`- ${dp.datapointId} | dims=${vec.length} | L2=${norm.toFixed(4)}`);
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); });


