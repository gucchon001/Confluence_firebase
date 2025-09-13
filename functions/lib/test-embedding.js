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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 埋め込みベクトル生成のテスト
 */
const dotenv = __importStar(require("dotenv"));
const vertexai_1 = require("@google-cloud/vertexai");
// 環境変数の読み込み
dotenv.config();
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== 埋め込みベクトル生成のテスト開始 =====');
        // プロジェクトIDを取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = 'asia-northeast1';
        console.log(`[main] Using project ID: ${projectId}`);
        console.log(`[main] Using location: ${location}`);
        // Vertex AI クライアントの初期化
        const vertexai = new vertexai_1.VertexAI({
            project: projectId,
            location: location,
        });
        console.log(`[main] Initialized Vertex AI client`);
        // テキスト埋め込みモデルの設定
        const textEmbeddingModel = "text-embedding-004";
        // テスト用のテキスト
        const testText = "これはVertex AI Embedding APIのテストです。";
        console.log(`[main] Getting embedding for text: "${testText}"`);
        // 埋め込みベクトルを生成
        try {
            // モデルの取得
            const embeddingModel = vertexai.preview.getGenerativeModel({
                model: textEmbeddingModel,
            });
            console.log(`[main] Got embedding model`);
            // 利用可能なメソッドを確認
            console.log(`[main] Available methods:`, Object.getOwnPropertyNames(Object.getPrototypeOf(embeddingModel)));
            // 埋め込みベクトルの生成
            // Note: Vertex AI APIのバージョンによって適切なメソッド名が異なる場合があります
            try {
                // 方法1: generateContent
                console.log(`[main] Trying generateContent method...`);
                const response1 = await embeddingModel.generateContent({
                    contents: [{ role: "user", parts: [{ text: testText }] }],
                });
                console.log(`[main] generateContent successful!`);
                console.log(`[main] Response:`, JSON.stringify(response1, null, 2));
            }
            catch (error1) {
                console.log(`[main] generateContent failed:`, error1.message);
                try {
                    // 方法2: batchEmbedContents
                    console.log(`[main] Trying batchEmbedContents method...`);
                    const response2 = await embeddingModel.batchEmbedContents({
                        requests: [{ content: { text: testText } }]
                    });
                    console.log(`[main] batchEmbedContents successful!`);
                    console.log(`[main] Response:`, JSON.stringify(response2, null, 2));
                }
                catch (error2) {
                    console.log(`[main] batchEmbedContents failed:`, error2.message);
                    try {
                        // 方法3: raw REST API
                        console.log(`[main] Trying raw REST API...`);
                        const { GoogleAuth } = require('google-auth-library');
                        const axios = require('axios');
                        const auth = new GoogleAuth({
                            scopes: ['https://www.googleapis.com/auth/cloud-platform']
                        });
                        const client = await auth.getClient();
                        const token = await client.getAccessToken();
                        const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${textEmbeddingModel}:predict`;
                        const response3 = await axios.post(apiEndpoint, {
                            instances: [{ content: testText }]
                        }, {
                            headers: {
                                'Authorization': `Bearer ${token.token}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        console.log(`[main] Raw REST API successful!`);
                        console.log(`[main] Response status:`, response3.status);
                        console.log(`[main] Embedding dimensions:`, response3.data.predictions[0].embeddings.values.length);
                        console.log(`[main] First 5 values:`, response3.data.predictions[0].embeddings.values.slice(0, 5));
                    }
                    catch (error3) {
                        console.log(`[main] Raw REST API failed:`, error3.message);
                        if (error3.response) {
                            console.log(`[main] Response status:`, error3.response.status);
                            console.log(`[main] Response data:`, error3.response.data);
                        }
                        throw new Error(`All embedding methods failed`);
                    }
                }
            }
        }
        catch (error) {
            console.error(`[main] Error generating embedding:`, error.message);
            throw error;
        }
        console.log('\n===== 埋め込みベクトル生成のテスト完了 =====');
    }
    catch (error) {
        console.error(`[main] Error:`, error.message);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-embedding.js.map