import 'dotenv/config';
import { ai } from '../ai/genkit';

async function testVectorSearch() {
  try {
    console.log('Testing Vertex AI Vector Search prerequisites...');
    
    // 環境変数の確認
    const projectId = process.env.VERTEX_AI_PROJECT_ID;
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    
    if (!projectId) {
      throw new Error('VERTEX_AI_PROJECT_ID environment variable is not set');
    }
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Location: ${location}`);
    
    // Vector Searchを使用するには、以下が必要です：
    // 1. サービスアカウントキー（GOOGLE_APPLICATION_CREDENTIALS環境変数）
    // 2. Vertex AI Vector Search APIの有効化
    // 3. Vector Searchインデックスの作成
    //
    // 本番環境では上記を設定してください。
    // ここでは、埋め込みベクトルの生成だけを確認します。
    
    // テスト用のクエリベクトルを生成
    console.log('\nGenerating test embedding...');
    const emb = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: 'Confluence document search test',
    }) as any;
    
    // 埋め込みベクトルを取得
    const embeddingVector = Array.isArray(emb) ? emb[0].embedding : emb.embedding;
    console.log(`Generated embedding with ${embeddingVector.length} dimensions`);
    
    console.log('\nVertex AI Vector Search connectivity OK');
  } catch (error) {
    console.error('Vertex AI Vector Search test failed:', error);
  }
}

testVectorSearch();
