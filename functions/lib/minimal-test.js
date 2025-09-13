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
exports.testVectorSearchUpload = void 0;
const functions = __importStar(require("firebase-functions"));
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
// 最小限のテスト関数
exports.testVectorSearchUpload = functions
    .region('asia-northeast1')
    .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
})
    .https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    try {
        console.log('[test] Starting minimal Vector Search upload test');
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
        console.log(`[test] Project: ${projectId}, Location: ${location}, Index: ${indexId}`);
        // アクセストークンの取得
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        const accessToken = token.token;
        // インデックスの完全名
        const indexName = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
        console.log(`[test] Using index: ${indexName}`);
        // REST APIのエンドポイント
        const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${indexName}:upsertDatapoints`;
        // テスト用の最小限のデータポイント
        const testDatapoint = {
            id: "test-datapoint-001",
            embedding: Array(768).fill(0).map((_, i) => i % 10 / 10), // 768次元のテスト用ベクトル
            restricts: [
                {
                    namespace: "content_type",
                    allow: ["test_data"]
                }
            ],
            crowding_tag: "test-page",
            metadata: {
                title: "テストタイトル",
                url: "https://example.com/test",
                content: "これはテスト用のコンテンツです。"
            }
        };
        // リクエストの内容をログに出力
        console.log('[test] Request payload:', JSON.stringify({ datapoints: [testDatapoint] }, null, 2));
        // REST APIリクエスト
        try {
            const response = await axios_1.default.post(apiEndpoint, { datapoints: [testDatapoint] }, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            });
            console.log('[test] Upload successful:', response.status);
            console.log('[test] Response data:', JSON.stringify(response.data, null, 2));
            res.status(200).json({
                status: 'success',
                message: 'Vector Search test upload completed',
                response: response.data
            });
        }
        catch (err) {
            console.error('[test] Upload error:', err.message);
            if (err.response) {
                console.error('[test] Error status:', err.response.status);
                if (err.response.data) {
                    console.error('[test] Error data:', JSON.stringify(err.response.data, null, 2));
                    // Google APIのエラー形式に対応
                    if (err.response.data.error) {
                        console.error('[test] Error code:', err.response.data.error.code);
                        console.error('[test] Error message:', err.response.data.error.message);
                        console.error('[test] Error status:', err.response.data.error.status);
                        if (err.response.data.error.details) {
                            console.error('[test] Error details:', JSON.stringify(err.response.data.error.details, null, 2));
                        }
                    }
                }
            }
            res.status(500).json({
                status: 'error',
                message: err.message || 'Unknown error',
                error: ((_d = err.response) === null || _d === void 0 ? void 0 : _d.data) || {}
            });
        }
    }
    catch (error) {
        console.error('[test] Function error:', error);
        res.status(500).json({
            status: 'error',
            message: error.message || 'Unknown error'
        });
    }
});
//# sourceMappingURL=minimal-test.js.map