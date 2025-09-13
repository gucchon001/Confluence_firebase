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
 * Vector Search 直接更新のテスト
 */
const dotenv = __importStar(require("dotenv"));
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// 環境変数の読み込み
dotenv.config();
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== Vector Search 直接更新のテスト開始 =====');
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
        // テスト用のデータポイントを作成
        const testDatapoint = {
            id: 'test-datapoint-002',
            featureVector: Array(768).fill(0).map(() => Math.random() * 2 - 1),
            restricts: [
                {
                    namespace: 'title',
                    allow_list: ['テストデータポイント2']
                },
                {
                    namespace: 'space_key',
                    allow_list: ['TEST']
                },
                {
                    namespace: 'content_type',
                    allow_list: ['test_data']
                }
            ],
            crowding_tag: 'test-datapoint'
        };
        // JSONLファイルを一時的に作成
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        const tempFilePath = path.join(tempDir, 'test-datapoint.jsonl');
        fs.writeFileSync(tempFilePath, JSON.stringify(testDatapoint) + '\n');
        console.log(`[main] Created temporary JSONL file: ${tempFilePath}`);
        // 1. インデックス直接更新のテスト
        console.log(`\n[main] 1. インデックス直接更新のテスト`);
        const updateIndexUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}:updateDatapoints`;
        console.log(`[main] Update index URL: ${updateIndexUrl}`);
        try {
            const requestBody = {
                datapoints: [testDatapoint]
            };
            console.log(`[main] Request body (truncated):`, JSON.stringify({
                datapoints: [Object.assign(Object.assign({}, testDatapoint), { featureVector: [...testDatapoint.featureVector.slice(0, 5), '...'] })]
            }, null, 2));
            const response = await axios_1.default.post(updateIndexUrl, requestBody, {
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[main] Response status: ${response.status}`);
            console.log(`[main] Response data:`, JSON.stringify(response.data, null, 2));
        }
        catch (error) {
            console.error(`[main] Error updating index: ${error.message}`);
            if (axios_1.default.isAxiosError(error) && error.response) {
                console.error('[main] API response error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
        }
        // 2. インデックス直接削除のテスト
        console.log(`\n[main] 2. インデックス直接削除のテスト`);
        const removeDatapointsUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}:removeDatapoints`;
        console.log(`[main] Remove datapoints URL: ${removeDatapointsUrl}`);
        try {
            const requestBody = {
                datapointIds: ['test-datapoint-001', 'test-datapoint-002']
            };
            console.log(`[main] Request body:`, JSON.stringify(requestBody, null, 2));
            const response = await axios_1.default.post(removeDatapointsUrl, requestBody, {
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[main] Response status: ${response.status}`);
            console.log(`[main] Response data:`, JSON.stringify(response.data, null, 2));
        }
        catch (error) {
            console.error(`[main] Error removing datapoints: ${error.message}`);
            if (axios_1.default.isAxiosError(error) && error.response) {
                console.error('[main] API response error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
        }
        // 一時ファイルを削除
        try {
            fs.unlinkSync(tempFilePath);
            console.log(`[main] Deleted temporary file: ${tempFilePath}`);
        }
        catch (error) {
            console.warn(`[main] Warning: Failed to delete temporary file: ${error.message}`);
        }
        console.log('\n===== Vector Search 直接更新のテスト完了 =====');
    }
    catch (error) {
        console.error(`[main] Error: ${error.message}`);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-vector-search-direct-update.js.map