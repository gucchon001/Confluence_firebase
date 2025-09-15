/**
 * 埋め込みベクトル生成のための抽象化レイヤー
 * 環境変数 EMBEDDINGS_PROVIDER で local/vertex を切り替え可能
 */

import * as dotenv from 'dotenv';
dotenv.config();

// デフォルトはローカル埋め込み
const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'local';
const VERTEX_MODEL = 'googleai/text-embedding-004';
const LOCAL_MODEL = 'Xenova/all-MiniLM-L6-v2'; // 将来的に追加予定

/**
 * テキストから埋め込みベクトルを生成
 * @param text 埋め込み対象のテキスト
 * @returns 正規化された埋め込みベクトル
 */
export async function getEmbeddings(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが空または文字列ではありません');
  }

  if (PROVIDER === 'vertex') {
    return await getVertexEmbeddings(text);
  } else {
    // デフォルトはローカル埋め込み
    return await getLocalEmbeddings(text);
  }
}

/**
 * Vertex AI Embedding APIを使用した埋め込み生成
 */
async function getVertexEmbeddings(text: string): Promise<number[]> {
  try {
    const { ai } = await import('../ai/genkit');
    const out: any = await ai.embed({ embedder: VERTEX_MODEL, content: text });
    const vec = Array.isArray(out) ? out[0].embedding : out.embedding;
    return normalizeVector(vec);
  } catch (error: any) {
    console.error('Vertex AI 埋め込み生成エラー:', error?.message || error);
    throw new Error(`埋め込み生成に失敗しました: ${error?.message || error}`);
  }
}

/**
 * ローカルモデルを使用した埋め込み生成
 * 注: 現在は未実装。将来的に @xenova/transformers を使用して実装予定
 */
async function getLocalEmbeddings(text: string): Promise<number[]> {
  // 現在は未実装のため、Vertex AI にフォールバック
  console.warn('ローカル埋め込みは未実装です。Vertex AI にフォールバックします。');
  return await getVertexEmbeddings(text);
  
  // 将来的な実装例:
  // const { pipeline } = await import('@xenova/transformers');
  // const embedder = await pipeline('feature-extraction', LOCAL_MODEL);
  // const result = await embedder(text, { pooling: 'mean', normalize: true });
  // return Array.from(result.data);
}

/**
 * ベクトルをL2正規化する
 */
function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map(val => val / norm);
}
