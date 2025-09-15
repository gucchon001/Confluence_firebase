// インデックス統計を表示するユーティリティ
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { IndexServiceClient } = require('@google-cloud/aiplatform').v1;

async function main() {
  const projectId = process.env.VERTEX_AI_PROJECT_ID;
  const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
  const indexId = process.env.VERTEX_AI_INDEX_ID;

  if (!projectId || !indexId) {
    console.error('Missing env: VERTEX_AI_PROJECT_ID or VERTEX_AI_INDEX_ID');
    process.exit(1);
  }

  const client = new IndexServiceClient({
    apiEndpoint: `${location}-aiplatform.googleapis.com`,
  });

  const name = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
  const [index] = await client.getIndex({ name });

  const stats = index.indexStats || {};
  const vectorsCount = stats.vectorsCount?.toString?.() || stats.vectorsCount || '(unknown)';
  const shardsCount = stats.shardsCount?.toString?.() || stats.shardsCount || '(unknown)';

  console.log('name:', index.name);
  console.log('displayName:', index.displayName);
  console.log('vectorsCount:', vectorsCount);
  console.log('shardsCount:', shardsCount);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});


