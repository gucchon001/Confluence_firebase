// このファイルは非推奨です。src/lib/embeddings.ts を使用してください。
// 後方互換性のため、embeddings.tsから関数を再エクスポート

import { getEmbeddings } from './embeddings';

// 後方互換性のためのラッパー関数
export async function embedWithRetry(text: string, maxRetries: number = 3): Promise<number[]> {
  return await getEmbeddings(text);
}

export async function generateEmbeddingsWithDynamicBatch(texts: string[]): Promise<number[][]> {
  return await Promise.all(texts.map(text => getEmbeddings(text)));
}