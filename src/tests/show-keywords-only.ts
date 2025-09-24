/**
 * キーワード抽出結果のみを表示するテスト
 */

import { KeywordExtractor } from '../lib/keyword-extractor-spec-compliant';

async function showKeywordsOnly() {
  const query = '教室管理の詳細は';
  
  console.log(`🔍 クエリ: "${query}"`);
  console.log('=' .repeat(50));
  
  const extractor = new KeywordExtractor();
  const result = await extractor.extract(query);
  
  console.log(`📊 総キーワード数: ${result.keywords.length}`);
  console.log(`📊 キーワードソース: ${result.metadata.keywordSource}`);
  console.log(`📊 処理時間: ${result.metadata.processingTime}ms`);
  console.log('');
  
  console.log('🔑 最終的な12個のキーワード:');
  result.keywords.forEach((keyword, index) => {
    console.log(`  ${index + 1}. "${keyword}"`);
  });
  
  console.log('');
  console.log('📊 カテゴリ別統計:');
  const stats = result.metadata.statistics.byCategory;
  console.log(`  - ドメイン名: ${stats.domainNames}個`);
  console.log(`  - 機能名: ${stats.functionNames}個`);
  console.log(`  - 操作名: ${stats.operationNames}個`);
  console.log(`  - システム項目: ${stats.systemFields}個`);
  console.log(`  - システム用語: ${stats.systemTerms}個`);
  console.log(`  - 関連キーワード: ${stats.relatedKeywords}個`);
  
  console.log('');
  console.log('⭐ 優先度別分類:');
  console.log(`  - Critical: ${result.criticalPriority.size}個`);
  console.log(`  - High: ${result.highPriority.size}個`);
  console.log(`  - Medium: ${result.mediumPriority.size}個`);
  console.log(`  - Low: ${result.lowPriority.size}個`);
}

// テスト実行
if (require.main === module) {
  showKeywordsOnly();
}

export { showKeywordsOnly };
