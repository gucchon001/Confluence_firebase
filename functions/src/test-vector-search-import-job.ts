/**
 * Vector Search インポートジョブのテスト
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
    console.log('===== Vector Search インポートジョブのテスト開始 =====');
    
    // プロジェクトIDを取得
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
    const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
    const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
    
    // テスト用のJSONLファイル名
    const filename = 'vector-search-data-2025-09-09T11-20-59.057Z.jsonl';
    
    console.log(`[main] Using project ID: ${projectId}`);
    console.log(`[main] Using numeric project ID: ${numericProjectId}`);
    console.log(`[main] Using location: ${location}`);
    console.log(`[main] Using index ID: ${indexId}`);
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
    
    // 1. インデックス情報の確認
    console.log(`\n[main] 1. インデックス情報の確認`);
    const indexApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
    
    try {
      const indexResponse = await axios.get(indexApiUrl, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[main] Index response status: ${indexResponse.status}`);
      console.log(`[main] Index update method: ${indexResponse.data.indexUpdateMethod || 'N/A'}`);
      
      if (indexResponse.data.indexUpdateMethod !== 'BATCH_UPDATE') {
        console.warn(`[main] Warning: Index update method is not BATCH_UPDATE`);
      }
    } catch (error: any) {
      console.error(`[main] Error getting index info: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        console.error('[main] API response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
    }
    
    // 2. インポートジョブの作成
    console.log(`\n[main] 2. インポートジョブの作成`);
    const createImportUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}:import`;
    
    try {
      const requestBody = {
        inputConfig: {
          gcsSource: {
            uris: [`gs://${bucketName}/${filename}`]
          }
        }
      };
      
      console.log(`[main] Request body:`, JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(createImportUrl, requestBody, {
        headers: {
          'Authorization': `Bearer ${token.token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[main] Response status: ${response.status}`);
      console.log(`[main] Response data:`, JSON.stringify(response.data, null, 2));
      
      // 非同期操作の名前を取得
      const operationName = response.data.name;
      if (operationName) {
        console.log(`[main] Operation name: ${operationName}`);
        
        // 操作の状態を確認
        await checkOperation(operationName, token.token);
      }
    } catch (error: any) {
      console.error(`[main] Error creating import job: ${error.message}`);
      if (axios.isAxiosError(error) && error.response) {
        console.error('[main] API response error:', {
          status: error.response.status,
          data: error.response.data
        });
      }
    }
    
    console.log('\n===== Vector Search インポートジョブのテスト完了 =====');
  } catch (error: any) {
    console.error(`[main] Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 非同期操作の状態を確認する
 * @param operationName 操作名
 * @param token 認証トークン
 */
async function checkOperation(operationName: string, token: string): Promise<void> {
  try {
    console.log(`[checkOperation] Checking operation status: ${operationName}`);
    
    const operationUrl = `https://asia-northeast1-aiplatform.googleapis.com/v1/${operationName}`;
    
    const response = await axios.get(operationUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[checkOperation] Operation status:`, JSON.stringify(response.data, null, 2));
    
    // 操作が完了していない場合は、再度チェック
    if (response.data.done === false) {
      console.log(`[checkOperation] Operation is still in progress. Checking again in 5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      await checkOperation(operationName, token);
    } else {
      console.log(`[checkOperation] Operation completed`);
      if (response.data.error) {
        console.error(`[checkOperation] Operation failed:`, JSON.stringify(response.data.error, null, 2));
      } else {
        console.log(`[checkOperation] Operation succeeded:`, JSON.stringify(response.data.response, null, 2));
      }
    }
  } catch (error: any) {
    console.error(`[checkOperation] Error checking operation: ${error.message}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error('[checkOperation] API response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
  }
}

// スクリプト実行
main();
