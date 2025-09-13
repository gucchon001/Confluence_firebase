/**
 * Vector Search findNeighbors のテスト
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
    console.log('===== Vector Search findNeighbors のテスト開始 =====');
    
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
    
    // Vector Search APIのfindNeighborsエンドポイント
    const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
    
    console.log(`[main] Using findNeighbors endpoint: ${apiEndpoint}`);
    
    // テスト用の埋め込みベクトル
    const testVector = Array(768).fill(0).map(() => Math.random() * 2 - 1);
    
    // リクエストボディ
    const requestBody = {
      deployedIndexId: deployedIndexId,
      queries: [
        {
          datapoint: {
            featureVector: testVector
          },
          neighborCount: 10
        }
      ]
    };
    
    console.log(`[main] Request body (truncated):`, JSON.stringify({
      ...requestBody,
      queries: [{
        ...requestBody.queries[0],
        datapoint: {
          featureVector: [...testVector.slice(0, 5), '...']
        }
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
    
    // 検索結果を表示
    const nearestNeighbors = response.data.nearestNeighbors;
    if (nearestNeighbors && nearestNeighbors.length > 0 && nearestNeighbors[0].neighbors) {
      const neighbors = nearestNeighbors[0].neighbors;
      console.log(`[main] Found ${neighbors.length} neighbors`);
      
      for (let i = 0; i < Math.min(neighbors.length, 5); i++) {
        const neighbor = neighbors[i];
        console.log(`[main] Neighbor ${i + 1}:`);
        console.log(`[main] - ID: ${neighbor.datapoint.datapointId || 'N/A'}`);
        console.log(`[main] - Distance: ${neighbor.distance}`);
        
        // メタデータを表示
        if (neighbor.datapoint.restricts) {
          console.log(`[main] - Metadata:`);
          for (const restrict of neighbor.datapoint.restricts) {
            console.log(`[main]   - ${restrict.namespace}: ${restrict.allow_list.join(', ')}`);
          }
        }
      }
    } else {
      console.log(`[main] No neighbors found`);
    }
    
    console.log('\n===== Vector Search findNeighbors のテスト完了 =====');
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
