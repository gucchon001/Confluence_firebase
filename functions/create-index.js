// 検証用インデックス作成スクリプト（本番と同設定）
const { IndexServiceClient } = require('@google-cloud/aiplatform').v1;

async function main() {
  const projectId = process.env.VERTEX_AI_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const displayName = process.env.NEW_INDEX_DISPLAY_NAME || `confluence-embeddings-test-${Date.now()}`;

  if (!projectId) {
    console.error('Missing project id in env VERTEX_AI_PROJECT_ID or GOOGLE_CLOUD_PROJECT');
    process.exit(1);
  }

  const client = new IndexServiceClient({ apiEndpoint: `${location}-aiplatform.googleapis.com` });

  const parent = `projects/${projectId}/locations/${location}`;
  const index = {
    displayName,
    metadataSchemaUri:
      'gs://google-cloud-aiplatform/schema/matchingengine/metadata/nearest_neighbor_search_1.0.0.yaml',
    metadata: {
      config: {
        dimensions: 768,
        distanceMeasureType: 'DOT_PRODUCT_DISTANCE',
        featureNormType: 'UNIT_L2_NORM',
        algorithmConfig: { treeAhConfig: { leafNodeEmbeddingCount: '1000', fractionLeafNodesToSearch: 0.05 } },
        shardSize: 'SHARD_SIZE_MEDIUM',
      },
    },
    indexUpdateMethod: 'BATCH_UPDATE',
  };

  console.log('Creating index with displayName:', displayName);
  const [operation] = await client.createIndex({ parent, index });
  const [response] = await operation.promise();
  console.log('Index created:', response.name);
  const id = response.name.split('/').pop();
  console.log('INDEX_ID:', id);
}

main().catch((e) => { console.error('Error:', e.message || e); process.exit(1); });


