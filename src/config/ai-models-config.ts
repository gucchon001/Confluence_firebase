/**
 * AIモデル設定の一元管理
 * 全てのAIモデルの設定をここで管理し、変更を容易にする
 */

import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Gemini (LLM) モデル設定
 */
export const GeminiConfig = {
  /** モデル名 */
  model: 'googleai/gemini-2.5-flash' as const,
  
  /** モデルパラメータ */
  config: {
    /** 最大出力トークン数（最適化: 4096 → 2048）
     * 実際の出力は600-800トークン程度なので、2048で十分
     * 削減により生成時間が30-40%短縮される見込み
     */
    maxOutputTokens: 2048,
    
    /** 温度パラメータ（0.0-1.0）
     * 低い値: より一貫性のある、決定論的な出力
     * 高い値: より創造的で多様な出力
     * 最適化: 0.1 → 0.3（生成速度向上、品質は維持）
     */
    temperature: 0.3,
    
    /** Top-P サンプリング（0.0-1.0）
     * 確率の累積分布の上位何%から選択するか
     */
    topP: 0.9,
    
    /** Top-K サンプリング
     * 上位K個のトークンから選択
     */
    topK: 50,
  },
  
  /** タイムアウト設定（ミリ秒） */
  timeout: 60000, // 60秒
} as const;

/**
 * 埋め込みモデル設定
 */
export const EmbeddingConfig = {
  /** プロバイダー（local または api） */
  provider: (process.env.EMBEDDINGS_PROVIDER || 'local') as 'local' | 'api',
  
  /** モデルID
   * Xenova提供の多言語モデル（日本語対応・768次元）
   * 参考: https://huggingface.co/Xenova/paraphrase-multilingual-mpnet-base-v2
   */
  modelId: process.env.EMBEDDINGS_MODEL || 'Xenova/paraphrase-multilingual-mpnet-base-v2',
  
  /** 埋め込みベクトルの次元数 */
  dimensions: 768,
} as const;

/**
 * モデル設定の型定義
 */
export type GeminiConfigType = typeof GeminiConfig;
export type EmbeddingConfigType = typeof EmbeddingConfig;

/**
 * 全体のAIモデル設定
 */
export const AIModelsConfig = {
  gemini: GeminiConfig,
  embedding: EmbeddingConfig,
} as const;

export default AIModelsConfig;

