/**
 * AIモデル設定の一元管理
 * 全てのAIモデルの設定をここで管理し、変更を容易にする
 */

import * as dotenv from 'dotenv';
dotenv.config();

/**
 * Gemini (LLM) モデル設定
 * Phase 5 Week 2: レイテンシ最適化パラメータ追加
 */
export const GeminiConfig = {
  /** モデル名 */
  model: 'googleai/gemini-2.5-flash' as const,
  
  /** モデルパラメータ */
  config: {
    /** 最大出力トークン数
     * 緊急修正: 3000 → 8192に増加
     * Gemini 2.5では内部思考トークン（thoughtsTokens）がmaxOutputTokensを消費する
     * 実際の出力600-800トークン + 思考3000トークン = 最低4000トークン必要
     * 余裕を持たせて8192トークンに設定（品質維持優先）
     */
    maxOutputTokens: 8192,
    
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
    
    /** Phase 5 Week 2: 候補数を1に明示（レイテンシ最適化）
     * デフォルトは1だが、明示することで意図を明確化
     * 品質への影響: なし（元々1候補のみ）
     */
    candidateCount: 1,
    
    /** Phase 5 Week 2: レスポンス形式をプレーンテキストに指定
     * JSON等の構造化データ生成のオーバーヘッドを削減
     * 品質への影響: なし（元々テキストのみ）
     */
    responseMimeType: 'text/plain' as const,
  },
  
  /** タイムアウト設定（ミリ秒） */
  timeout: 60000, // 60秒
} as const;

/**
 * 埋め込みモデル設定
 */
export const EmbeddingConfig = {
  /** プロバイダー（api - Gemini Embeddings API使用） */
  provider: 'api' as const,
  
  /** モデルID
   * text-embedding-004: Gemini Embeddings API（768次元）
   * 参考: https://ai.google.dev/models/gemini#embedding
   */
  modelId: 'text-embedding-004',
  
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

