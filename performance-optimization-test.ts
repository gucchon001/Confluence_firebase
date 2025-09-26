/**
 * パフォーマンス最適化テスト
 * 新しい最適化システムの効果を測定
 */

import { parallelSearchEngine } from './src/lib/parallel-search-engine';
import { performanceOptimizedInitializer } from './src/lib/performance-optimized-initializer';
import { advancedSearchCache } from './src/lib/advanced-search-cache';
import { performanceMonitor } from './src/lib/performance-monitor';
import { searchLanceDB } from './src/lib/lancedb-search-client';

async function performanceOptimizationTest() {
  console.log('🚀 パフォーマンス最適化テスト開始');
  console.log('==================================================');

  // パフォーマンス監視を開始
  performanceMonitor.startMonitoring();

  const testQueries = [
    '教室管理の詳細は',
    '求人情報の登録方法',
    'ユーザー管理機能',
    'メール送信機能',
    'レポート生成機能'
  ];

  console.log('\n📊 テスト1: 最適化された並列検索エンジン');
  const parallelResults = [];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n🔍 並列検索 ${i + 1}/5: "${query}"`);
    
    const startTime = performance.now();
    
    try {
      const result = await parallelSearchEngine.search({
        query: query,
        topK: 10,
        enableParallelProcessing: true
      });
      
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`✅ 並列検索完了: ${duration.toFixed(2)}ms, 結果: ${result.results.length}件`);
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
      
      console.log(`❌ 並列検索エラー: ${duration.toFixed(2)}ms`);
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

  console.log('\n📊 テスト2: 従来の検索エンジン（比較用）');
  const traditionalResults = [];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n🔍 従来検索 ${i + 1}/5: "${query}"`);
    
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
  console.log('\n📈 パフォーマンス比較分析');
  console.log('==================================================');

  const parallelSuccessful = parallelResults.filter(r => r.success);
  const traditionalSuccessful = traditionalResults.filter(r => r.success);

  const parallelAvgTime = parallelSuccessful.reduce((sum, r) => sum + r.duration, 0) / parallelSuccessful.length;
  const traditionalAvgTime = traditionalSuccessful.reduce((sum, r) => sum + r.duration, 0) / traditionalSuccessful.length;

  const improvement = ((traditionalAvgTime - parallelAvgTime) / traditionalAvgTime) * 100;

  console.log(`📊 並列検索エンジン:`);
  console.log(`   平均応答時間: ${parallelAvgTime.toFixed(2)}ms`);
  console.log(`   成功率: ${(parallelSuccessful.length / parallelResults.length) * 100}%`);
  console.log(`   キャッシュヒット率: ${(parallelResults.filter(r => r.cacheHit).length / parallelResults.length) * 100}%`);

  console.log(`\n📊 従来検索エンジン:`);
  console.log(`   平均応答時間: ${traditionalAvgTime.toFixed(2)}ms`);
  console.log(`   成功率: ${(traditionalSuccessful.length / traditionalResults.length) * 100}%`);

  console.log(`\n🎯 改善効果:`);
  console.log(`   応答時間改善: ${improvement.toFixed(2)}%`);
  console.log(`   絶対改善: ${(traditionalAvgTime - parallelAvgTime).toFixed(2)}ms`);

  // システム統計
  console.log('\n📊 システム統計');
  console.log('==================================================');

  const initStats = performanceOptimizedInitializer.getPerformanceStats();
  const cacheStats = advancedSearchCache.getStats();
  const performanceReport = performanceMonitor.generateReport();

  console.log('🔧 初期化統計:');
  console.log(`   初期化時間: ${initStats.initializationTime.toFixed(2)}ms`);
  console.log(`   サービス準備状況:`, initStats.servicesReady);

  console.log('\n💾 キャッシュ統計:');
  console.log(`   ヒット率: ${cacheStats.hitRate}%`);
  console.log(`   メモリ使用量: ${cacheStats.memoryUsageMB}MB`);
  console.log(`   キャッシュサイズ: ${cacheStats.size}エントリ`);

  console.log('\n📈 パフォーマンスレポート:');
  console.log(`   ヘルススコア: ${performanceReport.healthScore}/100`);
  console.log(`   総リクエスト数: ${performanceReport.totalRequests}`);
  console.log(`   推奨事項:`);
  performanceReport.recommendations.forEach(rec => console.log(`     - ${rec}`));

  // 結果判定
  console.log('\n✅ テスト結果判定');
  console.log('==================================================');

  const targetImprovement = 50; // 50%改善を目標
  const isSignificantImprovement = improvement >= targetImprovement;
  const isWithinTarget = parallelAvgTime <= 5000; // 5秒以下を目標

  console.log(`🎯 目標達成状況:`);
  console.log(`   改善率目標 (${targetImprovement}%): ${isSignificantImprovement ? '✅ 達成' : '❌ 未達成'}`);
  console.log(`   応答時間目標 (5000ms以下): ${isWithinTarget ? '✅ 達成' : '❌ 未達成'}`);

  if (isSignificantImprovement && isWithinTarget) {
    console.log('\n🎉 パフォーマンス最適化成功！');
    console.log('   全ての目標を達成しました。');
  } else if (isSignificantImprovement) {
    console.log('\n⚠️ 部分的成功');
    console.log('   改善率は達成しましたが、応答時間目標に達していません。');
  } else {
    console.log('\n❌ 最適化が必要');
    console.log('   さらなる最適化が必要です。');
  }

  console.log('\n==================================================');
  console.log('✅ パフォーマンス最適化テスト完了');
}

performanceOptimizationTest().catch(console.error);

