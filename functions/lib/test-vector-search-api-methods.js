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
 * Vector Search API メソッドの確認
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
        console.log('===== Vector Search API メソッドの確認開始 =====');
        // プロジェクトIDを取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || 'confluence-copilot-ppjye';
        const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
        console.log(`[main] Using project ID: ${projectId}`);
        console.log(`[main] Using numeric project ID: ${numericProjectId}`);
        console.log(`[main] Using location: ${location}`);
        console.log(`[main] Using index ID: ${indexId}`);
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
        // Vector Search インデックス情報を取得
        const indexApiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
        console.log(`[main] Checking index: ${indexApiEndpoint}`);
        // APIリクエストを送信
        const indexResponse = await axios_1.default.get(indexApiEndpoint, {
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[main] Index response status: ${indexResponse.status}`);
        console.log(`[main] Index info:`, JSON.stringify(indexResponse.data, null, 2));
        // インデックスのメタデータを確認
        const metadata = indexResponse.data.metadata;
        if (metadata) {
            console.log(`[main] Index metadata:`, JSON.stringify(metadata, null, 2));
        }
        // 利用可能なAPIメソッドを確認
        console.log(`[main] Checking available API methods...`);
        // Discovery APIを使用して利用可能なメソッドを取得
        const discoveryApiEndpoint = `https://aiplatform.googleapis.com/$discovery/rest?version=v1`;
        console.log(`[main] Using discovery API: ${discoveryApiEndpoint}`);
        const discoveryResponse = await axios_1.default.get(discoveryApiEndpoint);
        console.log(`[main] Discovery API response status: ${discoveryResponse.status}`);
        // indexEndpointsに関連するメソッドを抽出
        const resources = discoveryResponse.data.resources;
        if (resources && resources.projects && resources.projects.resources &&
            resources.projects.resources.locations && resources.projects.resources.locations.resources &&
            resources.projects.resources.locations.resources.indexEndpoints) {
            const indexEndpointMethods = resources.projects.resources.locations.resources.indexEndpoints.methods;
            console.log(`[main] Available indexEndpoints methods:`, Object.keys(indexEndpointMethods));
            // 各メソッドの詳細を表示
            for (const [methodName, methodDetails] of Object.entries(indexEndpointMethods)) {
                console.log(`[main] Method: ${methodName}`);
                console.log(`[main] - Path: ${methodDetails.path || 'N/A'}`);
                console.log(`[main] - Description: ${methodDetails.description || 'N/A'}`);
                console.log(`[main] - HTTP Method: ${methodDetails.httpMethod || 'N/A'}`);
            }
        }
        console.log('\n===== Vector Search API メソッドの確認完了 =====');
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
//# sourceMappingURL=test-vector-search-api-methods.js.map