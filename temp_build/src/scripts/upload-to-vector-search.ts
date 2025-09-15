import 'dotenv/config';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

/**
 * GCSからVector Searchインデックスを更新する
 */
async function uploadToVectorSearch(filename: string, bucketName: string): Promise<void> {
  try {
    console.log(`Starting batch update with file gs://${bucketName}/${filename}`);
    
    // 環境変数の確認
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
    const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
    const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || 'confluence-vector-endpoint';
    const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    
    console.log(`Index ID: ${indexId}`);
    console.log(`Index Endpoint ID: ${indexEndpointId}`);
    console.log(`Deployed Index ID: ${deployedIndexId}`);
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Numeric Project ID: ${numericProjectId}`);
    console.log(`Index ID: ${indexId}`);
    console.log(`Location: ${location}`);
    
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
    
    // インデックス情報を取得
    const indexApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
    
    try {
      const indexResponse = await axios.get(indexApiUrl, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Successfully retrieved index info`);
      console.log(`Index update method: ${indexResponse.data.indexUpdateMethod}`);
      
      // 更新方法がBATCH_UPDATEでない場合は警告
      if (indexResponse.data.indexUpdateMethod !== 'BATCH_UPDATE') {
        console.warn(`Warning: Index update method is not BATCH_UPDATE`);
      }
    } catch (error: any) {
      console.warn(`Warning: Failed to get index info: ${error.message}`);
    }
    
    // インポートジョブを作成
    // Vertex AI Vector Search APIのドキュメントに従う
    // https://cloud.google.com/vertex-ai/docs/reference/rest/v1/projects.locations.indexes/patch
    const importUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
    
    // リクエストボディ
    // Vector Search APIのドキュメントを参照
    // https://cloud.google.com/vertex-ai/docs/vector-search/setup/import-data-to-index
    const requestBody = {
      displayName: `import-${new Date().toISOString()}`,
      metadata: {
        contentsDeltaUri: `gs://${bucketName}/${filename}`
      }
    };
    
    console.log(`Request body:`, JSON.stringify(requestBody, null, 2));
    
    // APIリクエストを送信 - PATCHメソッドを使用
    try {
      // クエリパラメータを追加
      const queryParams = '?updateMask=metadata.contentsDeltaUri';
      const response = await axios.patch(`${importUrl}${queryParams}`, requestBody, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Import job created successfully`);
      console.log(`Response status: ${response.status}`);
      
      // 非同期操作の名前を取得
      const operationName = response.data.name;
      if (operationName) {
        console.log(`Operation name: ${operationName}`);
        
        // 同期ログを保存
        await saveSyncLog('vector_search_import_started', {
          message: `Vector Search import job started`,
          filename,
          gcsPath: `gs://${bucketName}/${filename}`,
          operationName,
          timestamp: new Date().toISOString()
        });
        
        // 操作の完了を待機
        await waitForOperation(operationName, token.token, location);
      }
    } catch (error: any) {
      console.error(`Error creating import job: ${error.message}`);
      
      if (axios.isAxiosError(error) && error.response) {
        console.error('API response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
      
      // エラーログを保存
      await saveSyncLog('vector_search_import_error', {
        message: `Failed to create Vector Search import job: ${error.message}`,
        filename,
        gcsPath: `gs://${bucketName}/${filename}`,
        timestamp: new Date().toISOString()
      });
      
      throw new Error(`Failed to upload to Vector Search: ${error.message}`);
    }
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
}

/**
 * 非同期操作の完了を待機する
 */
async function waitForOperation(operationName: string, token: string, location: string = "asia-northeast1"): Promise<void> {
  try {
    console.log(`Checking operation status: ${operationName}`);
    
    const operationUrl = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;
    
    const response = await axios.get(operationUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 操作が完了していない場合は、再度チェック
    if (response.data.done === false) {
      console.log(`Operation is still in progress. Checking again in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      await waitForOperation(operationName, token, location);
    } else {
      console.log(`Operation completed`);
      if (response.data.error) {
        console.error(`Operation failed:`, JSON.stringify(response.data.error, null, 2));
        
        // エラーログを保存
        await saveSyncLog('vector_search_import_failed', {
          message: `Vector Search import operation failed: ${response.data.error.message}`,
          operationName,
          error: response.data.error,
          timestamp: new Date().toISOString()
        });
        
        throw new Error(`Operation failed: ${response.data.error.message}`);
      } else {
        console.log(`Operation succeeded:`, JSON.stringify(response.data.response, null, 2));
        
        // 成功ログを保存
        await saveSyncLog('vector_search_import_complete', {
          message: `Vector Search import operation completed successfully`,
          operationName,
          response: response.data.response,
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (error: any) {
    console.error(`Error checking operation: ${error.message}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error('API response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw new Error(`Failed to check operation: ${error.message}`);
  }
}

/**
 * 同期ログを保存する
 */
async function saveSyncLog(status: string, details: any): Promise<void> {
  try {
    const log = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      operation: 'vector_search_import',
      status,
      details
    };
    
    await admin.firestore().collection('syncLogs').add(log);
    
    console.log(`Sync log saved with status: ${status}`);
  } catch (error: any) {
    console.error(`Error saving sync log: ${error.message}`);
  }
}

/**
 * メイン関数
 */
async function main() {
  try {
    // 環境変数の確認
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
    
    if (!bucketName) {
      throw new Error('VERTEX_AI_STORAGE_BUCKET environment variable is not set');
    }
    
    // 引数からファイル名を取得
    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.error('Please provide a filename as an argument');
      console.log('Usage: npm run upload:vector-search -- <filename>');
      process.exit(1);
    }
    
    const filename = args[0];
    console.log(`Starting Vector Search import for file: ${filename}`);
    
    // Vector Searchにアップロード
    await uploadToVectorSearch(filename, bucketName);
    
    console.log(`Vector Search import completed successfully`);
    
  } catch (error: any) {
    console.error('Error in main process:', error.message);
    process.exit(1);
  }
}

// 特定のファイルをVector Searchにアップロードする関数をエクスポート
export async function uploadFileToVectorSearch(filename: string): Promise<boolean> {
  try {
    // 環境変数の確認
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
    
    if (!bucketName) {
      throw new Error('VERTEX_AI_STORAGE_BUCKET environment variable is not set');
    }
    
    // Vector Searchにアップロード
    await uploadToVectorSearch(filename, bucketName);
    return true;
  } catch (error: any) {
    console.error(`Error uploading file ${filename} to Vector Search: ${error.message}`);
    return false;
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}