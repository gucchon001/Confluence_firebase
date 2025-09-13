/**
 * Vector Search API メソッドの確認
 */
import * as dotenv from 'dotenv';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';

// 環境変数の読み込み
dotenv.config();

/**
 * メイン関数
 */
async function main() {
  try {
    console.log('===== Vector Search API メソッドの確認開始 =====');
    
    // プロジェクトIDを取得
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
    
    console.log(`[main] Using project ID: ${projectId}`);
    console.log(`[main] Using numeric project ID: ${numericProjectId}`);
    console.log(`[main] Using location: ${location}`);
    console.log(`[main] Using index ID: ${indexId}`);
    
    // 認証トークンを取得
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    if (!token || !token.token) {
      throw new Error('Failed to get access token');
    }
    
    console.log(`[main] Successfully obtained access token`);
    
    // Vector Search インデックス情報を取得
    const indexApiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
    
    console.log(`[main] Checking index: ${indexApiEndpoint}`);
    
    // APIリクエストを送信
    const indexResponse = await axios.get(indexApiEndpoint, {
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[main] Index response status: ${indexResponse.status}`);
    console.log(`[main] Index info:`, JSON.stringify(indexResponse.data, null, 2));
    
    // インデックスのメタデータを確認
    const metadata = indexResponse.data.metadata;
    if (metadata) {
      console.log(`[main] Index metadata:`, JSON.stringify(metadata, null, 2));
    }
    
    // 利用可能なAPIメソッドを確認
    console.log(`[main] Checking available API methods...`);
    
    // Discovery APIを使用して利用可能なメソッドを取得
    const discoveryApiEndpoint = `https://aiplatform.googleapis.com/$discovery/rest?version=v1`;
    
    console.log(`[main] Using discovery API: ${discoveryApiEndpoint}`);
    
    const discoveryResponse = await axios.get(discoveryApiEndpoint);
    
    console.log(`[main] Discovery API response status: ${discoveryResponse.status}`);
    
    // indexEndpointsに関連するメソッドを抽出
    const resources = discoveryResponse.data.resources;
    if (resources && resources.projects && resources.projects.resources && 
        resources.projects.resources.locations && resources.projects.resources.locations.resources &&
        resources.projects.resources.locations.resources.indexEndpoints) {
      
      const indexEndpointMethods = resources.projects.resources.locations.resources.indexEndpoints.methods;
      console.log(`[main] Available indexEndpoints methods:`, Object.keys(indexEndpointMethods));
      
      // 各メソッドの詳細を表示
      for (const [methodName, methodDetails] of Object.entries(indexEndpointMethods as Record<string, any>)) {
        console.log(`[main] Method: ${methodName}`);
        console.log(`[main] - Path: ${methodDetails.path || 'N/A'}`);
        console.log(`[main] - Description: ${methodDetails.description || 'N/A'}`);
        console.log(`[main] - HTTP Method: ${methodDetails.httpMethod || 'N/A'}`);
      }
    }
    
    console.log('\n===== Vector Search API メソッドの確認完了 =====');
  } catch (error: any) {
    console.error(`[main] Error: ${error.message}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[main] API response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    process.exit(1);
  }
}

// スクリプト実行
main();
