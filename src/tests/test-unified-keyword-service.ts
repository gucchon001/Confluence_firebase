/**
 * 統一キーワード抽出サービスのテスト
 * デグレードを防ぐため、既存の動作と比較
 */

import { unifiedKeywordExtractionService } from '../lib/unified-keyword-extraction-service';

async function testUnifiedKeywordService() {
  console.log('🧪 統一キーワード抽出サービス テスト開始');
  console.log('=' .repeat(60));

  const testQuery = '教室管理の詳細は';
  console.log(`🔍 テストクエリ: "${testQuery}"`);

  try {
    // 統一サービスでのキーワード抽出
    console.log('\n📊 統一サービスでの抽出結果:');
    const result = await unifiedKeywordExtractionService.extractDynamicKeywords(testQuery);
    
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- キーワードソース: ${result.source}`);
    console.log(`- 処理時間: ${result.processingTime}ms`);
    console.log(`- ドメイン: ${result.metadata.domain}`);
    console.log(`- パターン数: ${result.metadata.patterns.length}`);
    console.log(`- フィルタ数: ${result.metadata.filters.length}`);

    console.log('\n🔑 抽出されたキーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });

    console.log('\n📈 統計情報:');
    console.log(`- ドメインキーワード: ${result.statistics.domainKeywords}個`);
    console.log(`- パターンキーワード: ${result.statistics.patternKeywords}個`);
    console.log(`- フィルタ後キーワード: ${result.statistics.filteredKeywords}個`);

    // 互換性テスト
    console.log('\n🔄 互換性テスト:');
    const configuredResult = await unifiedKeywordExtractionService.extractKeywordsConfigured(testQuery);
    console.log(`- extractKeywordsConfigured結果: ${configuredResult.length}個`);
    console.log(`- 結果の一致: ${JSON.stringify(result.keywords) === JSON.stringify(configuredResult) ? '✅' : '❌'}`);

    console.log('\n✅ 統一キーワード抽出サービス テスト完了');

  } catch (error) {
    console.error('❌ テストエラー:', error);
    process.exit(1);
  }
}

// テスト実行
testUnifiedKeywordService();
