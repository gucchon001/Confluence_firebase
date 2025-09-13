/**
 * Vector Search サービス（バッチ処理版）
 */
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import * as config from './config';

/**
 * GCSからVector Searchインデックスを更新する
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
    const indexId = process.env.VERTEX_AI_INDEX_ID || config.vertexai?.index_id || "7360896096425476096";
    
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
    
    // インデックス情報を取得して更新方法を確認
    const indexApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
    
    try {
      const indexResponse = await axios.get(indexApiUrl, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[uploadToVectorSearch] Successfully retrieved index info`);
      console.log(`[uploadToVectorSearch] Index update method: ${indexResponse.data.indexUpdateMethod}`);
      
      // 更新方法がBATCH_UPDATEでない場合は警告
      if (indexResponse.data.indexUpdateMethod !== 'BATCH_UPDATE') {
        console.warn(`[uploadToVectorSearch] Warning: Index update method is not BATCH_UPDATE`);
      }
    } catch (error: any) {
      console.warn(`[uploadToVectorSearch] Warning: Failed to get index info: ${error.message}`);
    }
    
    // インポートジョブを作成
    const importUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}:import`;
    
    // リクエストボディ
    const requestBody = {
      inputConfig: {
        gcsSource: {
          uris: [`gs://${bucketName}/${filename}`]
        }
      }
    };
    
    console.log(`[uploadToVectorSearch] Request body:`, JSON.stringify(requestBody, null, 2));
    
    // APIリクエストを送信
    try {
      const response = await axios.post(importUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[uploadToVectorSearch] Import job created successfully`);
      console.log(`[uploadToVectorSearch] Response status: ${response.status}`);
      
      // 非同期操作の名前を取得
      const operationName = response.data.name;
      if (operationName) {
        console.log(`[uploadToVectorSearch] Operation name: ${operationName}`);
        
        // 操作の完了を待機
        await waitForOperation(operationName, token.token, location);
      }
    } catch (error: any) {
      console.error(`[uploadToVectorSearch] Error creating import job: ${error.message}`);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error('[uploadToVectorSearch] API response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      // 代替手段として、Cloud Scheduleを使用したバッチ処理を推奨
      console.log(`[uploadToVectorSearch] Recommendation: Use Cloud Scheduler to trigger a Cloud Function that imports data to Vector Search.`);
      console.log(`[uploadToVectorSearch] Example cron expression for daily update: "0 0 * * *" (every day at midnight)`);
      
      throw new Error(`Failed to upload to Vector Search: ${error.message}`);
    }
  } catch (error: any) {
    console.error(`[uploadToVectorSearch] Error: ${error.message}`);
    throw error;
  }
}

/**
 * 非同期操作の完了を待機する
 * @param operationName 操作名
 * @param token 認証トークン
 */
async function waitForOperation(operationName: string, token: string, location: string = "asia-northeast1"): Promise<void> {
  try {
    console.log(`[waitForOperation] Checking operation status: ${operationName}`);
    
    const operationUrl = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;
    
    const response = await axios.get(operationUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 操作が完了していない場合は、再度チェック
    if (response.data.done === false) {
      console.log(`[waitForOperation] Operation is still in progress. Checking again in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      await waitForOperation(operationName, token);
    } else {
      console.log(`[waitForOperation] Operation completed`);
      if (response.data.error) {
        console.error(`[waitForOperation] Operation failed:`, JSON.stringify(response.data.error, null, 2));
        throw new Error(`Operation failed: ${response.data.error.message}`);
      } else {
        console.log(`[waitForOperation] Operation succeeded:`, JSON.stringify(response.data.response, null, 2));
      }
    }
  } catch (error: any) {
    console.error(`[waitForOperation] Error checking operation: ${error.message}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[waitForOperation] API response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw new Error(`Failed to check operation: ${error.message}`);
  }
}
