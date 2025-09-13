/**
 * 埋め込みベクトル生成サービス
 */
import { VertexAI } from '@google-cloud/vertexai';
import * as config from './config';

/**
 * Vertex AI クライアントの初期化
 */
const vertexai = new VertexAI({
  project: process.env.VERTEX_AI_PROJECT_ID || config.vertexai?.project_id || '',
  location: process.env.VERTEX_AI_LOCATION || 'asia-northeast1',
});

/**
 * テキストの埋め込みベクトルを生成する
 * @param text テキスト
 * @returns 埋め込みベクトル（数値配列）
 */
export async function generateEmbedding(text: string): Promise<number[]> {
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
    const projectId = process.env.VERTEX_AI_PROJECT_ID || config.vertexai?.project_id || '';
    
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
  } catch (error: any) {
    console.error(`[generateEmbedding] Error generating embedding: ${error.message}`);
    throw new Error(`Failed to generate embedding: ${error.message}`);
  }
}

/**
 * 複数のテキストに対して埋め込みベクトルを生成する
 * @param records テキストレコードの配列
 * @returns 埋め込みベクトル付きのレコード配列
 */
export async function generateEmbeddings(records: any[]): Promise<any[]> {
  try {
    console.log(`[generateEmbeddings] Generating embeddings for ${records.length} records`);
    
    const recordsWithEmbeddings = [];
    
    // 各レコードに対して埋め込みベクトルを生成
    for (const record of records) {
      try {
        const embedding = await generateEmbedding(record.content);
        recordsWithEmbeddings.push({
          ...record,
          embedding
        });
      } catch (error: any) {
        console.error(`[generateEmbeddings] Error generating embedding for record ${record.pageId}-${record.chunkIndex}: ${error.message}`);
        // エラーが発生したレコードはスキップ
      }
    }
    
    console.log(`[generateEmbeddings] Successfully generated embeddings for ${recordsWithEmbeddings.length}/${records.length} records`);
    return recordsWithEmbeddings;
  } catch (error: any) {
    console.error(`[generateEmbeddings] Error generating embeddings: ${error.message}`);
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}