/**
 * 既存サービスと統一サービスの比較テスト
 * デグレードの原因を特定
 */

import { DynamicKeywordExtractor } from '../lib/dynamic-keyword-extractor';
import { unifiedKeywordExtractionService } from '../lib/unified-keyword-extraction-service';

async function testComparison() {
  console.log('🔍 既存サービス vs 統一サービス 比較テスト');
  console.log('=' .repeat(80));

  const testQuery = '教室管理の詳細は';
  console.log(`🔍 テストクエリ: "${testQuery}"`);

  try {
    // 既存サービスでのテスト
    console.log('\n📊 既存サービス（DynamicKeywordExtractor）:');
    const existingExtractor = new DynamicKeywordExtractor();
    const existingResult = await existingExtractor.extractDynamicKeywords(testQuery);
    
    console.log(`- 総キーワード数: ${existingResult.keywords.length}`);
    console.log(`- 処理時間: ${existingResult.processingTime}ms`);
    console.log(`- ドメイン: ${existingResult.metadata.domain}`);
    console.log(`- ドメインキーワード: ${existingResult.statistics.domainKeywords}個`);
    console.log(`- パターンキーワード: ${existingResult.statistics.patternKeywords}個`);
    console.log(`- フィルタ後キーワード: ${existingResult.statistics.filteredKeywords}個`);

    console.log('\n🔑 既存サービスで抽出されたキーワード:');
    existingResult.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });

    // 統一サービスでのテスト
    console.log('\n📊 統一サービス（UnifiedKeywordExtractionService）:');
    const unifiedResult = await unifiedKeywordExtractionService.extractDynamicKeywords(testQuery);
    
    console.log(`- 総キーワード数: ${unifiedResult.keywords.length}`);
    console.log(`- 処理時間: ${unifiedResult.processingTime}ms`);
    console.log(`- ドメイン: ${unifiedResult.metadata.domain}`);
    console.log(`- ドメインキーワード: ${unifiedResult.statistics.domainKeywords}個`);
    console.log(`- パターンキーワード: ${unifiedResult.statistics.patternKeywords}個`);
    console.log(`- フィルタ後キーワード: ${unifiedResult.statistics.filteredKeywords}個`);

    console.log('\n🔑 統一サービスで抽出されたキーワード:');
    unifiedResult.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });

    // 比較結果
    console.log('\n📈 比較結果:');
    console.log(`- キーワード数: 既存 ${existingResult.keywords.length}個 vs 統一 ${unifiedResult.keywords.length}個`);
    console.log(`- 処理時間: 既存 ${existingResult.processingTime}ms vs 統一 ${unifiedResult.processingTime}ms`);
    console.log(`- ドメイン検出: 既存 "${existingResult.metadata.domain}" vs 統一 "${unifiedResult.metadata.domain}"`);
    
    if (existingResult.keywords.length > 0 && unifiedResult.keywords.length === 0) {
      console.log('❌ デグレード検出: 統一サービスでキーワードが抽出されていません');
    } else if (existingResult.keywords.length === unifiedResult.keywords.length) {
      console.log('✅ キーワード数は一致しています');
    } else {
      console.log('⚠️ キーワード数に差異があります');
    }

    console.log('\n✅ 比較テスト完了');

  } catch (error) {
    console.error('❌ テストエラー:', error);
    process.exit(1);
  }
}

// テスト実行
testComparison();
