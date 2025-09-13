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
exports.uploadToVectorSearch = uploadToVectorSearch;
/**
 * Vector Search サービス（バッチ処理版）
 */
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
const config = __importStar(require("./config"));
/**
 * GCSからVector Searchインデックスを更新する
 * @param filename GCSファイル名
 * @param bucketName GCSバケット名
 */
async function uploadToVectorSearch(filename, bucketName) {
    var _a, _b, _c, _d;
    try {
        console.log(`[uploadToVectorSearch] Starting batch update with file gs://${bucketName}/${filename}`);
        // プロジェクトIDを取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || ((_a = config.vertexai) === null || _a === void 0 ? void 0 : _a.project_id);
        const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || ((_b = config.vertexai) === null || _b === void 0 ? void 0 : _b.numeric_project_id);
        if (!projectId || !numericProjectId) {
            throw new Error("Vertex AI project ID not configured");
        }
        // インデックスIDとエンドポイントIDを取得
        const indexId = process.env.VERTEX_AI_INDEX_ID || ((_c = config.vertexai) === null || _c === void 0 ? void 0 : _c.index_id) || "7360896096425476096";
        // 認証トークンを取得
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token || !token.token) {
            throw new Error("Failed to get access token");
        }
        // Vector Search APIのエンドポイント
        const location = process.env.VERTEX_AI_LOCATION || ((_d = config.vertexai) === null || _d === void 0 ? void 0 : _d.location) || "asia-northeast1";
        // インデックス情報を取得して更新方法を確認
        const indexApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
        try {
            const indexResponse = await axios_1.default.get(indexApiUrl, {
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[uploadToVectorSearch] Successfully retrieved index info`);
            console.log(`[uploadToVectorSearch] Index update method: ${indexResponse.data.indexUpdateMethod}`);
            // 更新方法がBATCH_UPDATEでない場合は警告
            if (indexResponse.data.indexUpdateMethod !== 'BATCH_UPDATE') {
                console.warn(`[uploadToVectorSearch] Warning: Index update method is not BATCH_UPDATE`);
            }
        }
        catch (error) {
            console.warn(`[uploadToVectorSearch] Warning: Failed to get index info: ${error.message}`);
        }
        // インポートジョブを作成
        const importUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}:import`;
        // リクエストボディ
        const requestBody = {
            inputConfig: {
                gcsSource: {
                    uris: [`gs://${bucketName}/${filename}`]
                }
            }
        };
        console.log(`[uploadToVectorSearch] Request body:`, JSON.stringify(requestBody, null, 2));
        // APIリクエストを送信
        try {
            const response = await axios_1.default.post(importUrl, requestBody, {
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[uploadToVectorSearch] Import job created successfully`);
            console.log(`[uploadToVectorSearch] Response status: ${response.status}`);
            // 非同期操作の名前を取得
            const operationName = response.data.name;
            if (operationName) {
                console.log(`[uploadToVectorSearch] Operation name: ${operationName}`);
                // 操作の完了を待機
                await waitForOperation(operationName, token.token, location);
            }
        }
        catch (error) {
            console.error(`[uploadToVectorSearch] Error creating import job: ${error.message}`);
            if (axios_1.default.isAxiosError(error) && error.response) {
                console.error('[uploadToVectorSearch] API response error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
            // 代替手段として、Cloud Scheduleを使用したバッチ処理を推奨
            console.log(`[uploadToVectorSearch] Recommendation: Use Cloud Scheduler to trigger a Cloud Function that imports data to Vector Search.`);
            console.log(`[uploadToVectorSearch] Example cron expression for daily update: "0 0 * * *" (every day at midnight)`);
            throw new Error(`Failed to upload to Vector Search: ${error.message}`);
        }
    }
    catch (error) {
        console.error(`[uploadToVectorSearch] Error: ${error.message}`);
        throw error;
    }
}
/**
 * 非同期操作の完了を待機する
 * @param operationName 操作名
 * @param token 認証トークン
 */
async function waitForOperation(operationName, token, location = "asia-northeast1") {
    try {
        console.log(`[waitForOperation] Checking operation status: ${operationName}`);
        const operationUrl = `https://${location}-aiplatform.googleapis.com/v1/${operationName}`;
        const response = await axios_1.default.get(operationUrl, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        // 操作が完了していない場合は、再度チェック
        if (response.data.done === false) {
            console.log(`[waitForOperation] Operation is still in progress. Checking again in 5 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            await waitForOperation(operationName, token);
        }
        else {
            console.log(`[waitForOperation] Operation completed`);
            if (response.data.error) {
                console.error(`[waitForOperation] Operation failed:`, JSON.stringify(response.data.error, null, 2));
                throw new Error(`Operation failed: ${response.data.error.message}`);
            }
            else {
                console.log(`[waitForOperation] Operation succeeded:`, JSON.stringify(response.data.response, null, 2));
            }
        }
    }
    catch (error) {
        console.error(`[waitForOperation] Error checking operation: ${error.message}`);
        if (axios_1.default.isAxiosError(error) && error.response) {
            console.error('[waitForOperation] API response error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw new Error(`Failed to check operation: ${error.message}`);
    }
}
//# sourceMappingURL=vector-search-service-batch.js.map