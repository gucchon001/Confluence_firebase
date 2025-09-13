// インデックス一覧表示スクリプト
const {IndexServiceClient} = require('@google-cloud/aiplatform').v1;

async function listIndexes() {
  try {
    const client = new IndexServiceClient({
      apiEndpoint: 'asia-northeast1-aiplatform.googleapis.com'
    });
    const projectId = process.env.VERTEX_AI_PROJECT_ID;
    const location = 'asia-northeast1';
    
    console.log(`Listing indexes for project: ${projectId}, location: ${location}`);
    
    const [indexes] = await client.listIndexes({
      parent: `projects/${projectId}/locations/${location}`
    });
    
    console.log('Indexes:');
    if (indexes.length === 0) {
      console.log('No indexes found');
    } else {
      indexes.forEach(index => {
        console.log(`- Name: ${index.name}`);
        console.log(`  Display Name: ${index.displayName || 'No display name'}`);
        console.log(`  Create Time: ${index.createTime}`);
        console.log('  Metadata:', JSON.stringify(index.metadata || {}, null, 2));
        console.log('---');
      });
    }
  } catch (err) {
    console.error('Error listing indexes:', err);
  }
}

// スクリプト実行
listIndexes();
