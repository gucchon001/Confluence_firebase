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
 * Vector Search APIのエラー詳細調査
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
        console.log('===== Vector Search APIのエラー詳細調査開始 =====');
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
        // 1. エンドポイント情報の取得
        console.log(`\n[main] 1. エンドポイント情報の取得`);
        const indexEndpointApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}`;
        console.log(`[main] Endpoint URL: ${indexEndpointApiUrl}`);
        try {
            const endpointResponse = await axios_1.default.get(indexEndpointApiUrl, {
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[main] Endpoint response status: ${endpointResponse.status}`);
            console.log(`[main] Endpoint info:`, JSON.stringify(endpointResponse.data, null, 2));
            // デプロイされているインデックスを確認
            if (endpointResponse.data.deployedIndexes) {
                const deployedIndexes = endpointResponse.data.deployedIndexes;
                console.log(`[main] Found ${deployedIndexes.length} deployed indexes`);
                for (const deployedIndex of deployedIndexes) {
                    console.log(`[main] - ID: ${deployedIndex.id}`);
                    console.log(`[main] - Index: ${deployedIndex.index}`);
                    console.log(`[main] - Display name: ${deployedIndex.displayName || 'N/A'}`);
                }
            }
            else {
                console.log(`[main] No deployed indexes found`);
            }
        }
        catch (error) {
            console.error(`[main] Error getting endpoint info: ${error.message}`);
            if (axios_1.default.isAxiosError(error) && error.response) {
                console.error('[main] API response error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
        }
        // 2. インデックス情報の取得
        console.log(`\n[main] 2. インデックス情報の取得`);
        const indexId = process.env.VERTEX_AI_INDEX_ID || '7360896096425476096';
        const indexApiUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexes/${indexId}`;
        console.log(`[main] Index URL: ${indexApiUrl}`);
        try {
            const indexResponse = await axios_1.default.get(indexApiUrl, {
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[main] Index response status: ${indexResponse.status}`);
            console.log(`[main] Index info:`, JSON.stringify(indexResponse.data, null, 2));
            // メタデータを確認
            if (indexResponse.data.metadata) {
                console.log(`[main] Index metadata:`, JSON.stringify(indexResponse.data.metadata, null, 2));
            }
            // 更新メソッドを確認
            console.log(`[main] Index update method: ${indexResponse.data.indexUpdateMethod || 'N/A'}`);
        }
        catch (error) {
            console.error(`[main] Error getting index info: ${error.message}`);
            if (axios_1.default.isAxiosError(error) && error.response) {
                console.error('[main] API response error:', {
                    status: error.response.status,
                    data: error.response.data
                });
            }
        }
        // 3. バッチ更新エンドポイントのテスト
        console.log(`\n[main] 3. バッチ更新エンドポイントのテスト`);
        // 3.1 batchUpdateDatapoints
        console.log(`\n[main] 3.1 batchUpdateDatapoints エンドポイントのテスト`);
        const batchUpdateUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:batchUpdateDatapoints`;
        console.log(`[main] Batch update URL: ${batchUpdateUrl}`);
        try {
            const options = {
                method: 'OPTIONS',
                url: batchUpdateUrl,
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            };
            const optionsResponse = await (0, axios_1.default)(options);
            console.log(`[main] OPTIONS response:`, optionsResponse.data);
        }
        catch (error) {
            console.log(`[main] OPTIONS request failed: ${error.message}`);
            // OPTIONSリクエストは失敗することが予想されるので、エラーは無視
        }
        // 3.2 upsertDatapoints
        console.log(`\n[main] 3.2 upsertDatapoints エンドポイントのテスト`);
        const upsertUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${numericProjectId}/locations/${location}/indexEndpoints/${indexEndpointId}:upsertDatapoints`;
        console.log(`[main] Upsert URL: ${upsertUrl}`);
        try {
            const options = {
                method: 'OPTIONS',
                url: upsertUrl,
                headers: {
                    'Authorization': `Bearer ${token.token}`,
                    'Content-Type': 'application/json'
                }
            };
            const optionsResponse = await (0, axios_1.default)(options);
            console.log(`[main] OPTIONS response:`, optionsResponse.data);
        }
        catch (error) {
            console.log(`[main] OPTIONS request failed: ${error.message}`);
            // OPTIONSリクエストは失敗することが予想されるので、エラーは無視
        }
        // 4. 公式ドキュメントのURLをチェック
        console.log(`\n[main] 4. 公式ドキュメントのURLをチェック`);
        const docsUrl = 'https://cloud.google.com/vertex-ai/docs/vector-search/update-index-data';
        try {
            const docsResponse = await axios_1.default.get(docsUrl);
            console.log(`[main] Documentation URL status: ${docsResponse.status}`);
        }
        catch (error) {
            console.error(`[main] Error accessing documentation: ${error.message}`);
        }
        console.log('\n===== Vector Search APIのエラー詳細調査完了 =====');
    }
    catch (error) {
        console.error(`[main] Error: ${error.message}`);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-vector-search-detailed-error.js.map