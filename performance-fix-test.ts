/**
 * パフォーマンス修正後のテスト
 * 並列処理無効化とシンプル化の効果を測定
 */

import { searchLanceDB } from './src/lib/lancedb-search-client';
import { parallelSearchEngine } from './src/lib/parallel-search-engine';

async function testPerformanceFix() {
  console.log('🔧 パフォーマンス修正テスト開始');
  console.log('==================================================');

  const testQueries = [
    '教室管理の詳細は',
    '求人情報の登録方法',
    'ユーザー管理機能'
  ];

  console.log('\n📊 修正後の並列検索エンジンテスト');
  const parallelResults = [];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n🔍 修正後並列検索 ${i + 1}/3: "${query}"`);
    
    const startTime = performance.now();
    
    try {
      const result = await parallelSearchEngine.search({
        query: query,
        topK: 10,
        enableParallelProcessing: true // 実際にはシーケンシャル処理
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`✅ 修正後並列検索完了: ${duration.toFixed(2)}ms, 結果: ${result.results.length}件`);
      console.log(`📈 パフォーマンス詳細:`, result.performance);
      
      parallelResults.push({
        query,
        duration,
        resultCount: result.results.length,
        cacheHit: result.cache.hit,
        success: true
      });
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`❌ 修正後並列検索エラー: ${duration.toFixed(2)}ms`);
      console.error('エラー詳細:', error);
      
      parallelResults.push({
        query,
        duration,
        resultCount: 0,
        cacheHit: false,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  console.log('\n📊 従来検索エンジン（比較用）');
  const traditionalResults = [];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n🔍 従来検索 ${i + 1}/3: "${query}"`);
    
    const startTime = performance.now();
    
    try {
      const result = await searchLanceDB({
        query: query,
        topK: 10,
        useLunrIndex: false,
        labelFilters: { includeMeetingNotes: false },
        excludeTitlePatterns: ['xxx_*']
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`✅ 従来検索完了: ${duration.toFixed(2)}ms, 結果: ${result.length}件`);
      
      traditionalResults.push({
        query,
        duration,
        resultCount: result.length,
        success: true
      });
      
    } catch (error) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`❌ 従来検索エラー: ${duration.toFixed(2)}ms`);
      console.error('エラー詳細:', error);
      
      traditionalResults.push({
        query,
        duration,
        resultCount: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // 結果の比較分析
  console.log('\n📈 修正効果の比較分析');
  console.log('==================================================');

  const parallelSuccessful = parallelResults.filter(r => r.success);
  const traditionalSuccessful = traditionalResults.filter(r => r.success);

  const parallelAvgTime = parallelSuccessful.reduce((sum, r) => sum + r.duration, 0) / parallelSuccessful.length;
  const traditionalAvgTime = traditionalSuccessful.reduce((sum, r) => sum + r.duration, 0) / traditionalSuccessful.length;

  const improvement = ((traditionalAvgTime - parallelAvgTime) / traditionalAvgTime) * 100;

  console.log(`📊 修正後並列検索エンジン:`);
  console.log(`   平均応答時間: ${parallelAvgTime.toFixed(2)}ms`);
  console.log(`   成功率: ${(parallelSuccessful.length / parallelResults.length) * 100}%`);
  console.log(`   キャッシュヒット率: ${(parallelResults.filter(r => r.cacheHit).length / parallelResults.length) * 100}%`);

  console.log(`\n📊 従来検索エンジン:`);
  console.log(`   平均応答時間: ${traditionalAvgTime.toFixed(2)}ms`);
  console.log(`   成功率: ${(traditionalSuccessful.length / traditionalResults.length) * 100}%`);

  console.log(`\n🎯 修正効果:`);
  console.log(`   応答時間改善: ${improvement.toFixed(2)}%`);
  console.log(`   絶対改善: ${(traditionalAvgTime - parallelAvgTime).toFixed(2)}ms`);

  // 結果判定
  console.log('\n✅ 修正結果判定');
  console.log('==================================================');

  const targetImprovement = -50; // 50%以内の劣化を許容
  const isAcceptableDegradation = improvement >= targetImprovement;
  const isWithinTarget = parallelAvgTime <= 5000; // 5秒以下を目標

  console.log(`🎯 目標達成状況:`);
  console.log(`   許容劣化範囲 (${targetImprovement}%以上): ${isAcceptableDegradation ? '✅ 達成' : '❌ 未達成'}`);
  console.log(`   応答時間目標 (5000ms以下): ${isWithinTarget ? '✅ 達成' : '❌ 未達成'}`);

  if (isAcceptableDegradation && isWithinTarget) {
    console.log('\n🎉 パフォーマンス修正成功！');
    console.log('   許容範囲内で性能が改善されました。');
  } else if (isAcceptableDegradation) {
    console.log('\n⚠️ 部分的成功');
    console.log('   劣化は許容範囲内ですが、応答時間目標に達していません。');
  } else {
    console.log('\n❌ さらなる修正が必要');
    console.log('   まだ劣化が大きすぎます。');
  }

  console.log('\n==================================================');
  console.log('✅ パフォーマンス修正テスト完了');
}

testPerformanceFix().catch(console.error);
