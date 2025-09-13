"use strict";
/**
 * Vector Search APIのクエリテスト（修正版）
 *
 * 実際のデータ形式に合わせてクエリを実行する
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
 * Vector Search APIにクエリを実行する（実際のデータ形式に合わせる）
 */
async function queryVectorSearch() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const endpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
        const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // エンドポイントURLの構築
        const endpoint = `https://663364514.${location}-${projectId}.vdb.vertexai.goog/v1/projects/${projectId}/locations/${location}/indexEndpoints/${endpointId}:findNeighbors`;
        console.log(`[queryVectorSearch] Using endpoint: ${endpoint}`);
        // テスト用のベクトル（768次元、すべて0.1の値）
        const testVector = Array(768).fill(0.1);
        // リクエストボディを構築（実際のデータ形式に合わせる）
        const requestBody = {
            deployedIndexId: deployedIndexId,
            queries: [
                {
                    datapoint: {
                        // 'embedding'フィールドを使用（GCSバケットのJSONLファイルと同じ）
                        embedding: testVector,
                    },
                    neighborCount: 10,
                    distanceThreshold: 0.0 // 類似度の閾値を0に設定（全ての結果を返す）
                },
            ],
        };
        console.log(`[queryVectorSearch] Request body:`, JSON.stringify(requestBody, null, 2));
        // APIリクエストを送信
        const response = await axios_1.default.post(endpoint, requestBody, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[queryVectorSearch] Response status:', response.status);
        console.log('[queryVectorSearch] Response data:', JSON.stringify(response.data, null, 2));
        // 結果の詳細を表示
        if (response.data.nearestNeighbors &&
            response.data.nearestNeighbors[0] &&
            response.data.nearestNeighbors[0].neighbors &&
            response.data.nearestNeighbors[0].neighbors.length > 0) {
            const neighbors = response.data.nearestNeighbors[0].neighbors;
            console.log(`[queryVectorSearch] Found ${neighbors.length} results`);
            neighbors.forEach((neighbor, index) => {
                console.log(`\nResult #${index + 1}:`);
                console.log(`- ID: ${neighbor.datapoint.id || 'Unknown'}`);
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
            console.log('[queryVectorSearch] No results found');
        }
    }
    catch (error) {
        console.error('[queryVectorSearch] Error querying Vector Search API:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[queryVectorSearch] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[queryVectorSearch] No response received:', error.request);
        }
        else {
            console.error('[queryVectorSearch] Request error:', error.message);
        }
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Vector Search API クエリテスト（修正版）開始 =====');
        // 環境変数の表示
        console.log('環境変数:');
        console.log('- VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
        console.log('- VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION);
        console.log('- VERTEX_AI_INDEX_ID:', process.env.VERTEX_AI_INDEX_ID);
        console.log('- VERTEX_AI_ENDPOINT_ID:', process.env.VERTEX_AI_ENDPOINT_ID);
        console.log('- VERTEX_AI_DEPLOYED_INDEX_ID:', process.env.VERTEX_AI_DEPLOYED_INDEX_ID);
        console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        // Vector Search APIにクエリを実行
        console.log('\nVector Search APIにクエリを実行（実際のデータ形式に合わせる）');
        await queryVectorSearch();
        console.log('\n===== Vector Search API クエリテスト（修正版）完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-vector-search-query-fixed.js.map