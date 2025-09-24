/**
 * 埋め込みベクトル生成のための抽象化レイヤー（外部API不使用・ローカル実装）
 */
import * as dotenv from 'dotenv';
dotenv.config();

const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'local';
// Xenova提供の多言語モデル（日本語対応・768次元）
// 参考: https://huggingface.co/Xenova/paraphrase-multilingual-mpnet-base-v2
const MODEL_ID = process.env.EMBEDDINGS_MODEL || 'Xenova/paraphrase-multilingual-mpnet-base-v2';

import { pipeline } from '@xenova/transformers';
let extractor: any | null = null;

export async function getEmbeddings(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが空または文字列ではありません');
  }
  
  // 空のテキストの場合はデフォルトテキストを使用
  if (text.trim().length === 0) {
    text = 'No content available';
  }
  if (PROVIDER !== 'local') {
    // 強制ローカル運用
    // eslint-disable-next-line no-console
    console.warn('EMBEDDINGS_PROVIDERはlocalのみサポート。localとして処理します。');
  }
  return await getLocalEmbeddings(text);
}

// デフォルトエクスポートも追加
export default { getEmbeddings };

async function getLocalEmbeddings(text: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', MODEL_ID);
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // 既に正規化済み
}
