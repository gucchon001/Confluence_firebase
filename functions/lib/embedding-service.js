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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = generateEmbedding;
exports.generateEmbeddings = generateEmbeddings;
/**
 * 埋め込みベクトル生成サービス
 */
const vertexai_1 = require("@google-cloud/vertexai");
const config = __importStar(require("./config"));
/**
 * Vertex AI クライアントの初期化
 */
const vertexai = new vertexai_1.VertexAI({
    project: process.env.VERTEX_AI_PROJECT_ID || ((_a = config.vertexai) === null || _a === void 0 ? void 0 : _a.project_id) || '',
    location: process.env.VERTEX_AI_LOCATION || 'asia-northeast1',
});
/**
 * テキストの埋め込みベクトルを生成する
 * @param text テキスト
 * @returns 埋め込みベクトル（数値配列）
 */
async function generateEmbedding(text) {
    var _a;
    try {
        console.log(`[generateEmbedding] Generating embedding for text (length: ${text.length})`);
        // 現在のVertex AI APIでの埋め込みベクトル生成方法
        const textEmbeddingModel = "text-embedding-004";
        // REST APIを使用して埋め込みベクトルを生成
        const { GoogleAuth } = require('google-auth-library');
        const axios = require('axios');
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const projectId = process.env.VERTEX_AI_PROJECT_ID || ((_a = config.vertexai) === null || _a === void 0 ? void 0 : _a.project_id) || '';
        const apiEndpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${textEmbeddingModel}:predict`;
        const response = await axios.post(apiEndpoint, {
            instances: [{ content: text }]
        }, {
            headers: {
                'Authorization': `Bearer ${token.token}`,
                'Content-Type': 'application/json'
            }
        });
        // レスポンスから埋め込みベクトルを取得
        const embedding = response.data.predictions[0].embeddings.values;
        console.log(`[generateEmbedding] Generated embedding with ${embedding.length} dimensions`);
        return embedding;
    }
    catch (error) {
        console.error(`[generateEmbedding] Error generating embedding: ${error.message}`);
        throw new Error(`Failed to generate embedding: ${error.message}`);
    }
}
/**
 * 複数のテキストに対して埋め込みベクトルを生成する
 * @param records テキストレコードの配列
 * @returns 埋め込みベクトル付きのレコード配列
 */
async function generateEmbeddings(records) {
    try {
        console.log(`[generateEmbeddings] Generating embeddings for ${records.length} records`);
        const recordsWithEmbeddings = [];
        // 各レコードに対して埋め込みベクトルを生成
        for (const record of records) {
            try {
                const embedding = await generateEmbedding(record.content);
                recordsWithEmbeddings.push(Object.assign(Object.assign({}, record), { embedding }));
            }
            catch (error) {
                console.error(`[generateEmbeddings] Error generating embedding for record ${record.pageId}-${record.chunkIndex}: ${error.message}`);
                // エラーが発生したレコードはスキップ
            }
        }
        console.log(`[generateEmbeddings] Successfully generated embeddings for ${recordsWithEmbeddings.length}/${records.length} records`);
        return recordsWithEmbeddings;
    }
    catch (error) {
        console.error(`[generateEmbeddings] Error generating embeddings: ${error.message}`);
        throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
}
//# sourceMappingURL=embedding-service.js.map