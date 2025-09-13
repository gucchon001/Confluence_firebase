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
exports.testVectorSearchUploadV4 = void 0;
const functions = __importStar(require("firebase-functions"));
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
// 最小限のテスト関数（エラー詳細表示強化版）
exports.testVectorSearchUploadV4 = functions
    .region('asia-northeast1')
    .runWith({
    timeoutSeconds: 540,
    memory: '1GB'
})
    .https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        console.log('[test-v4] Starting minimal Vector Search upload test with enhanced error logging');
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
        console.log(`[test-v4] Project: ${projectId}, Location: ${location}, Index: ${indexId}`);
        // アクセストークンの取得
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        const accessToken = token.token;
        // インデックスの完全名
        const indexName = `projects/${projectId}/locations/${location}/indexes/${indexId}`;
        console.log(`[test-v4] Using index: ${indexName}`);
        // REST APIのエンドポイント
        const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/${indexName}:upsertDatapoints`;
        // テスト用の埋め込みベクトル（768次元）
        const testEmbedding = Array(768).fill(0).map((_, i) => i % 10 / 10);
        // API仕様に準拠した正しいデータポイント形式
        const correctDatapoints = [
            // 形式1: 最もシンプルな形式（必須フィールドのみ）
            {
                datapoint_id: "test-correct-format-001",
                feature_vector: testEmbedding
            }
        ];
        // 各形式を個別にテスト
        const results = [];
        for (let i = 0; i < correctDatapoints.length; i++) {
            const datapoint = correctDatapoints[i];
            console.log(`[test-v4] Testing format ${i + 1}:`, JSON.stringify(datapoint, null, 2));
            try {
                const response = await axios_1.default.post(apiEndpoint, { datapoints: [datapoint] }, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                console.log(`[test-v4] Format ${i + 1} upload successful:`, response.status);
                console.log(`[test-v4] Response data:`, JSON.stringify(response.data, null, 2));
                results.push({
                    format: i + 1,
                    status: 'success',
                    statusCode: response.status,
                    data: response.data
                });
            }
            catch (err) {
                console.error(`[test-v4] Format ${i + 1} upload error:`, err.message);
                if (err.response) {
                    console.error(`[test-v4] Error status:`, err.response.status);
                    // エラーデータを完全に文字列化して出力
                    console.error(`[test-v4] Error data (Full):`, JSON.stringify(err.response.data, null, 2));
                    // エラーオブジェクトの各プロパティを個別に出力
                    if (err.response.data && err.response.data.error) {
                        console.error(`[test-v4] Error code:`, err.response.data.error.code);
                        console.error(`[test-v4] Error message:`, err.response.data.error.message);
                        console.error(`[test-v4] Error status:`, err.response.data.error.status);
                        if (err.response.data.error.details) {
                            console.error(`[test-v4] Error details:`, JSON.stringify(err.response.data.error.details, null, 2));
                        }
                    }
                }
                else {
                    console.error('[test-v4] Error without response:', err);
                }
                // エラー情報を結果に追加
                results.push({
                    format: i + 1,
                    status: 'error',
                    statusCode: ((_d = err.response) === null || _d === void 0 ? void 0 : _d.status) || 500,
                    error: ((_e = err.response) === null || _e === void 0 ? void 0 : _e.data) ? JSON.stringify(err.response.data) : err.message
                });
            }
        }
        // 結果をレスポンスとして返す
        res.status(200).json({
            status: 'completed',
            message: 'Vector Search test upload with enhanced error logging completed',
            results: results
        });
    }
    catch (error) {
        console.error('[test-v4] Function error:', error);
        // 関数全体のエラーも詳細に出力
        if (error.response) {
            console.error('[test-v4] Error response status:', error.response.status);
            console.error('[test-v4] Error response data (Full):', JSON.stringify(error.response.data, null, 2));
        }
        res.status(500).json({
            status: 'error',
            message: error.message || 'Unknown error',
            error: ((_f = error.response) === null || _f === void 0 ? void 0 : _f.data) ? JSON.stringify(error.response.data) : 'No detailed error data'
        });
    }
});
//# sourceMappingURL=minimal-test-v4.js.map