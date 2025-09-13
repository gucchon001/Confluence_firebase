"use strict";
/**
 * Vector Search APIのクエリテスト（公式ドキュメント形式）
 *
 * 公式ドキュメントに基づいたリクエスト形式でクエリを実行する
 * https://cloud.google.com/vertex-ai/docs/vector-search/query-index-public-endpoint
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const google_auth_library_1 = require("google-auth-library");
/**
 * Google Cloud認証情報を取得する
 *
 * @returns アクセストークン
 */
async function getGoogleCloudToken() {
    try {
        console.log('[getGoogleCloudToken] Starting token acquisition process');
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token || !token.token) {
            throw new Error('Failed to get access token');
        }
        return token.token;
    }
    catch (error) {
        console.error('[getGoogleCloudToken] Error getting Google Cloud token:', error);
        throw new Error(`Failed to get Google Cloud token: ${error.message}`);
    }
}
/**
 * Vector Search APIにクエリを実行する（公式ドキュメント形式）
 */
async function queryVectorSearchOfficial() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const endpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
        const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // エンドポイントURLの構築（公式ドキュメント形式）
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexEndpoints/${endpointId}:findNeighbors`;
        console.log(`[queryVectorSearchOfficial] Using endpoint: ${endpoint}`);
        // テスト用のベクトル（768次元、すべて0.1の値）
        const testVector = Array(768).fill(0.1);
        // リクエストボディを構築（公式ドキュメント形式）
        // https://cloud.google.com/vertex-ai/docs/vector-search/query-index-public-endpoint
        const requestBody = {
            deployed_index_id: deployedIndexId,
            queries: [
                {
                    datapoint: {
                        // 公式ドキュメントでは 'embedding' フィールドを使用
                        embedding: testVector,
                    },
                    neighbor_count: 10,
                    distance_threshold: 0.0 // 類似度の閾値を0に設定（全ての結果を返す）
                },
            ],
        };
        console.log(`[queryVectorSearchOfficial] Request body:`, JSON.stringify(requestBody, null, 2));
        // APIリクエストを送信
        const response = await axios_1.default.post(endpoint, requestBody, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[queryVectorSearchOfficial] Response status:', response.status);
        console.log('[queryVectorSearchOfficial] Response data:', JSON.stringify(response.data, null, 2));
        // 結果の詳細を表示
        if (response.data.nearest_neighbors &&
            response.data.nearest_neighbors[0] &&
            response.data.nearest_neighbors[0].neighbors &&
            response.data.nearest_neighbors[0].neighbors.length > 0) {
            const neighbors = response.data.nearest_neighbors[0].neighbors;
            console.log(`[queryVectorSearchOfficial] Found ${neighbors.length} results`);
            neighbors.forEach((neighbor, index) => {
                console.log(`\nResult #${index + 1}:`);
                console.log(`- ID: ${neighbor.datapoint.id || neighbor.datapoint.datapoint_id || 'Unknown'}`);
                console.log(`- Distance: ${neighbor.distance}`);
                // restrictsからタイトルを取得（存在する場合）
                if (neighbor.datapoint.restricts && Array.isArray(neighbor.datapoint.restricts)) {
                    const titleRestrict = neighbor.datapoint.restricts.find((r) => r.namespace === 'title');
                    if (titleRestrict && titleRestrict.allow_list && titleRestrict.allow_list.length > 0) {
                        console.log(`- Title: ${titleRestrict.allow_list[0]}`);
                    }
                }
            });
        }
        else {
            console.log('[queryVectorSearchOfficial] No results found');
        }
    }
    catch (error) {
        console.error('[queryVectorSearchOfficial] Error querying Vector Search API:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[queryVectorSearchOfficial] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[queryVectorSearchOfficial] No response received:', error.request);
        }
        else {
            console.error('[queryVectorSearchOfficial] Request error:', error.message);
        }
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Vector Search API クエリテスト（公式ドキュメント形式）開始 =====');
        // 環境変数の表示
        console.log('環境変数:');
        console.log('- VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
        console.log('- VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION);
        console.log('- VERTEX_AI_INDEX_ID:', process.env.VERTEX_AI_INDEX_ID);
        console.log('- VERTEX_AI_ENDPOINT_ID:', process.env.VERTEX_AI_ENDPOINT_ID);
        console.log('- VERTEX_AI_DEPLOYED_INDEX_ID:', process.env.VERTEX_AI_DEPLOYED_INDEX_ID);
        console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        // Vector Search APIにクエリを実行（公式ドキュメント形式）
        console.log('\nVector Search APIにクエリを実行（公式ドキュメント形式）');
        await queryVectorSearchOfficial();
        console.log('\n===== Vector Search API クエリテスト（公式ドキュメント形式）完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-vector-search-query-official.js.map