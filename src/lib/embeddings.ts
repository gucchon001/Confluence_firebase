/**
 * 埋め込みベクトル生成のための抽象化レイヤー（外部API不使用・ローカル実装）
 * キャッシュ機能付きで最適化
 * 
 * Phase 5緊急修正:
 * - ローカルモデルパスを優先（Hugging Faceレートリミット回避）
 * - Xenova Transformers.jsにカスタムモデルパスを指定
 */
import { pipeline, env } from '@xenova/transformers';
import { embeddingCache } from './embedding-cache';
import { EmbeddingConfig } from '@/config/ai-models-config';
import path from 'path';

// ======================= DEBUGLOG =======================
console.log('[DEBUG] Checking Environment Variables before model load:');
console.log(`[DEBUG] HF_HUB_OFFLINE: ${process.env.HF_HUB_OFFLINE}`);
console.log(`[DEBUG] typeof HF_HUB_OFFLINE: ${typeof process.env.HF_HUB_OFFLINE}`);
console.log(`[DEBUG] All env keys: ${Object.keys(process.env).join(', ')}`);
console.log(`[DEBUG] Current working directory: ${process.cwd()}`);
console.log(`[DEBUG] Models path: ${path.join(process.cwd(), 'models')}`);
// ==========================================================

// Xenova Transformers.jsの環境設定
// リモートモデルのダウンロードを無効化（ローカルファイルのみ使用）
env.allowRemoteModels = false;
// カスタムモデルディレクトリを指定
env.localModelPath = path.join(process.cwd(), 'models');

// ★★★ キャッシュクリア設定 ★★★
// 既存のキャッシュを無効化して、強制的にローカルファイルを使用
// env.useBrowserCache = false;  // 型定義にないためコメントアウト
// env.useCustomCache = false;   // 型定義にないためコメントアウト
// キャッシュディレクトリを明示的に指定（書き込み可能な場所）
env.cacheDir = '/tmp/xenova_cache';

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
    // ======================= DEBUGLOG =======================
    console.log('[DEBUG] getLocalEmbeddings called. HF_HUB_OFFLINE is:', process.env.HF_HUB_OFFLINE);
    console.log('[DEBUG] env.allowRemoteModels:', env.allowRemoteModels);
    console.log('[DEBUG] env.localModelPath:', env.localModelPath);
    // ==========================================================
    
    // Phase 5緊急修正: ローカルモデルパスを優先（Hugging Faceレートリミット回避）
    // ★★★ 最終修正: env.localModelPathで指定したディレクトリからモデルをロード ★★★
    const modelName = 'Xenova/paraphrase-multilingual-mpnet-base-v2';
    
    console.log(`[MODEL_LOADER] Attempting to load model: ${modelName}`);
    console.log(`[MODEL_LOADER] Xenova will search in: ${env.localModelPath}`);
    console.log(`[MODEL_LOADER] Remote models allowed: ${env.allowRemoteModels}`);
    
    try {
      // ★★★ 最終手段：モデルファイルの絶対パスを直接指定 ★★★
      // Hugging Faceスタイルのモデル名ではなく、ローカルファイルの絶対パスを使用
      const modelPath = path.join(process.cwd(), 'models', 'paraphrase-multilingual-mpnet-base-v2');
      
      console.log(`[MODEL_LOADER] Using absolute model path: ${modelPath}`);
      
      // モデルファイルの存在確認
      const fs = require('fs');
      if (!fs.existsSync(modelPath)) {
        throw new Error(`Model directory not found: ${modelPath}`);
      }
      
      // 絶対パスでpipelineを初期化
      extractor = await pipeline('feature-extraction', modelPath, {
        cache_dir: '/tmp/model_cache',
        local_files_only: true,
      });
      
      console.log(`✅ [Embedding] Model loaded successfully from local path`);
    } catch (error) {
      console.error(`❌ [Embedding] Failed to load local model:`, error);
      
      // env.allowRemoteModels = false なのでフォールバックは発生しないはず
      throw new Error(`Failed to load embedding model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // 既に正規化済み
}
