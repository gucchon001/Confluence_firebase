"use strict";
/**
 * バッチ更新操作の詳細を確認するテスト
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
 * バッチ更新操作の詳細を取得する
 *
 * @param operationId 操作ID
 */
async function getBatchUpdateDetails(operationId) {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // 操作の詳細を取得するエンドポイント
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexes/${indexId}/operations/${operationId}`;
        console.log(`[getBatchUpdateDetails] Requesting operation details: ${endpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[getBatchUpdateDetails] Response status:', response.status);
        console.log('[getBatchUpdateDetails] Operation details:', JSON.stringify(response.data, null, 2));
        // 操作の詳細情報を表示
        if (response.data) {
            console.log('\n[getBatchUpdateDetails] Operation details:');
            console.log(`- Name: ${response.data.name}`);
            console.log(`- Done: ${response.data.done ? 'Yes' : 'No'}`);
            // メタデータの表示
            if (response.data.metadata) {
                console.log(`- Create time: ${response.data.metadata.createTime || 'Not available'}`);
                console.log(`- Update time: ${response.data.metadata.updateTime || 'Not available'}`);
                // 進行状況の表示
                if (response.data.metadata.progressPercentage) {
                    console.log(`- Progress: ${response.data.metadata.progressPercentage}%`);
                }
                // 詳細情報の表示
                if (response.data.metadata.genericMetadata) {
                    console.log(`- Generic metadata:`, JSON.stringify(response.data.metadata.genericMetadata, null, 2));
                }
            }
            // エラー情報の表示
            if (response.data.error) {
                console.log(`- Error:`, JSON.stringify(response.data.error, null, 2));
            }
            else if (response.data.done) {
                console.log(`- Status: Completed successfully`);
            }
            else {
                console.log(`- Status: In progress`);
            }
            // レスポンス情報の表示
            if (response.data.response) {
                console.log(`- Response:`, JSON.stringify(response.data.response, null, 2));
            }
        }
    }
    catch (error) {
        console.error('[getBatchUpdateDetails] Error getting batch update details:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[getBatchUpdateDetails] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[getBatchUpdateDetails] No response received:', error.request);
        }
        else {
            console.error('[getBatchUpdateDetails] Request error:', error.message);
        }
    }
}
/**
 * バッチ更新操作のリストを取得する
 */
async function listBatchUpdateOperations() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // バッチ操作のリストを取得するエンドポイント
        const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/indexes/${indexId}/operations`;
        console.log(`[listBatchUpdateOperations] Requesting batch operations: ${endpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[listBatchUpdateOperations] Response status:', response.status);
        // 操作IDのリストを抽出
        const operationIds = [];
        if (response.data && response.data.operations) {
            const operations = response.data.operations;
            console.log(`[listBatchUpdateOperations] Found ${operations.length} operations`);
            operations.forEach((op) => {
                if (op.name) {
                    const parts = op.name.split('/');
                    const operationId = parts[parts.length - 1];
                    operationIds.push(operationId);
                    console.log(`- Operation ID: ${operationId}`);
                    console.log(`  Done: ${op.done ? 'Yes' : 'No'}`);
                }
            });
        }
        else {
            console.log('[listBatchUpdateOperations] No operations found');
        }
        return operationIds;
    }
    catch (error) {
        console.error('[listBatchUpdateOperations] Error listing batch update operations:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[listBatchUpdateOperations] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[listBatchUpdateOperations] No response received:', error.request);
        }
        else {
            console.error('[listBatchUpdateOperations] Request error:', error.message);
        }
        return [];
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
        console.log(`[getIndexDetails] Requesting index details: ${endpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[getIndexDetails] Response status:', response.status);
        // インデックスの詳細情報を表示
        if (response.data) {
            console.log('\n[getIndexDetails] Index details:');
            console.log(`- Name: ${response.data.name}`);
            console.log(`- Display name: ${response.data.displayName}`);
            console.log(`- Create time: ${response.data.createTime}`);
            console.log(`- Update time: ${response.data.updateTime}`);
            // インデックスの統計情報を表示
            if (response.data.indexStats) {
                console.log(`- Index stats:`, JSON.stringify(response.data.indexStats, null, 2));
            }
            // インデックスの更新方法を表示
            if (response.data.indexUpdateMethod) {
                console.log(`- Index update method: ${response.data.indexUpdateMethod}`);
            }
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
        else if (error.request) {
            console.error('[getIndexDetails] No response received:', error.request);
        }
        else {
            console.error('[getIndexDetails] Request error:', error.message);
        }
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== バッチ更新操作の詳細確認テスト開始 =====');
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
        // バッチ更新操作のリストを取得
        console.log('\n2. バッチ更新操作のリストを取得');
        const operationIds = await listBatchUpdateOperations();
        // 各バッチ更新操作の詳細を取得
        if (operationIds.length > 0) {
            console.log('\n3. バッチ更新操作の詳細を取得');
            // 最新の3つの操作の詳細を取得
            const recentOperationIds = operationIds.slice(0, 3);
            for (let i = 0; i < recentOperationIds.length; i++) {
                console.log(`\n3.${i + 1}. 操作ID: ${recentOperationIds[i]} の詳細`);
                await getBatchUpdateDetails(recentOperationIds[i]);
            }
        }
        console.log('\n===== バッチ更新操作の詳細確認テスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-batch-update-details.js.map