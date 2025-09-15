/**
 * 埋め込みベクトル生成のための抽象化レイヤー（外部API不使用・ローカル実装）
 */
import * as dotenv from 'dotenv';
dotenv.config();

const PROVIDER = process.env.EMBEDDINGS_PROVIDER || 'local';

// 768次元モデル（Xenova/all-mpnet-base-v2）
import { pipeline } from '@xenova/transformers';
let extractor: any | null = null;

export async function getEmbeddings(text: string): Promise<number[]> {
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが空または文字列ではありません');
  }
  if (PROVIDER !== 'local') {
    // 強制ローカル運用
    // eslint-disable-next-line no-console
    console.warn('EMBEDDINGS_PROVIDERはlocalのみサポート。localとして処理します。');
  }
  return await getLocalEmbeddings(text);
}

async function getLocalEmbeddings(text: string): Promise<number[]> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', 'Xenova/all-mpnet-base-v2');
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  // 既に正規化済み
  return Array.from(output.data); // 768次元
}
