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
    // ★★★ 実行時に環境設定 ★★★
    const cwd = process.cwd();
    env.localModelPath = cwd;
    env.allowRemoteModels = false;
    
    console.log(`[MODEL_LOADER] ===== モデルロード開始 =====`);
    console.log(`[MODEL_LOADER] process.cwd(): ${cwd}`);
    console.log(`[MODEL_LOADER] env.localModelPath: ${env.localModelPath}`);
    console.log(`[MODEL_LOADER] env.allowRemoteModels: ${env.allowRemoteModels}`);
    
    // 絶対パスを直接指定
    const absoluteModelPath = path.join(cwd, 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');
    console.log(`[MODEL_LOADER] Absolute model path: ${absoluteModelPath}`);
    
    // ファイル存在確認
    const fs = require('fs');
    if (fs.existsSync(absoluteModelPath)) {
      console.log(`[MODEL_LOADER] ✅ モデルディレクトリが存在します`);
      const files = fs.readdirSync(absoluteModelPath);
      console.log(`[MODEL_LOADER]   ファイル数: ${files.length}`);
      
      // tokenizer.jsonの存在確認
      const tokenizerPath = path.join(absoluteModelPath, 'tokenizer.json');
      if (fs.existsSync(tokenizerPath)) {
        console.log(`[MODEL_LOADER] ✅ tokenizer.json が存在します`);
        const stat = fs.statSync(tokenizerPath);
        console.log(`[MODEL_LOADER]   tokenizer.json size: ${(stat.size / 1024).toFixed(2)} KB`);
      } else {
        console.error(`[MODEL_LOADER] ❌ tokenizer.json が見つかりません`);
      }
    } else {
      console.log(`[MODEL_LOADER] ❌ モデルディレクトリが見つかりません`);
    }
    
    console.log(`[MODEL_LOADER] Environment variables:`);
    console.log(`[MODEL_LOADER]   HF_HUB_OFFLINE=${process.env.HF_HUB_OFFLINE}`);
    console.log(`[MODEL_LOADER]   TRANSFORMERS_CACHE=${process.env.TRANSFORMERS_CACHE}`);
    
    try {
      // 絶対パスを直接指定
      console.log(`[MODEL_LOADER] Attempting to load model from absolute path: ${absoluteModelPath}`);
      extractor = await pipeline('feature-extraction', absoluteModelPath, {
        local_files_only: true,
      });
      console.log(`[MODEL_LOADER] ✅ モデル読み込み成功`);
    } catch (error) {
      console.error(`[MODEL_LOADER] ❌ モデル読み込み失敗:`, error);
      // エラーの詳細を出力
      if (error instanceof Error) {
        console.error(`[MODEL_LOADER] Error name: ${error.name}`);
        console.error(`[MODEL_LOADER] Error message: ${error.message}`);
        console.error(`[MODEL_LOADER] Error stack: ${error.stack}`);
      }
      throw new Error(`Failed to load embedding model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
