/**
 * 埋め込みベクトル生成のための抽象化レイヤー（Gemini Embeddings API使用）
 * キャッシュ機能付きで最適化
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
// embedding-cacheはアーカイブに移動済み。簡易キャッシュ実装を使用

// 簡易キャッシュ（メモリ内のみ）
const embeddingCache = new Map<string, { embedding: number[]; timestamp: number }>();

let genAI: GoogleGenerativeAI | null = null;
let embeddingModel: any | null = null;

export async function getEmbeddings(text: string): Promise<number[]> {
  const startTime = Date.now();
  
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが空または文字列ではありません');
  }
  
  // BOM文字（U+FEFF）を確実に削除（埋め込み生成エラーを防ぐため）
  // 複数の方法でBOMを除去して確実性を高める
  // 1. 文字列全体からBOMを削除
  text = text.replace(/\uFEFF/g, '');
  // 2. 文字列の先頭からBOMを削除（念のため）
  if (text.length > 0 && text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  // 3. trim()の前に再度BOMを削除
  text = text.replace(/^\uFEFF+|\uFEFF+$/g, '').trim();
  
  // 空のテキストの場合はデフォルトテキストを使用
  if (text.length === 0) {
    text = 'No content available';
  }

  // 簡易キャッシュ（メモリ内のみ）
  const cacheKey = `embedding:${text.substring(0, 100)}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) { // 15分TTL
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.log(`🚀 埋め込みベクトルをキャッシュから取得 (${duration}ms): ${text.substring(0, 50)}...`);
    }
    return cached.embedding;
  }

  // Phase 0A-4: 埋め込み生成の開始ログ（本番環境でも遅延検知のため）
  const generationStartTime = Date.now();
  console.log(`🔍 埋め込みベクトル生成中: ${text.substring(0, 50)}...`);
  
  // Gemini Embeddings APIを使用
  const EMBEDDING_TIMEOUT = 30000; // 30秒
  const embedding = await Promise.race([
    getGeminiEmbeddings(text),
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Embedding generation timeout after ${EMBEDDING_TIMEOUT}ms`)), EMBEDDING_TIMEOUT)
    )
  ]);
  
  const generationDuration = Date.now() - generationStartTime;
  // Phase 0A-4: 遅い埋め込み生成を警告（1秒以上）
  if (generationDuration > 1000) {
    console.warn(`⚠️ [Embedding] Slow generation: ${generationDuration}ms for text: ${text.substring(0, 100)}...`);
  }
  
  // キャッシュに保存
  embeddingCache.set(cacheKey, { embedding, timestamp: Date.now() });
  
  // キャッシュサイズが大きくなりすぎないように制限（1000エントリ）
  if (embeddingCache.size > 1000) {
    const firstKey = embeddingCache.keys().next().value;
    embeddingCache.delete(firstKey);
  }
  
  const totalDuration = Date.now() - startTime;
  if (totalDuration > 1000) {
    console.log(`✅ [Embedding] Total time: ${totalDuration}ms (generation: ${generationDuration}ms, cache: ${totalDuration - generationDuration}ms)`);
  }
  
  return embedding;
}

// デフォルトエクスポートも追加
export default { getEmbeddings };

async function getGeminiEmbeddings(text: string): Promise<number[]> {
  // Gemini Embeddings API を初期化
  if (!genAI) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  
  if (!embeddingModel) {
    embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  }
  
  // BOM文字（U+FEFF）を確実に削除（埋め込み生成エラーを防ぐため）
  // 複数の方法でBOMを除去して確実性を高める
  let cleanText = text;
  // 1. 文字列全体からBOMを削除
  cleanText = cleanText.replace(/\uFEFF/g, '');
  // 2. 文字列の先頭からBOMを削除（念のため）
  if (cleanText.length > 0 && cleanText.charCodeAt(0) === 0xFEFF) {
    cleanText = cleanText.slice(1);
  }
  // 3. trim()の前に再度BOMを削除
  cleanText = cleanText.replace(/^\uFEFF+|\uFEFF+$/g, '').trim();
  
  // 空文字列の場合はデフォルトテキストを使用
  if (cleanText.length === 0) {
    cleanText = 'No content available';
  }
  
  try {
    const result = await embeddingModel.embedContent(cleanText);
    
    // Gemini Embeddings API のレスポンス形式に応じて取得
    // text-embedding-004 の場合は result.embedding.values を返す
    if (result.embedding && 'values' in result.embedding) {
      return result.embedding.values as number[];
    } else {
      // 互換性のため、異なるレスポンス形式にも対応
      return result.embedding as any;
    }
  } catch (error) {
    console.error(`❌ [Embedding] Failed to generate embedding via Gemini API:`, error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
  }
}
