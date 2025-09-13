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
exports.testVectorSearchUploadV2 = void 0;
const functions = __importStar(require("firebase-functions"));
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
// 最小限のテスト関数（埋め込みベクトル形式の変更版）
exports.testVectorSearchUploadV2 = functions
    .region('asia-northeast1')
    .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
})
    .https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e;
    try {
        console.log('[test-v2] Starting minimal Vector Search upload test with alternative embedding format');
        // Firebase config から環境変数を取得
        const config = functions.config();
        const projectId = ((_a = config.vertexai) === null || _a === void 0 ? void 0 : _a.project_id) || process.env.VERTEX_AI_PROJECT_ID;
        if (!projectId) {
            throw new Error('環境変数 VERTEX_AI_PROJECT_ID が設定されていません。');
        }
        const location = ((_b = config.vertexai) === null || _b === void 0 ? void 0 : _b.location) || process.env.VERTEX_AI_LOCATION;
        if (!location) {
            throw new Error('環境変数 VERTEX_AI_LOCATION が設定されていません。');
        }
        const indexId = ((_c = config.vertexai) === null || _c === void 0 ? void 0 : _c.index_id) || process.env.VERTEX_AI_INDEX_ID;
        if (!indexId) {
            throw new Error('環境変数 VERTEX_AI_INDEX_ID が設定されていません。');
        }
        console.log(`[test-v2] Project: ${projectId}, Location: ${location}, Index: ${indexId}`);
        // アクセストークンの取得
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        const accessToken = token.token;
        // インデックスの完全名
        const indexName = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
        console.log(`[test-v2] Using index: ${indexName}`);
        // REST APIのエンドポイント
        const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${indexName}:upsertDatapoints`;
        // テスト用の埋め込みベクトル（768次元）
        const testEmbedding = Array(768).fill(0).map((_, i) => i % 10 / 10);
        // 異なる形式のデータポイントをテスト
        const testDatapoints = [
            // 形式1: 埋め込みベクトルを { values: [...] } 形式で指定
            {
                id: "test-format1-001",
                embedding: { values: testEmbedding },
                metadata: {
                    title: "テストタイトル1",
                    content: "これはテスト用のコンテンツです。形式1"
                }
            },
            // 形式2: 埋め込みベクトルを直接配列で指定（現在の実装）
            {
                id: "test-format2-001",
                embedding: testEmbedding,
                metadata: {
                    title: "テストタイトル2",
                    content: "これはテスト用のコンテンツです。形式2"
                }
            },
            // 形式3: メタデータなし、埋め込みベクトルのみ
            {
                id: "test-format3-001",
                embedding: testEmbedding
            },
            // 形式4: メタデータを文字列として指定
            {
                id: "test-format4-001",
                embedding: testEmbedding,
                metadata: "これはテスト用のコンテンツです。形式4"
            }
        ];
        // 各形式を個別にテスト
        const results = [];
        for (let i = 0; i < testDatapoints.length; i++) {
            const datapoint = testDatapoints[i];
            console.log(`[test-v2] Testing format ${i + 1}:`, JSON.stringify(datapoint, null, 2));
            try {
                const response = await axios_1.default.post(apiEndpoint, { datapoints: [datapoint] }, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                console.log(`[test-v2] Format ${i + 1} upload successful:`, response.status);
                console.log(`[test-v2] Response data:`, JSON.stringify(response.data, null, 2));
                results.push({
                    format: i + 1,
                    status: 'success',
                    statusCode: response.status,
                    data: response.data
                });
            }
            catch (err) {
                console.error(`[test-v2] Format ${i + 1} upload error:`, err.message);
                if (err.response) {
                    console.error(`[test-v2] Error status:`, err.response.status);
                    if (err.response.data) {
                        console.error(`[test-v2] Error data:`, JSON.stringify(err.response.data, null, 2));
                        if (err.response.data.error) {
                            console.error(`[test-v2] Error message:`, err.response.data.error.message);
                        }
                    }
                }
                results.push({
                    format: i + 1,
                    status: 'error',
                    statusCode: ((_d = err.response) === null || _d === void 0 ? void 0 : _d.status) || 500,
                    error: ((_e = err.response) === null || _e === void 0 ? void 0 : _e.data) || { message: err.message }
                });
            }
            // 連続リクエスト間で少し待機
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        // 結果をレスポンスとして返す
        res.status(200).json({
            status: 'completed',
            message: 'Vector Search test upload with multiple formats completed',
            results: results
        });
    }
    catch (error) {
        console.error('[test-v2] Function error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Unknown error'
        });
    }
});
//# sourceMappingURL=minimal-test-v2.js.map