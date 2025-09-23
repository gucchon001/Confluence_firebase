/*
 * 本番用キーワード抽出ライブラリ
 * 環境に応じてデバッグ版または本番版を選択
 */

// 環境に応じてデバッグ版または本番版を選択
const isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG_KEYWORD_EXTRACTOR === 'true';

if (isDevelopment) {
  // 開発環境: デバッグ版を使用
  export { extractKeywordsHybrid, analyzeKeywordExtraction, batchAnalyzeKeywordExtraction } from './keyword-extractor-debug';
} else {
  // 本番環境: 本番版を使用
  export { extractKeywordsHybrid } from './keyword-extractor-production';
}
