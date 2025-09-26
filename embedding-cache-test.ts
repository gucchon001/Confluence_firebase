import { performance } from 'perf_hooks';
import { getEmbeddings } from './src/lib/embeddings';
import { embeddingCache } from './src/lib/embedding-cache';

/**
 * 埋め込みベクトルキャッシュのテスト
 */

async function testEmbeddingCache() {
  console.log('🚀 埋め込みベクトルキャッシュテスト開始');
  console.log('='.repeat(60));

  try {
    const testQueries = [
      '教室管理の詳細は',
      '教室管理の詳細は', // 同じクエリ（キャッシュヒット期待）
      '教室一覧機能',
      '教室登録機能',
      '教室管理の詳細は', // 再度同じクエリ（キャッシュヒット期待）
      '教室編集機能',
      '教室削除機能'
    ];

    const results: Array<{
      query: string;
      time: number;
      cacheHit: boolean;
      embeddingLength: number;
    }> = [];

    console.log('📊 埋め込みベクトル生成テスト');
    console.log('='.repeat(40));

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n🔄 テスト${i + 1}: "${query}"`);
      
      const startTime = performance.now();
      
      try {
        const embedding = await getEmbeddings(query);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // キャッシュヒットかどうかを判定（ログから推定）
        const cacheHit = duration < 1000; // 1秒未満ならキャッシュヒットと推定
        
        results.push({
          query,
          time: duration,
          cacheHit,
          embeddingLength: embedding.length
        });
        
        console.log(`⏱️  実行時間: ${duration.toFixed(2)}ms`);
        console.log(`📊 埋め込み次元数: ${embedding.length}`);
        console.log(`🎯 キャッシュ: ${cacheHit ? 'HIT' : 'MISS'}`);
        
      } catch (error) {
        console.error(`❌ エラー: ${error}`);
      }
    }

    // パフォーマンス分析
    console.log('\n📈 パフォーマンス分析');
    console.log('='.repeat(40));
    
    const cacheHits = results.filter(r => r.cacheHit);
    const cacheMisses = results.filter(r => !r.cacheHit);
    
    const avgCacheHitTime = cacheHits.length > 0 
      ? cacheHits.reduce((sum, r) => sum + r.time, 0) / cacheHits.length 
      : 0;
    
    const avgCacheMissTime = cacheMisses.length > 0 
      ? cacheMisses.reduce((sum, r) => sum + r.time, 0) / cacheMisses.length 
      : 0;
    
    const totalTime = results.reduce((sum, r) => sum + r.time, 0);
    const avgTime = totalTime / results.length;
    
    console.log(`総実行時間: ${totalTime.toFixed(2)}ms`);
    console.log(`平均実行時間: ${avgTime.toFixed(2)}ms`);
    console.log(`\nキャッシュヒット: ${cacheHits.length}回`);
    console.log(`平均ヒット時間: ${avgCacheHitTime.toFixed(2)}ms`);
    console.log(`\nキャッシュミス: ${cacheMisses.length}回`);
    console.log(`平均ミス時間: ${avgCacheMissTime.toFixed(2)}ms`);
    
    // キャッシュ効果の計算
    if (avgCacheMissTime > 0 && avgCacheHitTime > 0) {
      const improvement = avgCacheMissTime - avgCacheHitTime;
      const improvementPercent = (improvement / avgCacheMissTime) * 100;
      
      console.log(`\n🎯 キャッシュ効果:`);
      console.log(`時間削減: ${improvement.toFixed(2)}ms`);
      console.log(`改善率: ${improvementPercent.toFixed(1)}%`);
    }

    // キャッシュ統計の取得
    console.log('\n📊 キャッシュ統計');
    console.log('='.repeat(40));
    
    const stats = embeddingCache.getStats();
    console.log(`キャッシュサイズ: ${stats.cacheSize}件`);
    console.log(`ヒット数: ${stats.hits}`);
    console.log(`ミス数: ${stats.misses}`);
    console.log(`総リクエスト数: ${stats.totalRequests}`);
    console.log(`ヒット率: ${stats.hitRate}%`);
    
    // 詳細結果
    console.log('\n📋 詳細結果');
    console.log('='.repeat(40));
    results.forEach((result, index) => {
      const icon = result.cacheHit ? '🚀' : '🔍';
      console.log(`${index + 1}. ${icon} "${result.query}" - ${result.time.toFixed(2)}ms`);
    });

    // 評価
    console.log('\n💡 評価');
    console.log('='.repeat(40));
    
    if (stats.hitRate >= 50) {
      console.log('✅ キャッシュが効果的に動作しています');
    } else if (stats.hitRate >= 30) {
      console.log('⚠️ キャッシュは動作していますが、改善の余地があります');
    } else {
      console.log('❌ キャッシュの効果が限定的です');
    }
    
    if (avgCacheHitTime < 100) {
      console.log('✅ キャッシュヒット時間は優秀です');
    } else {
      console.log('⚠️ キャッシュヒット時間に改善の余地があります');
    }
    
    console.log('\n🎯 埋め込みベクトルキャッシュテスト完了');
    console.log('='.repeat(60));
    
    return {
      success: true,
      stats,
      results,
      avgCacheHitTime,
      avgCacheMissTime,
      totalTime
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
  testEmbeddingCache()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 埋め込みベクトルキャッシュテスト成功');
        console.log(`ヒット率: ${result.stats.hitRate}%`);
        console.log(`総実行時間: ${result.totalTime.toFixed(2)}ms`);
        process.exit(0);
      } else {
        console.log('\n❌ 埋め込みベクトルキャッシュテスト失敗');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ テスト実行エラー:', error);
      process.exit(1);
    });
}

export { testEmbeddingCache };
