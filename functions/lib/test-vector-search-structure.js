"use strict";
/**
 * Vector Search APIのデータ構造テスト
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
 * インデックスの詳細情報を取得する
 */
async function getIndexDetails() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // エンドポイントURLの構築
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexes/${indexId}`;
        console.log(`[getIndexDetails] Requesting: ${endpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[getIndexDetails] Response status:', response.status);
        console.log('[getIndexDetails] Index details:', JSON.stringify(response.data, null, 2));
        // メタデータスキーマURIを取得
        const metadataSchemaUri = response.data.metadataSchemaUri;
        if (metadataSchemaUri) {
            console.log(`[getIndexDetails] Metadata schema URI: ${metadataSchemaUri}`);
        }
    }
    catch (error) {
        console.error('[getIndexDetails] Error getting index details:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[getIndexDetails] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
    }
}
/**
 * デプロイされたインデックスの詳細情報を取得する
 */
async function getDeployedIndexDetails() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const endpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
        const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // エンドポイントURLの構築
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexEndpoints/${endpointId}/deployedIndexes/${deployedIndexId}`;
        console.log(`[getDeployedIndexDetails] Requesting: ${endpoint}`);
        // APIリクエストを送信
        try {
            const response = await axios_1.default.get(endpoint, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            // レスポンスを処理
            console.log('[getDeployedIndexDetails] Response status:', response.status);
            console.log('[getDeployedIndexDetails] Deployed index details:', JSON.stringify(response.data, null, 2));
        }
        catch (error) {
            // このAPIエンドポイントが存在しない場合は別の方法を試す
            console.log('[getDeployedIndexDetails] Failed to get deployed index details directly, trying alternative approach');
            // インデックスエンドポイントの詳細を取得
            const endpointDetailsUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexEndpoints/${endpointId}`;
            const endpointResponse = await axios_1.default.get(endpointDetailsUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            // デプロイされたインデックスの情報を取得
            const deployedIndexes = endpointResponse.data.deployedIndexes || [];
            const targetIndex = deployedIndexes.find((di) => di.id === deployedIndexId);
            if (targetIndex) {
                console.log('[getDeployedIndexDetails] Found deployed index in endpoint details:', JSON.stringify(targetIndex, null, 2));
            }
            else {
                console.log('[getDeployedIndexDetails] Deployed index not found in endpoint details');
            }
        }
    }
    catch (error) {
        console.error('[getDeployedIndexDetails] Error getting deployed index details:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[getDeployedIndexDetails] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Vector Search データ構造テスト開始 =====');
        // 環境変数の表示
        console.log('環境変数:');
        console.log('- VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
        console.log('- VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION);
        console.log('- VERTEX_AI_INDEX_ID:', process.env.VERTEX_AI_INDEX_ID);
        console.log('- VERTEX_AI_ENDPOINT_ID:', process.env.VERTEX_AI_ENDPOINT_ID);
        console.log('- VERTEX_AI_DEPLOYED_INDEX_ID:', process.env.VERTEX_AI_DEPLOYED_INDEX_ID);
        console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        // インデックスの詳細情報を取得
        console.log('\n1. インデックスの詳細情報を取得');
        await getIndexDetails();
        // デプロイされたインデックスの詳細情報を取得
        console.log('\n2. デプロイされたインデックスの詳細情報を取得');
        await getDeployedIndexDetails();
        console.log('\n===== Vector Search データ構造テスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-vector-search-structure.js.map