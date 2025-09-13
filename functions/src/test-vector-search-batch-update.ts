/**
 * Vector Search バッチ更新のテスト
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
    console.log('===== Vector Search バッチ更新のテスト開始 =====');
    
    // プロジェクトIDを取得
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
    const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
    
    // テスト用のJSONLファイル名
    const filename = 'vector-search-data-2025-09-09T10-47-34.817Z.jsonl';
    
    console.log(`[main] Using project ID: ${projectId}`);
    console.log(`[main] Using numeric project ID: ${numericProjectId}`);
    console.log(`[main] Using location: ${location}`);
    console.log(`[main] Using index endpoint ID: ${indexEndpointId}`);
    console.log(`[main] Using deployed index ID: ${deployedIndexId}`);
    console.log(`[main] Using GCS bucket: ${bucketName}`);
    console.log(`[main] Using JSONL file: ${filename}`);
    
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
    
    // Vector Search APIのバッチ更新エンドポイント
    const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:batchUpdateDatapoints`;
    
    console.log(`[main] Using batch update endpoint: ${apiEndpoint}`);
    
    // リクエストボディ
    const requestBody = {
      deployedIndexId: deployedIndexId,
      gcsSource: {
        uris: [`gs://${bucketName}/${filename}`]
      }
    };
    
    console.log(`[main] Request body:`, JSON.stringify(requestBody, null, 2));
    
    // APIリクエストを送信
    const response = await axios.post(apiEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[main] Response status: ${response.status}`);
    console.log(`[main] Response data:`, JSON.stringify(response.data, null, 2));
    
    // 非同期操作の名前を取得
    const operationName = response.data.name;
    console.log(`[main] Operation name: ${operationName}`);
    
    console.log('\n===== Vector Search バッチ更新のテスト完了 =====');
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
