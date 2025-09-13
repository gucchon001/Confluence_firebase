/**
 * Vector Search クライアント
 */
import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';

/**
 * Vector Search クライアントの設定
 */
interface VectorSearchConfig {
  projectId: string;
  numericProjectId: string;
  location: string;
  indexEndpointId: string;
  deployedIndexId: string;
}

/**
 * Vector Search 検索パラメータ
 */
interface SearchParams {
  embeddingVector: number[];
  neighborCount?: number;
  // distanceThreshold removed (Vertex API doesn't accept it in findNeighbors)
  filters?: {
    [key: string]: string | string[];
  };
}

/**
 * Vector Search 検索結果
 */
interface SearchResult {
  id: string;
  pageId: string;
  chunkIndex: number;
  distance: number;
  title: string;
  labels: string[];
  spaceKey?: string;
  content?: string;
}

/**
 * Vector Search インデックスを検索する
 * 
 * @param params 検索パラメータ
 * @param config Vector Search 設定
 * @returns 検索結果
 */
export async function searchVectorIndex(
  params: SearchParams,
  config: VectorSearchConfig
): Promise<SearchResult[]> {
  try {
    console.log('[searchVectorIndex] Starting vector search');
    
    // 設定値を取得
    const { projectId, numericProjectId, location, indexEndpointId, deployedIndexId } = config;
    
    // 認証トークンを取得
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    if (!token || !token.token) {
      throw new Error('Failed to get access token');
    }
    
    // 設定値を直接環境変数から読み込む（Next.jsのSSR環境ではrequireが動作しないため）
    const configSettings = {
      publicEndpointDomain: process.env.VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN || '1010669901.asia-northeast1-122015916118.vdb.vertexai.goog',
      apiVersion: 'v1beta1'
    };
    
    console.log('[searchVectorIndex] Using config:', JSON.stringify({
      publicEndpointDomain: configSettings.publicEndpointDomain,
      apiVersion: configSettings.apiVersion,
      indexEndpointId: indexEndpointId,
      deployedIndexId: deployedIndexId
    }, null, 2));
    
    // Vector Search APIのエンドポイント
    const publicEndpointDomainName = configSettings.publicEndpointDomain;
    const apiVersion = configSettings.apiVersion;
    const apiEndpoint = `https://${publicEndpointDomainName}/${apiVersion}/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:findNeighbors`;
    
    console.log(`[searchVectorIndex] Using API endpoint: ${apiEndpoint}`);
    console.log(`[searchVectorIndex] Using deployed index ID: ${deployedIndexId}`);
    
    // フィルターの構築
    const restricts = [];
    
    if (params.filters) {
      for (const [key, value] of Object.entries(params.filters)) {
        const allowList = Array.isArray(value) ? value : [value];
        restricts.push({
          namespace: key,
          allow_list: allowList
        });
      }
    }
    
    // 検索ベクトルをDOT_PRODUCT_DISTANCE向けに正規化
    const vec = params.embeddingVector.map(Number);
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
          neighbor_count: params.neighborCount || 50,
          ...(restricts.length > 0 ? { restricts } : {})
        }
      ]
    };
    
    console.log('[searchVectorIndex] Request body structure:', {
      deployed_index_id: deployedIndexId,
      queries: [{
        datapoint: {
          datapoint_id: "query-1",
          feature_vector: "[normalized vector with " + normalized.length + " dimensions]"
        },
        neighbor_count: params.neighborCount || 50,
        restricts: restricts.length > 0 ? restricts : undefined
      }]
    });
    
    const isVerbose = process.env.VERBOSE === '1' || process.env.VERBOSE === 'true';
    console.log(`[searchVectorIndex] Request body:`, JSON.stringify(requestBody, null, 2));
    if (isVerbose) {
      const maskedToken = token.token ? `${String(token.token).slice(0, 8)}...` : 'N/A';
      const headersPreview = {
        Authorization: `Bearer ${maskedToken}`,
        'Content-Type': 'application/json'
      };
      const curlPreview = [
        'curl',
        '-X', 'POST',
        `'${apiEndpoint}'`,
        '-H', `'Authorization: Bearer ${maskedToken}'`,
        '-H', `'Content-Type: application/json'`,
        '--data', `'${JSON.stringify(requestBody).replace(/'/g, "'\\''")}'`
      ].join(' ');
      console.log('[searchVectorIndex][verbose] Request headers (masked):', headersPreview);
      console.log('[searchVectorIndex][verbose] Request size (bytes):', Buffer.byteLength(JSON.stringify(requestBody), 'utf8'));
      console.log('[searchVectorIndex][verbose] CURL preview:', curlPreview);
    }
    
    // APIリクエストを送信
    const response = await axios.post(apiEndpoint, requestBody, {
      headers: {
        'Authorization': `Bearer ${token.token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`[searchVectorIndex] Response status: ${response.status}`);
    
    // レスポンスを解析
    const results = parseSearchResponse(response.data);
    console.log(`[searchVectorIndex] Found ${results.length} results`);
    
    return results;
  } catch (error: any) {
    console.error(`[searchVectorIndex] Error searching vector index: ${error.message}`);
    const hasAxios = error && (error.isAxiosError || error.response || error.config);
    if (hasAxios) {
      const status = error.response?.status;
      const data = error.response?.data;
      const respHeaders = error.response?.headers;
      const reqConfig = error.config ? {
        url: error.config.url,
        method: error.config.method,
        headers: Object.assign({}, error.config.headers, { Authorization: undefined }),
        timeout: error.config.timeout
      } : undefined;
      console.error('[searchVectorIndex] Axios error details:', { status, respHeaders, data, reqConfig, code: error.code, errno: error.errno });
    }
    throw new Error(`Failed to search vector index: ${error.message}`);
  }
}

/**
 * 検索レスポンスを解析する
 * 
 * @param response API レスポンス
 * @returns 検索結果
 */
function parseSearchResponse(response: any): SearchResult[] {
  try {
    // 検索結果がない場合は空配列を返す
    if (!response.nearestNeighbors || !response.nearestNeighbors[0] || !response.nearestNeighbors[0].neighbors) {
      return [];
    }
    
    const matches = response.nearestNeighbors[0].neighbors;
    
    return matches.map((match: any) => {
      // データポイントからデータを抽出
      const datapoint = match.datapoint || {};
      const id = datapoint.datapointId || datapoint.dataPointId || '';
      
      // IDからページIDとチャンクインデックスを抽出
      const [pageId, chunkIndexStr] = id.split('-');
      const chunkIndex = parseInt(chunkIndexStr);
      
      // メタデータを抽出
      const metadata = datapoint.metadata || {};
      
      // 各フィールドを取得
      const title = metadata.title || '';
      const labels = metadata.labels || [];
      const spaceKey = metadata.spaceKey || '';
      
      return {
        id,
        pageId,
        chunkIndex,
        distance: match.distance,
        title,
        labels,
        spaceKey
      };
    });
  } catch (error: any) {
    console.error(`[parseSearchResponse] Error parsing search response: ${error.message}`);
    return [];
  }
}

/**
 * Vector Search クライアントを作成する
 * 
 * @param config Vector Search 設定
 * @returns Vector Search クライアント
 */
export function createVectorSearchClient(config: VectorSearchConfig) {
  return {
    search: (params: SearchParams) => searchVectorIndex(params, config)
  };
}

/**
 * デフォルトの Vector Search クライアント
 */
export const defaultVectorSearchClient = createVectorSearchClient({
  projectId: process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye',
  numericProjectId: process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118',
  location: process.env.VERTEX_AI_LOCATION || 'asia-northeast1',
  indexEndpointId: process.env.VERTEX_AI_ENDPOINT_ID || '1242272217526435840',
  deployedIndexId: process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_v2_deployed'
});