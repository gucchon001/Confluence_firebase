/**
 * 最適化されたキーワード抽出のテスト
 * キーワード数を制限してパフォーマンスを向上
 */

import { unifiedKeywordExtractionService } from '../lib/unified-keyword-extraction-service';

async function testOptimizedKeywords() {
  console.log('🔧 最適化されたキーワード抽出テスト');
  console.log('=' .repeat(60));

  const testQueries = [
    '教室管理の詳細は',
    'ログイン機能について',
    'オファー管理の機能'
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n[${i + 1}/${testQueries.length}] テストクエリ: "${query}"`);

    try {
      const startTime = Date.now();
      const result = await unifiedKeywordExtractionService.extractDynamicKeywords(query);
      const processingTime = Date.now() - startTime;

      console.log(`⏱️  処理時間: ${processingTime}ms`);
      console.log(`🔑 抽出キーワード数: ${result.keywords.length}/8`);
      console.log(`📊 ドメインキーワード: ${result.statistics.domainKeywords}個`);
      console.log(`📊 パターンキーワード: ${result.statistics.patternKeywords}個`);
      console.log(`📊 フィルタ後キーワード: ${result.statistics.filteredKeywords}個`);

      console.log('🔑 抽出されたキーワード:');
      result.keywords.forEach((keyword, index) => {
        console.log(`  ${index + 1}. "${keyword}"`);
      });

      // パフォーマンス評価
      if (processingTime < 50) {
        console.log('✅ 高速処理');
      } else if (processingTime < 100) {
        console.log('⚠️  中速処理');
      } else {
        console.log('❌ 低速処理');
      }

      if (result.keywords.length <= 8) {
        console.log('✅ キーワード数適正');
      } else {
        console.log('❌ キーワード数過多');
      }

    } catch (error) {
      console.error(`❌ エラー: ${error}`);
    }
  }

  console.log('\n✅ 最適化テスト完了');
}

// テスト実行
testOptimizedKeywords().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
