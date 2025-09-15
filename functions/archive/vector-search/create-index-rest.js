// RESTで検証用インデックスを作成（BATCH_UPDATE, 768, DOT_PRODUCT, UNIT_L2）
const axios = require('axios');
const { GoogleAuth } = require('google-auth-library');

async function waitOperation(opName, token, apiEndpoint) {
  for (;;) {
    const { data } = await axios.get(`https://${apiEndpoint}/v1/${opName}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (data.done) return data;
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function main() {
  const projectId = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const displayName = process.env.NEW_INDEX_DISPLAY_NAME || `confluence-embeddings-test-${Date.now()}`;
  if (!projectId) {
    console.error('Missing project id in env');
    process.exit(1);
  }
  const apiEndpoint = `${location}-aiplatform.googleapis.com`;
  const url = `https://${apiEndpoint}/v1/projects/${projectId}/locations/${location}/indexes`;

  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const client = await auth.getClient();
  const tokenObj = await client.getAccessToken();
  const token = tokenObj.token || tokenObj;

  const body = {
    displayName,
    metadataSchemaUri:
      'gs://google-cloud-aiplatform/schema/matchingengine/metadata/nearest_neighbor_search_1.0.0.yaml',
    metadata: {
      config: {
        dimensions: 768,
        approximateNeighborsCount: 10,
        distanceMeasureType: 'DOT_PRODUCT_DISTANCE',
        featureNormType: 'UNIT_L2_NORM',
        algorithmConfig: { treeAhConfig: { leafNodeEmbeddingCount: '1000', fractionLeafNodesToSearch: 0.05 } },
        shardSize: 'SHARD_SIZE_MEDIUM',
      },
    },
    indexUpdateMethod: 'BATCH_UPDATE',
  };

  console.log('Creating index via REST:', displayName);
  const { data: op } = await axios.post(url, body, { headers: { Authorization: `Bearer ${token}` } });
  const done = await waitOperation(op.name, token, apiEndpoint);
  if (done.error) {
    console.error('Create failed:', done.error);
    process.exit(1);
  }
  const indexName = done.response?.name || done.response?.index || done.response;
  console.log('Index created:', indexName);
  const id = String(indexName).split('/').pop();
  console.log('INDEX_ID:', id);
}

main().catch((e) => { console.error('Error:', e?.response?.data || e?.message || e); process.exit(1); });


