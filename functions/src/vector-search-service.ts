/**
 * Vector Search サービス
 */
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import * as config from './config';

/**
 * Vector Searchにデータをバッチアップロードする
 * @param filename GCSファイル名
 * @param bucketName GCSバケット名
 */
export async function uploadToVectorSearch(filename: string, bucketName: string): Promise<void> {
  try {
    console.log(`[uploadToVectorSearch] Starting batch update with file gs://${bucketName}/${filename}`);
    
    // プロジェクトIDを取得
    const projectId = process.env.VERTEX_AI_PROJECT_ID || config.vertexai?.project_id;
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || config.vertexai?.numeric_project_id;
    
    if (!projectId || !numericProjectId) {
      throw new Error("Vertex AI project ID not configured");
    }
    
    // インデックスIDとエンドポイントIDを取得
    const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || config.vertexai?.endpoint_id || "1435927001503367168";
    const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || config.vertexai?.deployed_index_id || "confluence_embeddings_endp_1757347487752";
    
    // 認証トークンを取得
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    if (!token || !token.token) {
      throw new Error("Failed to get access token");
    }
    
    // Vector Search APIのエンドポイント
    const location = process.env.VERTEX_AI_LOCATION || config.vertexai?.location || "asia-northeast1";
    
    // エンドポイントの確認
    const indexEndpointApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}`;
    
    try {
      // インデックスエンドポイントの情報を取得
      const endpointResponse = await axios.get(indexEndpointApiUrl, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[uploadToVectorSearch] Successfully retrieved index endpoint info`);
      
      // デプロイされているインデックスを確認
      if (endpointResponse.data.deployedIndexes) {
        const deployedIndexes = endpointResponse.data.deployedIndexes;
        console.log(`[uploadToVectorSearch] Found ${deployedIndexes.length} deployed indexes`);
        
        // デプロイされたインデックスIDが存在するか確認
        const deployedIndex = deployedIndexes.find((di: any) => di.id === deployedIndexId);
        if (!deployedIndex) {
          console.warn(`[uploadToVectorSearch] Warning: Deployed index ID ${deployedIndexId} not found in endpoint`);
          console.log(`[uploadToVectorSearch] Available deployed indexes:`, deployedIndexes.map((di: any) => di.id));
        }
      }
    } catch (error: any) {
      console.warn(`[uploadToVectorSearch] Warning: Failed to get index endpoint info: ${error.message}`);
    }
    
    // バッチ更新エンドポイント
    const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:batchUpdateDatapoints`;
    
    // リクエストボディ
    const requestBody = {
      deployedIndexId: deployedIndexId,
      gcsSource: {
        uris: [`gs://${bucketName}/${filename}`]
      }
    };
    
    console.log(`[uploadToVectorSearch] Request body:`, JSON.stringify(requestBody, null, 2));
    
    // APIリクエストを送信
    const response = await axios.post(apiEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[uploadToVectorSearch] Batch update initiated successfully:`, response.data);
    
    // 非同期操作の完了を待つ
    const operationId = response.data.name.split('/').pop();
    await waitForOperation(numericProjectId, operationId);
  } catch (error: any) {
    console.error(`[uploadToVectorSearch] Error uploading to Vector Search: ${error.message}`);
    
    if (axios.isAxiosError(error) && error.response) {
      console.error('[uploadToVectorSearch] API response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    
    throw new Error(`Failed to upload to Vector Search: ${error.message}`);
  }
}

/**
 * 非同期操作の完了を待つ
 * @param projectId プロジェクトID
 * @param operationId 操作ID
 */
async function waitForOperation(projectId: string, operationId: string): Promise<void> {
  try {
    console.log(`[waitForOperation] Waiting for operation ${operationId} to complete`);
    
    // 認証トークンを取得
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    if (!token || !token.token) {
      throw new Error("Failed to get access token");
    }
    
    // 操作のステータスを確認するエンドポイント
    const apiEndpoint = `https://asia-northeast1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/asia-northeast1/operations/${operationId}`;
    
    let completed = false;
    let retries = 0;
    const maxRetries = 30;
    const delay = 10000; // 10秒ごとにチェック
    
    while (!completed && retries < maxRetries) {
      // APIリクエストを送信
      const response = await axios.get(apiEndpoint, {
        headers: {
          'Authorization': `Bearer ${token.token}`
        }
      });
      
      if (response.data.done) {
        completed = true;
        console.log(`[waitForOperation] Operation ${operationId} completed successfully`);
        
        if (response.data.error) {
          throw new Error(`Operation failed: ${JSON.stringify(response.data.error)}`);
        }
      } else {
        console.log(`[waitForOperation] Operation ${operationId} still in progress, waiting...`);
        retries++;
        
        // 待機
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    if (!completed) {
      throw new Error(`Operation timed out after ${maxRetries * delay / 1000} seconds`);
    }
  } catch (error: any) {
    console.error(`[waitForOperation] Error waiting for operation: ${error.message}`);
    throw new Error(`Failed to wait for operation: ${error.message}`);
  }
}
