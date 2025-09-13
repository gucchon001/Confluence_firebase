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
 * Vector Search サービス
 */
const axios_1 = __importDefault(require("axios"));
const google_auth_library_1 = require("google-auth-library");
const config = __importStar(require("./config"));
/**
 * Vector Searchにデータをバッチアップロードする
 * @param filename GCSファイル名
 * @param bucketName GCSバケット名
 */
async function uploadToVectorSearch(filename, bucketName) {
    var _a, _b, _c, _d, _e;
    try {
        console.log(`[uploadToVectorSearch] Starting batch update with file gs://${bucketName}/${filename}`);
        // プロジェクトIDを取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || ((_a = config.vertexai) === null || _a === void 0 ? void 0 : _a.project_id);
        const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || ((_b = config.vertexai) === null || _b === void 0 ? void 0 : _b.numeric_project_id);
        if (!projectId || !numericProjectId) {
            throw new Error("Vertex AI project ID not configured");
        }
        // インデックスIDとエンドポイントIDを取得
        const indexEndpointId = process.env.VERTEX_AI_ENDPOINT_ID || ((_c = config.vertexai) === null || _c === void 0 ? void 0 : _c.endpoint_id) || "1435927001503367168";
        const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || ((_d = config.vertexai) === null || _d === void 0 ? void 0 : _d.deployed_index_id) || "confluence_embeddings_endp_1757347487752";
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
        const location = process.env.VERTEX_AI_LOCATION || ((_e = config.vertexai) === null || _e === void 0 ? void 0 : _e.location) || "asia-northeast1";
        // エンドポイントの確認
        const indexEndpointApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}`;
        try {
            // インデックスエンドポイントの情報を取得
            const endpointResponse = await axios_1.default.get(indexEndpointApiUrl, {
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[uploadToVectorSearch] Successfully retrieved index endpoint info`);
            // デプロイされているインデックスを確認
            if (endpointResponse.data.deployedIndexes) {
                const deployedIndexes = endpointResponse.data.deployedIndexes;
                console.log(`[uploadToVectorSearch] Found ${deployedIndexes.length} deployed indexes`);
                // デプロイされたインデックスIDが存在するか確認
                const deployedIndex = deployedIndexes.find((di) => di.id === deployedIndexId);
                if (!deployedIndex) {
                    console.warn(`[uploadToVectorSearch] Warning: Deployed index ID ${deployedIndexId} not found in endpoint`);
                    console.log(`[uploadToVectorSearch] Available deployed indexes:`, deployedIndexes.map((di) => di.id));
                }
            }
        }
        catch (error) {
            console.warn(`[uploadToVectorSearch] Warning: Failed to get index endpoint info: ${error.message}`);
        }
        // バッチ更新エンドポイント
        const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:batchUpdateDatapoints`;
        // リクエストボディ
        const requestBody = {
            deployedIndexId: deployedIndexId,
            gcsSource: {
                uris: [`gs://${bucketName}/${filename}`]
            }
        };
        console.log(`[uploadToVectorSearch] Request body:`, JSON.stringify(requestBody, null, 2));
        // APIリクエストを送信
        const response = await axios_1.default.post(apiEndpoint, requestBody, {
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`[uploadToVectorSearch] Batch update initiated successfully:`, response.data);
        // 非同期操作の完了を待つ
        const operationId = response.data.name.split('/').pop();
        await waitForOperation(numericProjectId, operationId);
    }
    catch (error) {
        console.error(`[uploadToVectorSearch] Error uploading to Vector Search: ${error.message}`);
        if (axios_1.default.isAxiosError(error) && error.response) {
            console.error('[uploadToVectorSearch] API response error:', {
                status: error.response.status,
                data: error.response.data
            });
        }
        throw new Error(`Failed to upload to Vector Search: ${error.message}`);
    }
}
/**
 * 非同期操作の完了を待つ
 * @param projectId プロジェクトID
 * @param operationId 操作ID
 */
async function waitForOperation(projectId, operationId) {
    try {
        console.log(`[waitForOperation] Waiting for operation ${operationId} to complete`);
        // 認証トークンを取得
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token || !token.token) {
            throw new Error("Failed to get access token");
        }
        // 操作のステータスを確認するエンドポイント
        const apiEndpoint = `https://asia-northeast1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/asia-northeast1/operations/${operationId}`;
        let completed = false;
        let retries = 0;
        const maxRetries = 30;
        const delay = 10000; // 10秒ごとにチェック
        while (!completed && retries < maxRetries) {
            // APIリクエストを送信
            const response = await axios_1.default.get(apiEndpoint, {
                headers: {
                    'Authorization': `Bearer ${token.token}`
                }
            });
            if (response.data.done) {
                completed = true;
                console.log(`[waitForOperation] Operation ${operationId} completed successfully`);
                if (response.data.error) {
                    throw new Error(`Operation failed: ${JSON.stringify(response.data.error)}`);
                }
            }
            else {
                console.log(`[waitForOperation] Operation ${operationId} still in progress, waiting...`);
                retries++;
                // 待機
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        if (!completed) {
            throw new Error(`Operation timed out after ${maxRetries * delay / 1000} seconds`);
        }
    }
    catch (error) {
        console.error(`[waitForOperation] Error waiting for operation: ${error.message}`);
        throw new Error(`Failed to wait for operation: ${error.message}`);
    }
}
//# sourceMappingURL=vector-search-service.js.map