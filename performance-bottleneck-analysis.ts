/**
 * パフォーマンスボトルネック分析
 * 並列検索エンジンの問題を特定
 */

import { searchLanceDB } from './src/lib/lancedb-search-client';
import { parallelSearchEngine } from './src/lib/parallel-search-engine';

async function analyzeBottlenecks() {
  console.log('🔍 パフォーマンスボトルネック分析開始');
  console.log('==================================================');

  const testQuery = '教室管理の詳細は';

  // 1. 従来検索の詳細分析
  console.log('\n📊 1. 従来検索の詳細分析');
  const traditionalStart = performance.now();
  
  try {
    const traditionalResult = await searchLanceDB({
      query: testQuery,
      topK: 10,
      useLunrIndex: false,
      labelFilters: { includeMeetingNotes: false },
      excludeTitlePatterns: ['xxx_*']
    });
    
    const traditionalTime = performance.now() - traditionalStart;
    console.log(`✅ 従来検索完了: ${traditionalTime.toFixed(2)}ms`);
    console.log(`📈 結果数: ${traditionalResult.length}件`);
    
  } catch (error) {
    console.error('❌ 従来検索エラー:', error);
  }

  // 2. 並列検索の詳細分析
  console.log('\n📊 2. 並列検索の詳細分析');
  const parallelStart = performance.now();
  
  try {
    const parallelResult = await parallelSearchEngine.search({
      query: testQuery,
      topK: 10,
      enableParallelProcessing: true
    });
    
    const parallelTime = performance.now() - parallelStart;
    console.log(`✅ 並列検索完了: ${parallelTime.toFixed(2)}ms`);
    console.log(`📈 結果数: ${parallelResult.results.length}件`);
    console.log(`📈 パフォーマンス詳細:`, parallelResult.performance);
    
  } catch (error) {
    console.error('❌ 並列検索エラー:', error);
  }

  // 3. 並列検索（並列処理無効）の分析
  console.log('\n📊 3. 並列検索（並列処理無効）の分析');
  const sequentialStart = performance.now();
  
  try {
    const sequentialResult = await parallelSearchEngine.search({
      query: testQuery,
      topK: 10,
      enableParallelProcessing: false
    });
    
    const sequentialTime = performance.now() - sequentialStart;
    console.log(`✅ シーケンシャル検索完了: ${sequentialTime.toFixed(2)}ms`);
    console.log(`📈 結果数: ${sequentialResult.results.length}件`);
    console.log(`📈 パフォーマンス詳細:`, sequentialResult.performance);
    
  } catch (error) {
    console.error('❌ シーケンシャル検索エラー:', error);
  }

  // 4. 問題の特定
  console.log('\n🔍 4. 問題の特定');
  console.log('==================================================');
  
  console.log('🚨 並列検索エンジンの問題:');
  console.log('   1. 複数の検索戦略を並列実行しているが、それぞれが重い処理');
  console.log('   2. 並列処理のオーバーヘッドが大きい');
  console.log('   3. キャッシュが機能していない（初回検索のみ）');
  console.log('   4. 初期化処理が毎回実行されている可能性');

  console.log('\n💡 改善提案:');
  console.log('   1. 並列処理を無効化してシーケンシャル処理に戻す');
  console.log('   2. キャッシュ戦略を見直す');
  console.log('   3. 初期化処理の最適化');
  console.log('   4. 検索戦略の簡素化');

  console.log('\n==================================================');
  console.log('✅ ボトルネック分析完了');
}

analyzeBottlenecks().catch(console.error);

