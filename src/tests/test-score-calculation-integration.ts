/**
 * スコア計算統合テスト
 * 既存のlancedb-search-client.tsと統一サービスの比較
 */

import { searchLanceDB } from '../lib/lancedb-search-client';
import { unifiedSearchResultProcessor } from '../lib/unified-search-result-processor';

async function testScoreCalculationIntegration() {
  console.log('🔍 スコア計算統合テスト');
  console.log('=' .repeat(60));

  const testQuery = '教室管理の詳細は';
  
  try {
    console.log(`\n📊 テストクエリ: "${testQuery}"`);
    
    // 既存の検索実行
    console.log('\n1️⃣ 既存の検索実行');
    const startTime1 = Date.now();
    const existingResults = await searchLanceDB({
      query: testQuery,
      topK: 3,
      tableName: 'confluence'
    });
    const existingTime = Date.now() - startTime1;
    
    console.log(`⏱️  既存処理時間: ${existingTime}ms`);
    console.log(`📊 既存結果数: ${existingResults.length}件`);
    
    // 既存結果のスコア分析
    if (existingResults.length > 0) {
      console.log('\n📋 既存結果のスコア:');
      existingResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title}`);
        console.log(`     スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
        console.log(`     ソース: ${result.source}`);
        console.log(`     距離: ${result.distance}`);
      });
    }

    // 統一サービスのテスト（モックデータ）
    console.log('\n2️⃣ 統一サービスのテスト');
    const mockRawResults = existingResults.map(result => ({
      id: result.id,
      pageId: result.pageId,
      title: result.title,
      content: result.content,
      _distance: result.distance,
      _bm25Score: result.scoreRaw || 0,
      _keywordScore: result.scoreRaw || 0,
      _labelScore: 0,
      _sourceType: result.source || 'vector',
      space_key: result.space_key,
      labels: result.labels,
      url: result.url,
      lastUpdated: result.lastUpdated
    }));

    const startTime2 = Date.now();
    const unifiedResults = unifiedSearchResultProcessor.processSearchResults(mockRawResults, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: true
    });
    const unifiedTime = Date.now() - startTime2;
    
    console.log(`⏱️  統一処理時間: ${unifiedTime}ms`);
    console.log(`📊 統一結果数: ${unifiedResults.length}件`);
    
    // 統一結果のスコア分析
    if (unifiedResults.length > 0) {
      console.log('\n📋 統一結果のスコア:');
      unifiedResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title}`);
        console.log(`     スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
        console.log(`     ソース: ${result.source}`);
        console.log(`     距離: ${result.distance}`);
        console.log(`     RRFスコア: ${result.rrfScore?.toFixed(4)}`);
      });
    }

    // 比較分析
    console.log('\n📊 比較分析:');
    console.log(`   既存処理時間: ${existingTime}ms`);
    console.log(`   統一処理時間: ${unifiedTime}ms`);
    console.log(`   時間差: ${Math.abs(existingTime - unifiedTime)}ms`);
    
    if (unifiedTime < existingTime) {
      console.log('✅ 統一サービスが高速');
    } else if (unifiedTime < existingTime * 1.1) {
      console.log('⚠️  同等の性能');
    } else {
      console.log('❌ 統一サービスが低速');
    }

    // スコアの一貫性チェック
    if (existingResults.length > 0 && unifiedResults.length > 0) {
      const existingScores = existingResults.map(r => r.score);
      const unifiedScores = unifiedResults.map(r => r.score);
      
      const existingAvg = existingScores.reduce((a, b) => a + b, 0) / existingScores.length;
      const unifiedAvg = unifiedScores.reduce((a, b) => a + b, 0) / unifiedScores.length;
      
      console.log(`\n📈 スコア比較:`);
      console.log(`   既存平均スコア: ${existingAvg.toFixed(2)}`);
      console.log(`   統一平均スコア: ${unifiedAvg.toFixed(2)}`);
      console.log(`   スコア差: ${Math.abs(existingAvg - unifiedAvg).toFixed(2)}`);
      
      if (Math.abs(existingAvg - unifiedAvg) < 5) {
        console.log('✅ スコアの一貫性良好');
      } else {
        console.log('⚠️  スコアに差異あり');
      }
    }

    console.log('\n✅ スコア計算統合テスト完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    throw error;
  }
}

// テスト実行
testScoreCalculationIntegration().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
