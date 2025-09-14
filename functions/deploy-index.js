// 検証用エンドポイントを作成し、新規インデックスをデプロイ
const { IndexEndpointServiceClient } = require('@google-cloud/aiplatform').v1;

async function main() {
  const projectId = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const indexId = process.env.TEST_INDEX_ID; // 必須: 2764...
  const displayName = process.env.NEW_ENDPOINT_DISPLAY_NAME || `confluence-endpoint-test-${Date.now()}`;
  if (!projectId || !indexId) {
    console.error('Missing env: VERTEX_AI_PROJECT_ID and TEST_INDEX_ID');
    process.exit(1);
  }
  const apiEndpoint = `${location}-aiplatform.googleapis.com`;
  const client = new IndexEndpointServiceClient({ apiEndpoint });
  const parent = `projects/${projectId}/locations/${location}`;

  console.log('Creating indexEndpoint:', displayName);
  const [opCreate] = await client.createIndexEndpoint({ parent, indexEndpoint: { displayName } });
  const [endpoint] = await opCreate.promise();
  console.log('Endpoint created:', endpoint.name);

  const endpointName = endpoint.name;
  const deployedIndexId = `dep_${Date.now()}`;
  const indexName = `projects/${projectId}/locations/${location}/indexes/${indexId}`;

  console.log('Deploying index:', indexName, 'to', endpointName);
  const [opDeploy] = await client.deployIndex({
    indexEndpoint: endpointName,
    deployedIndex: {
      index: indexName,
      id: deployedIndexId,
      dedicatedResources: { minReplicaCount: 1, maxReplicaCount: 1, machineSpec: { machineType: 'e2-standard-16' } },
    },
  });
  const [deployResp] = await opDeploy.promise();
  console.log('DeployedIndex:', deployResp.deployedIndex?.id);
  console.log('ENDPOINT_ID:', endpointName.split('/').pop());
  console.log('DEPLOYED_INDEX_ID:', deployResp.deployedIndex?.id);
}

main().catch((e) => { console.error('Error:', e?.message || e); process.exit(1); });


