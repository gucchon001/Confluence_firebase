import 'dotenv/config';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import { ai } from '../ai/genkit';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * 新しいVector Search APIでクエリを実行する
 */
async function searchVectorIndex(queryText: string, filters?: { [key: string]: string | string[] }): Promise<any> {
  try {
    console.log(`Searching Vector Search index for query: "${queryText}"`);
    
    // 環境変数の確認
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
    const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
    const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Numeric Project ID: ${numericProjectId}`);
    console.log(`Index Endpoint ID: ${indexEndpointId}`);
    console.log(`Deployed Index ID: ${deployedIndexId}`);
    console.log(`Location: ${location}`);
    
    // クエリテキストの埋め込みベクトルを生成
    console.log('Generating embedding for query text...');
    const embedding = await ai.embed({
      embedder: 'googleai/text-embedding-004',
      content: queryText,
    }) as any;
    
    const rawVector = Array.isArray(embedding) 
      ? embedding[0].embedding 
      : embedding.embedding;
    // DOT_PRODUCT_DISTANCE 対応のため正規化
    const norm = Math.sqrt(rawVector.reduce((s: number, v: number) => s + (Number(v) ** 2), 0)) || 1;
    const embeddingVector = rawVector.map((v: number) => Number(v) / norm);
    
    console.log(`Generated embedding with ${embeddingVector.length} dimensions`);
    
    // 認証トークンを取得
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    if (!token || !token.token) {
      throw new Error("Failed to get access token");
    }
    
    console.log('Successfully obtained access token');
    
    // フィルターの構築
    const restricts: any[] = [];
    
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        const allowList = Array.isArray(value) ? value : [value];
        restricts.push({
          namespace: key,
          allow_list: allowList
        });
      }
    }
    
    // Vector Search APIのエンドポイント（publicEndpointDomainName を使用）
    const publicEndpointDomainName = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || '663364514.asia-northeast1-122015916118.vdb.vertexai.goog';
    const apiEndpoint = `https://${publicEndpointDomainName}/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
    
    // リクエストボディ
    const requestBody = {
      deployedIndexId: deployedIndexId,
      queries: [
        {
          datapoint: {
            featureVector: embeddingVector.map(Number)
          },
          neighborCount: 50
        }
      ]
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    // APIリクエストを送信
    console.log(`Sending request to ${apiEndpoint}`);
    try {
      const response = await axios.post(apiEndpoint, requestBody, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Search completed successfully');
      console.log(`Response status: ${response.status}`);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      // 検索結果を解析
      if (response.data && response.data.nearestEntities) {
        console.log(`\nFound ${response.data.nearestEntities.length} results:`);
        response.data.nearestEntities.forEach((result: any, index: number) => {
          console.log(`\nResult ${index + 1}:`);
          console.log(`Entity ID: ${result.entity?.entityId || 'N/A'}`);
          console.log(`Distance: ${result.distance || 'N/A'}`);
          console.log(`Metadata: ${JSON.stringify(result.entity?.metadata || {}, null, 2)}`);
        });
      } else {
        console.log('No search results found');
      }
      
      return response.data;
    } catch (error: any) {
      console.error(`Error sending request: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        console.error('API response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      throw error;
    }
  } catch (error: any) {
    console.error(`Error searching Vector Search index: ${error.message}`);
    throw error;
  }
}

/**
 * メイン関数
 */
async function main() {
  try {
    // コマンドライン引数からクエリを取得
    const args = process.argv.slice(2);
    const query = args[0] || '教室登録の仕様について教えてください';
    
    console.log(`Starting Vector Search query test with query: "${query}"`);
    
    // Vector Search APIでクエリを実行
    await searchVectorIndex(query);
    
    console.log('\nVector Search query test completed successfully');
    
  } catch (error: any) {
    console.error('Error in Vector Search query test:', error.message);
    process.exit(1);
  }
}

// スクリプトを実行
main()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });