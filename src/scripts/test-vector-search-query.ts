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
 * Vector Search APIでクエリを実行する
 */
async function searchVectorIndex(queryText: string, filters?: { [key: string]: string | string[] }): Promise<any> {
  try {
    console.log(`Searching Vector Search index for query: "${queryText}"`);
    
    // 環境変数の確認
    console.log('環境変数の値を確認:');
    console.log(`VERTEX_AI_PROJECT_ID: ${process.env.VERTEX_AI_PROJECT_ID}`);
    console.log(`VERTEX_AI_NUMERIC_PROJECT_ID: ${process.env.VERTEX_AI_NUMERIC_PROJECT_ID}`);
    console.log(`VERTEX_AI_ENDPOINT_ID: ${process.env.VERTEX_AI_ENDPOINT_ID}`);
    console.log(`VERTEX_AI_DEPLOYED_INDEX_ID: ${process.env.VERTEX_AI_DEPLOYED_INDEX_ID}`);
    console.log(`VERTEX_AI_LOCATION: ${process.env.VERTEX_AI_LOCATION}`);
    
    const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
    const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1242272217526435840';
    const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_v2_deployed';
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
    
    const embeddingVector = Array.isArray(embedding) 
      ? embedding[0].embedding 
      : embedding.embedding;
    
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
    
    // Vector Search APIのエンドポイント
    const publicEndpointDomain = process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || '1010669901.asia-northeast1-122015916118.vdb.vertexai.goog';
    const apiVersion = 'v1beta1';
    const apiEndpoint = `https://${publicEndpointDomain}/${apiVersion}/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
    
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
    
    // 検索ベクトルをDOT_PRODUCT_DISTANCE向けに正規化
    const vec = embeddingVector.map(Number);
    const l2 = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    const normalized = vec.map(v => v / l2);
    
    // リクエストボディ (v1beta1 API仕様に基づく)
    const requestBody = {
      deployed_index_id: deployedIndexId,
      queries: [
        {
          datapoint: {
            datapoint_id: "query-1",
            feature_vector: normalized
          },
          neighbor_count: 10,
          ...(restricts.length > 0 ? { restricts } : {})
        }
      ]
    };
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2));
    
    // APIリクエストを送信
    console.log(`Sending request to ${apiEndpoint}`);
    const response = await axios.post(apiEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Search completed successfully');
    console.log(`Response status: ${response.status}`);
    
    // 検索結果を解析
    const searchResults = parseSearchResponse(response.data);
    
    // 検索結果を表示
    console.log(`\nFound ${searchResults.length} results:`);
    searchResults.forEach((result, index) => {
      console.log(`\nResult ${index + 1}:`);
      console.log(`ID: ${result.id}`);
      console.log(`Distance: ${result.distance}`);
      
      // Firestoreからメタデータを取得
      fetchMetadataFromFirestore(result.id)
        .then(metadata => {
          if (metadata) {
            console.log(`Title: ${metadata.title}`);
            console.log(`URL: ${metadata.url}`);
            console.log(`Content: ${metadata.content.substring(0, 100)}...`);
            if (metadata.labels && metadata.labels.length > 0) {
              console.log(`Labels: ${metadata.labels.join(', ')}`);
            }
          } else {
            console.log('Metadata not found in Firestore');
          }
        })
        .catch(error => {
          console.error(`Error fetching metadata: ${error.message}`);
        });
    });
    
    return searchResults;
  } catch (error: any) {
    console.error(`Error searching Vector Search index: ${error.message}`);
    if (axios.isAxiosError(error) && error.response) {
      console.error('API response error:', {
        status: error.response.status,
        data: error.response.data
      });
    }
    throw error;
  }
}

/**
 * 検索レスポンスを解析する
 */
function parseSearchResponse(responseData: any): any[] {
  try {
    // v1beta1 APIレスポンス形式に対応
    if (!responseData.nearestNeighbors || !responseData.nearestNeighbors[0] || !responseData.nearestNeighbors[0].neighbors) {
      return [];
    }
    
    const matches = responseData.nearestNeighbors[0].neighbors;
    
    return matches.map((match: any) => {
      // データポイントからデータを抽出
      const datapoint = match.datapoint || {};
      const id = datapoint.datapointId || datapoint.datapoint_id || '';
      
      // IDからページIDとチャンクインデックスを抽出
      const [pageId, chunkIndexStr] = id.split('-');
      const chunkIndex = parseInt(chunkIndexStr);
      
      return {
        id,
        pageId,
        chunkIndex,
        distance: match.distance || 0
      };
    });
  } catch (error: any) {
    console.error(`Error parsing search response: ${error.message}`);
    return [];
  }
}

/**
 * FirestoreからメタデータをIDで取得する
 */
async function fetchMetadataFromFirestore(id: string): Promise<any> {
  try {
    const doc = await admin.firestore().collection('chunks').doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data();
  } catch (error: any) {
    console.error(`Error fetching metadata from Firestore: ${error.message}`);
    return null;
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
    // フィルタ: --filter key=value[,key=value]
    let filters: Record<string, string | string[]> | undefined;
    const filterArgIdx = args.findIndex((a) => a === '--filter');
    if (filterArgIdx !== -1) {
      const spec = args[filterArgIdx + 1] || '';
      const map: Record<string, string[]> = {};
      spec.split(',').map((p) => p.trim()).filter(Boolean).forEach((kv) => {
        const eq = kv.indexOf('=');
        if (eq === -1) return;
        const k = kv.slice(0, eq).trim();
        const v = kv.slice(eq + 1).trim();
        if (!k) return;
        map[k] = map[k] ? [...map[k], v] : [v];
      });
      filters = Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.length === 1 ? v[0] : v]));
    }
    
    console.log(`Starting Vector Search query test with query: "${query}"`);
    
    // Vector Search APIでクエリを実行
    await searchVectorIndex(query, filters);
    
    console.log('\nVector Search query test completed successfully');
    
  } catch (error: any) {
    console.error('Error in Vector Search query test:', error.message);
    process.exit(1);
  }
}

// スクリプトを実行
main()
  .then(() => {
    // 少し待機してからプロセスを終了（Firestoreのデータ取得を待つため）
    setTimeout(() => {
      console.log('Script completed successfully');
      process.exit(0);
    }, 5000);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
