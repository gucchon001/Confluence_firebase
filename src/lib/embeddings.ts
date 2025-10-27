/**
 * 埋め込みベクトル生成のための抽象化レイヤー（外部API不使用・ローカル実装）
 * キャッシュ機能付きで最適化
 * 
 * ★★★ 最終推奨設定 ★★★
 * - モデルファイルはprebuildでダウンロード済み
 * - CopyPluginでコンテナに確実に含める
 * - env.localModelPathでベースパスを明示、pipelineにはモデル名を渡す
 */
import { pipeline, env } from '@xenova/transformers';
import { embeddingCache } from './embedding-cache';
import { EmbeddingConfig } from '@/config/ai-models-config';
import path from 'path';

// ★★★ 最終推奨設定 ★★★
// envオブジェクトの操作は一切行わない
// pipeline()に渡す絶対パスで全て解決する

let extractor: any | null = null;

export async function getEmbeddings(text: string): Promise<number[]> {
  const startTime = Date.now();
  
  if (!text || typeof text !== 'string') {
    throw new Error('テキストが空または文字列ではありません');
  }
  
  // 空のテキストの場合はデフォルトテキストを使用
  if (text.trim().length === 0) {
    text = 'No content available';
  }

  // キャッシュから取得を試行
  const cachedEmbedding = await embeddingCache.getCachedEmbedding(text);
  if (cachedEmbedding) {
    const duration = Date.now() - startTime;
    if (duration > 100) {
      console.log(`🚀 埋め込みベクトルをキャッシュから取得 (${duration}ms): ${text.substring(0, 50)}...`);
    }
    return cachedEmbedding;
  }

  // Phase 0A-4: 埋め込み生成の開始ログ（本番環境でも遅延検知のため）
  const generationStartTime = Date.now();
  console.log(`🔍 埋め込みベクトル生成中: ${text.substring(0, 50)}...`);
  
  if (EmbeddingConfig.provider !== 'local') {
    // 強制ローカル運用
    // eslint-disable-next-line no-console
    console.warn('EMBEDDINGS_PROVIDERはlocalのみサポート。localとして処理します。');
  }
  
  // Phase 0A-4: タイムアウト処理を追加（30秒）
  const EMBEDDING_TIMEOUT = 30000; // 30秒
  const embedding = await Promise.race([
    getLocalEmbeddings(text),
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
  await embeddingCache.setCachedEmbedding(text, embedding);
  
  const totalDuration = Date.now() - startTime;
  if (totalDuration > 1000) {
    console.log(`✅ [Embedding] Total time: ${totalDuration}ms (generation: ${generationDuration}ms, cache: ${totalDuration - generationDuration}ms)`);
  }
  
  return embedding;
}

// デフォルトエクスポートも追加
export default { getEmbeddings };

async function getLocalEmbeddings(text: string): Promise<number[]> {
  if (!extractor) {
    // ★★★ 最終実装: 絶対パスで明示的に指定 ★★★
    // ファイルは /workspace/.next/standalone/Xenova/paraphrase-multilingual-mpnet-base-v2/ に配置されている
    // ライブラリに直接このパスを指定して、確実にローカルファイルを読み込む
    const modelPath = path.join(process.cwd(), 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');
    
    console.log(`[MODEL_LOADER] Loading model from absolute path: ${modelPath}`);
    console.log(`[MODEL_LOADER] process.cwd(): ${process.cwd()}`);
    console.log(`[MODEL_LOADER] Remote models allowed: ${env.allowRemoteModels}`);
    
    try {
      // modelPathを直接渡して、ローカルファイルを強制的に読み込む
      extractor = await pipeline('feature-extraction', modelPath, {
        local_files_only: true, // オフラインモード強制
      });
      console.log(`✅ [Embedding] Model loaded successfully from local path: ${modelPath}`);
    } catch (error) {
      console.error(`❌ [Embedding] Failed to load local model:`, error);
      throw new Error(`Failed to load embedding model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
