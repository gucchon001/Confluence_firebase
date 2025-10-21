/**
 * 埋め込みベクトル生成のための抽象化レイヤー（外部API不使用・ローカル実装）
 * キャッシュ機能付きで最適化
 * 
 * Phase 5緊急修正:
 * - ローカルモデルパスを優先（Hugging Faceレートリミット回避）
 */
import { pipeline } from '@xenova/transformers';
import { embeddingCache } from './embedding-cache';
import { EmbeddingConfig } from '@/config/ai-models-config';
import path from 'path';

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
    // Phase 5緊急修正: ローカルモデルパスを優先（Hugging Faceレートリミット回避）
    // 相対パスを使用（Xenova Transformers.jsが自動的にプレフィックスを追加するため）
    const relativeModelPath = './models/paraphrase-multilingual-mpnet-base-v2';
    const fs = require('fs');
    
    // デバッグ用：実際に使用されるパスをログ出力
    console.log(`[MODEL_LOADER] Current working directory: ${process.cwd()}`);
    console.log(`[MODEL_LOADER] Relative model path: ${relativeModelPath}`);
    
    // 存在確認のために絶対パスを使用
    const absolutePathForCheck = path.resolve(process.cwd(), relativeModelPath);
    const hasLocalModel = fs.existsSync(absolutePathForCheck) && 
                          fs.existsSync(path.join(absolutePathForCheck, 'config.json'));
    
    console.log(`[MODEL_LOADER] Checking model at: ${absolutePathForCheck}`);
    console.log(`[MODEL_LOADER] Model exists: ${hasLocalModel}`);
    
    if (hasLocalModel) {
      console.log(`✅ [Embedding] Using local model (relative path): ${relativeModelPath}`);
      // cache_dirを/tmpに設定してCloud Runの読み取り専用ファイルシステム問題を回避
      // local_files_onlyを強制してHugging Faceへのネットワークアクセスを完全に禁止
      // 重要：相対パスをそのまま渡す（Xenova Transformers.jsが自動的に処理する）
      extractor = await pipeline('feature-extraction', relativeModelPath, {
        cache_dir: '/tmp/model_cache',
        local_files_only: true,
      });
      console.log(`✅ [Embedding] Model loaded successfully with local_files_only mode`);
    } else {
      console.warn(`⚠️ [Embedding] Local model not found at: ${absolutePathForCheck}`);
      console.warn(`   ⚠️ Risk: Rate limit (429) may occur on Cloud Run`);
      console.warn(`   📝 Run: npm run model:download to cache locally`);
      // フォールバック：Hugging Faceからダウンロード（本番環境では推奨されない）
      extractor = await pipeline('feature-extraction', EmbeddingConfig.modelId, {
        cache_dir: '/tmp/model_cache',
      });
    }
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // 既に正規化済み
}
