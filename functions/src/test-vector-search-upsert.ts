/**
 * Vector Search upsertDatapoints のテスト
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
    console.log('===== Vector Search upsertDatapoints のテスト開始 =====');
    
    // プロジェクトIDを取得
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
    const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
    
    console.log(`[main] Using project ID: ${projectId}`);
    console.log(`[main] Using numeric project ID: ${numericProjectId}`);
    console.log(`[main] Using location: ${location}`);
    console.log(`[main] Using index endpoint ID: ${indexEndpointId}`);
    console.log(`[main] Using deployed index ID: ${deployedIndexId}`);
    
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
    
    // Vector Search APIのupsertDatapointsエンドポイント
    const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:upsertDatapoints`;
    
    console.log(`[main] Using upsert endpoint: ${apiEndpoint}`);
    
    // テスト用のデータポイント
    const testDatapoint = {
      id: 'test-datapoint-001',
      featureVector: Array(768).fill(0).map(() => Math.random() * 2 - 1),
      restricts: [
        {
          namespace: 'title',
          allow_list: ['テストデータポイント']
        },
        {
          namespace: 'space_key',
          allow_list: ['TEST']
        },
        {
          namespace: 'content_type',
          allow_list: ['test_data']
        }
      ],
      crowding_tag: 'test-datapoint'
    };
    
    // リクエストボディ
    const requestBody = {
      deployedIndexId: deployedIndexId,
      datapoints: [testDatapoint]
    };
    
    console.log(`[main] Request body (truncated):`, JSON.stringify({
      ...requestBody,
      datapoints: [{
        ...testDatapoint,
        featureVector: [...testDatapoint.featureVector.slice(0, 5), '...']
      }]
    }, null, 2));
    
    // APIリクエストを送信
    const response = await axios.post(apiEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[main] Response status: ${response.status}`);
    console.log(`[main] Response data:`, JSON.stringify(response.data, null, 2));
    
    console.log('\n===== Vector Search upsertDatapoints のテスト完了 =====');
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
