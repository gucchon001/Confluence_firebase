"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Vector Search エンドポイントのテスト
 */
const dotenv = __importStar(require("dotenv"));
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
// 環境変数の読み込み
dotenv.config();
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Vector Search エンドポイントのテスト開始 =====');
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
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token || !token.token) {
            throw new Error('Failed to get access token');
        }
        console.log(`[main] Successfully obtained access token`);
        // Vector Search APIのエンドポイント情報を取得
        const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}`;
        console.log(`[main] Checking endpoint: ${apiEndpoint}`);
        // APIリクエストを送信
        const response = await axios_1.default.get(apiEndpoint, {
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[main] Response status: ${response.status}`);
        console.log(`[main] Endpoint info:`, JSON.stringify(response.data, null, 2));
        // デプロイ済みのインデックス情報を確認
        if (response.data.deployedIndexes) {
            const deployedIndexes = response.data.deployedIndexes;
            console.log(`[main] Found ${deployedIndexes.length} deployed indexes`);
            for (const deployedIndex of deployedIndexes) {
                console.log(`[main] Deployed index ID: ${deployedIndex.id}`);
                console.log(`[main] Index: ${deployedIndex.index}`);
                console.log(`[main] Display name: ${deployedIndex.displayName || 'N/A'}`);
                console.log(`[main] Create time: ${deployedIndex.createTime || 'N/A'}`);
            }
        }
        else {
            console.log(`[main] No deployed indexes found`);
        }
        console.log('\n===== Vector Search エンドポイントのテスト完了 =====');
    }
    catch (error) {
        console.error(`[main] Error: ${error.message}`);
        if (axios_1.default.isAxiosError(error) && error.response) {
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
//# sourceMappingURL=test-vector-search-endpoint.js.map