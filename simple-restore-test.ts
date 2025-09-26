import { performance } from 'perf_hooks';

/**
 * 軽量な従来システム復元テスト
 * メモリ使用量を最小限に抑えたテスト
 */

async function simpleRestoreTest() {
  console.log('🔄 軽量復元テスト開始');
  console.log('='.repeat(50));

  try {
    // 1. 並列検索エンジンの無効化確認
    console.log('📊 並列検索エンジンの無効化確認');
    
    const { ParallelSearchEngine } = await import('./src/lib/parallel-search-engine');
    const parallelEngine = ParallelSearchEngine.getInstance();
    
    const startTime = performance.now();
    const result = await parallelEngine.search({
      query: 'test',
      topK: 3,
      useLunrIndex: false,
      labelFilters: { includeMeetingNotes: false },
      excludeTitlePatterns: ['xxx_*']
    });
    const endTime = performance.now();
    
    console.log(`⏱️  実行時間: ${(endTime - startTime).toFixed(2)}ms`);
    console.log(`📋 結果数: ${result.results.length}`);
    console.log(`🔧 検索タイプ: ${result.cache.key}`);
    
    // 2. 結果の確認
    if (result.cache.key === 'traditional') {
      console.log('✅ 従来システムへのリダイレクトが正常に動作しています');
    } else {
      console.log('❌ 従来システムへのリダイレクトが失敗しています');
    }
    
    // 3. パフォーマンス確認
    if (endTime - startTime < 5000) {
      console.log('✅ パフォーマンスは良好です');
    } else {
      console.log('⚠️  パフォーマンスに改善の余地があります');
    }
    
    console.log('\n🎯 軽量復元テスト完了');
    console.log('='.repeat(50));
    
    return {
      success: true,
      redirectWorking: result.cache.key === 'traditional',
      performance: endTime - startTime,
      resultsCount: result.results.length
    };
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生しました:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// テスト実行
if (require.main === module) {
  simpleRestoreTest()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 軽量復元テスト成功');
        console.log(`リダイレクト動作: ${result.redirectWorking ? '正常' : '異常'}`);
        console.log(`パフォーマンス: ${result.performance.toFixed(2)}ms`);
        console.log(`結果数: ${result.resultsCount}`);
        process.exit(0);
      } else {
        console.log('\n❌ 軽量復元テスト失敗');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ テスト実行エラー:', error);
      process.exit(1);
    });
}

export { simpleRestoreTest };
