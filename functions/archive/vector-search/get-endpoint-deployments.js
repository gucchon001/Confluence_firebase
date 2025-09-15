// 指定 IndexEndpoint の配下にデプロイされている ID と紐づく Index を表示
const { IndexEndpointServiceClient } = require('@google-cloud/aiplatform').v1;

async function main() {
  const projectId = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const endpointId = process.env.VERTEX_AI_ENDPOINT_ID || process.argv[2];
  if (!projectId || !endpointId) {
    console.error('Usage: VERTEX_AI_PROJECT_ID, VERTEX_AI_LOCATION, and VERTEX_AI_ENDPOINT_ID (or arg)');
    process.exit(1);
  }
  const apiEndpoint = `${location}-aiplatform.googleapis.com`;
  const client = new IndexEndpointServiceClient({ apiEndpoint });
  const name = `projects/${projectId}/locations/${location}/indexEndpoints/${endpointId}`;
  const [ep] = await client.getIndexEndpoint({ name });
  console.log('ENDPOINT_NAME:', ep.name);
  const deployed = (ep.deployedIndexes || []).map(d => ({ id: d.id, index: d.index }));
  console.log('DEPLOYMENTS:', JSON.stringify(deployed));
}

main().catch((e) => { console.error('Error:', e?.message || e); process.exit(1); });


