"use strict";
/**
 * Vector Search インデックスの状態を確認するテスト
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
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
 * Vector Search インデックスの情報を取得する
 */
async function getIndexInfo() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // エンドポイントURLの構築
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexes/${indexId}`;
        console.log(`[getIndexInfo] Requesting index info: ${endpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[getIndexInfo] Response status:', response.status);
        console.log('[getIndexInfo] Index info:', JSON.stringify(response.data, null, 2));
        // インデックスの詳細情報を表示
        if (response.data) {
            console.log('\n[getIndexInfo] Index details:');
            console.log(`- Name: ${response.data.name}`);
            console.log(`- Display name: ${response.data.displayName}`);
            console.log(`- Description: ${response.data.description || 'No description'}`);
            console.log(`- Create time: ${response.data.createTime}`);
            console.log(`- Update time: ${response.data.updateTime}`);
            // メタデータの表示
            if (response.data.metadata) {
                console.log(`- Metadata:`, JSON.stringify(response.data.metadata, null, 2));
            }
            // データポイント数の表示
            if (response.data.indexStats && response.data.indexStats.vectorsCount) {
                console.log(`- Vectors count: ${response.data.indexStats.vectorsCount}`);
            }
            else {
                console.log(`- Vectors count: Not available`);
            }
        }
    }
    catch (error) {
        console.error('[getIndexInfo] Error getting index info:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[getIndexInfo] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[getIndexInfo] No response received:', error.request);
        }
        else {
            console.error('[getIndexInfo] Request error:', error.message);
        }
    }
}
/**
 * バッチ更新の状態を確認する
 */
async function checkBatchUpdateStatus() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // バッチ操作のリストを取得するエンドポイント
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/operations`;
        console.log(`[checkBatchUpdateStatus] Requesting batch operations: ${endpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[checkBatchUpdateStatus] Response status:', response.status);
        // 操作のリストを表示
        if (response.data && response.data.operations) {
            const operations = response.data.operations;
            console.log(`[checkBatchUpdateStatus] Found ${operations.length} operations`);
            // Vector Search関連の操作をフィルタリング
            const vectorSearchOperations = operations.filter((op) => {
                return op.name && (op.name.includes('indexes') ||
                    op.name.includes('indexEndpoints') ||
                    op.name.includes('vectorSearch'));
            });
            console.log(`[checkBatchUpdateStatus] Found ${vectorSearchOperations.length} Vector Search related operations`);
            // 最新の操作を表示
            const recentOperations = vectorSearchOperations.slice(0, 5);
            recentOperations.forEach((op, index) => {
                var _a, _b;
                console.log(`\nOperation #${index + 1}:`);
                console.log(`- Name: ${op.name}`);
                console.log(`- Done: ${op.done ? 'Yes' : 'No'}`);
                console.log(`- Create time: ${((_a = op.metadata) === null || _a === void 0 ? void 0 : _a.createTime) || 'Not available'}`);
                console.log(`- Update time: ${((_b = op.metadata) === null || _b === void 0 ? void 0 : _b.updateTime) || 'Not available'}`);
                if (op.error) {
                    console.log(`- Error: ${JSON.stringify(op.error, null, 2)}`);
                }
                else if (op.done) {
                    console.log(`- Status: Completed successfully`);
                }
                else {
                    console.log(`- Status: In progress`);
                }
            });
        }
        else {
            console.log('[checkBatchUpdateStatus] No operations found');
        }
    }
    catch (error) {
        console.error('[checkBatchUpdateStatus] Error checking batch update status:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[checkBatchUpdateStatus] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[checkBatchUpdateStatus] No response received:', error.request);
        }
        else {
            console.error('[checkBatchUpdateStatus] Request error:', error.message);
        }
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Vector Search インデックス状態確認テスト開始 =====');
        // 環境変数の表示
        console.log('環境変数:');
        console.log('- VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
        console.log('- VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION);
        console.log('- VERTEX_AI_INDEX_ID:', process.env.VERTEX_AI_INDEX_ID);
        console.log('- VERTEX_AI_ENDPOINT_ID:', process.env.VERTEX_AI_ENDPOINT_ID);
        console.log('- VERTEX_AI_DEPLOYED_INDEX_ID:', process.env.VERTEX_AI_DEPLOYED_INDEX_ID);
        console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        // インデックスの情報を取得
        console.log('\n1. Vector Search インデックスの情報を取得');
        await getIndexInfo();
        // バッチ更新の状態を確認
        console.log('\n2. バッチ更新の状態を確認');
        await checkBatchUpdateStatus();
        console.log('\n===== Vector Search インデックス状態確認テスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-vector-search-index-status.js.map