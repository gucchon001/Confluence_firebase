import { performance } from 'perf_hooks';

/**
 * 従来システム復元テスト
 * 並列検索エンジンを無効化し、従来の高速検索システムが正常に動作することを確認
 */

async function testTraditionalSearchRestoration() {
  console.log('🔄 従来システム復元テスト開始');
  console.log('='.repeat(60));

  try {
    // 1. 並列検索エンジンのテスト
    console.log('📊 1. 並列検索エンジンのテスト（無効化確認）');
    const { ParallelSearchEngine } = await import('./src/lib/parallel-search-engine');
    
    const parallelEngine = ParallelSearchEngine.getInstance();
    const testQuery = 'テスト検索';
    
    const parallelStartTime = performance.now();
    const parallelResult = await parallelEngine.search({
      query: testQuery,
      topK: 5,
      useLunrIndex: false,
      labelFilters: { includeMeetingNotes: false },
      excludeTitlePatterns: ['xxx_*']
    });
    const parallelTime = performance.now() - parallelStartTime;
    
    console.log(`⏱️  並列検索エンジン: ${parallelTime.toFixed(2)}ms`);
    console.log(`📋 結果数: ${parallelResult.results.length}`);
    console.log(`🎯 キャッシュ: ${parallelResult.cache.hit ? 'HIT' : 'MISS'}`);
    console.log(`🔧 検索タイプ: ${parallelResult.cache.key}`);
    
    // 2. 従来のLanceDB検索のテスト
    console.log('\n📊 2. 従来のLanceDB検索のテスト');
    const { searchLanceDB } = await import('./src/lib/lancedb-search-client');
    
    const traditionalStartTime = performance.now();
    const traditionalResult = await searchLanceDB({
      query: testQuery,
      topK: 5,
      useLunrIndex: false,
      labelFilters: { includeMeetingNotes: false },
      excludeTitlePatterns: ['xxx_*']
    });
    const traditionalTime = performance.now() - traditionalStartTime;
    
    console.log(`⏱️  従来検索: ${traditionalTime.toFixed(2)}ms`);
    console.log(`📋 結果数: ${traditionalResult.length}`);
    
    // 3. ハイブリッド検索のテスト
    console.log('\n📊 3. ハイブリッド検索のテスト');
    const { HybridSearchEngine } = await import('./src/lib/hybrid-search-engine');
    
    const hybridEngine = new HybridSearchEngine();
    const hybridStartTime = performance.now();
    const hybridResult = await hybridEngine.search(testQuery, {
      topK: 5,
      useLunrIndex: true,
      labelFilters: { includeMeetingNotes: false }
    });
    const hybridTime = performance.now() - hybridStartTime;
    
    console.log(`⏱️  ハイブリッド検索: ${hybridTime.toFixed(2)}ms`);
    console.log(`📋 結果数: ${hybridResult.length}`);
    
    // 4. パフォーマンス比較
    console.log('\n📈 パフォーマンス比較');
    console.log('='.repeat(40));
    console.log(`並列検索エンジン（無効化）: ${parallelTime.toFixed(2)}ms`);
    console.log(`従来LanceDB検索:         ${traditionalTime.toFixed(2)}ms`);
    console.log(`ハイブリッド検索:         ${hybridTime.toFixed(2)}ms`);
    
    // 5. 結果の整合性確認
    console.log('\n🔍 結果の整合性確認');
    const parallelIds = parallelResult.results.map(r => r.id).sort();
    const traditionalIds = traditionalResult.map(r => r.id).sort();
    
    const isConsistent = JSON.stringify(parallelIds) === JSON.stringify(traditionalIds);
    console.log(`結果の整合性: ${isConsistent ? '✅ 一致' : '❌ 不一致'}`);
    
    if (!isConsistent) {
      console.log('⚠️  並列検索と従来検索で結果が異なります');
      console.log(`並列検索結果数: ${parallelIds.length}`);
      console.log(`従来検索結果数: ${traditionalIds.length}`);
    }
    
    // 6. 推奨事項
    console.log('\n💡 推奨事項');
    console.log('='.repeat(40));
    
    if (parallelTime < traditionalTime * 1.5) {
      console.log('✅ 並列検索エンジンの無効化が正常に動作しています');
      console.log('✅ 従来システムへのリダイレクトが成功しています');
    } else {
      console.log('⚠️  並列検索エンジンの無効化に問題がある可能性があります');
    }
    
    if (traditionalTime < 1000) {
      console.log('✅ 従来検索のパフォーマンスは良好です');
    } else {
      console.log('⚠️  従来検索のパフォーマンスに改善の余地があります');
    }
    
    console.log('\n🎯 復元テスト完了');
    console.log('='.repeat(60));
    
    return {
      success: true,
      performance: {
        parallelTime,
        traditionalTime,
        hybridTime
      },
      consistency: isConsistent,
      recommendation: parallelTime < traditionalTime * 1.5 && traditionalTime < 1000
    };
    
  } catch (error) {
    console.error('❌ 復元テスト中にエラーが発生しました:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// テスト実行
if (require.main === module) {
  testTraditionalSearchRestoration()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 復元テスト成功');
        process.exit(0);
      } else {
        console.log('\n❌ 復元テスト失敗');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ テスト実行エラー:', error);
      process.exit(1);
    });
}

export { testTraditionalSearchRestoration };