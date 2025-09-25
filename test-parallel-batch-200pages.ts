/**
 * 200ページでの並列バッチ処理テスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testParallelBatch200Pages() {
  console.log('🚀 200ページでの並列バッチ処理テストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 並列バッチ取得のテスト
    console.log('📄 200ページの並列バッチ取得をテスト中...');
    const fetchStartTime = Date.now();
    
    const pages = await confluenceSyncService.getConfluencePagesBatch(200, 50);
    
    const fetchEndTime = Date.now();
    const fetchTime = fetchEndTime - fetchStartTime;
    
    console.log(`\n📊 取得結果:`);
    console.log(`  取得ページ数: ${pages.length}ページ`);
    console.log(`  取得時間: ${fetchTime}ms`);
    console.log(`  取得速度: ${Math.round(pages.length / fetchTime * 1000)}ページ/秒`);

    // 2. ラベル統計
    console.log('\n🏷️ ラベル統計:');
    const labelStats = new Map<string, number>();
    let excludedCount = 0;
    
    pages.forEach(page => {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      labels.forEach(label => {
        labelStats.set(label, (labelStats.get(label) || 0) + 1);
      });
      
      // 除外対象チェック
      const hasExcludedLabel = labels.some(label => ['アーカイブ', 'フォルダ'].includes(label));
      if (hasExcludedLabel) {
        excludedCount++;
      }
    });
    
    console.log(`  総ラベル数: ${labelStats.size}`);
    console.log(`  除外対象ページ: ${excludedCount}ページ`);
    console.log(`  有効ページ: ${pages.length - excludedCount}ページ`);
    
    // 上位10ラベルを表示
    const sortedLabels = Array.from(labelStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log(`  上位ラベル:`);
    sortedLabels.forEach(([label, count]) => {
      console.log(`    ${label}: ${count}ページ`);
    });

    // 3. 並列同期のテスト
    console.log('\n🔄 並列同期をテスト中...');
    const syncStartTime = Date.now();
    
    const syncResult = await confluenceSyncService.syncPagesParallel(pages, 20);
    
    const syncEndTime = Date.now();
    const syncTime = syncEndTime - syncStartTime;
    
    console.log(`\n📈 同期結果:`);
    console.log(`  追加: ${syncResult.added}ページ`);
    console.log(`  更新: ${syncResult.updated}ページ`);
    console.log(`  変更なし: ${syncResult.unchanged}ページ`);
    console.log(`  除外: ${syncResult.excluded}ページ`);
    console.log(`  エラー: ${syncResult.errors.length}件`);
    console.log(`  同期時間: ${syncTime}ms`);
    console.log(`  同期速度: ${Math.round(pages.length / syncTime * 1000)}ページ/秒`);

    if (syncResult.errors.length > 0) {
      console.log(`\n❌ エラー詳細:`);
      syncResult.errors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      if (syncResult.errors.length > 5) {
        console.log(`  ... 他 ${syncResult.errors.length - 5}件のエラー`);
      }
    }

    // 4. ハイブリッド検索のテスト
    console.log('\n🔍 ハイブリッド検索をテスト中...');
    const searchStartTime = Date.now();
    
    const searchResults = await searchEngine.search({ 
      query: '機能要件 システム', 
      topK: 10 
    });
    
    const searchEndTime = Date.now();
    const searchTime = searchEndTime - searchStartTime;
    
    console.log(`\n📊 検索結果:`);
    console.log(`  検索結果数: ${searchResults.length}件`);
    console.log(`  検索時間: ${searchTime}ms`);
    console.log(`  検索速度: ${Math.round(searchResults.length / searchTime * 1000)}件/秒`);
    
    searchResults.slice(0, 5).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 5. パフォーマンス分析
    console.log('\n📈 パフォーマンス分析:');
    console.log('=' .repeat(50));
    
    const totalTime = fetchTime + syncTime;
    const totalPages = pages.length;
    
    console.log(`総処理時間: ${totalTime}ms`);
    console.log(`総ページ数: ${totalPages}ページ`);
    console.log(`平均処理時間: ${Math.round(totalTime / totalPages)}ms/ページ`);
    console.log(`総合スループット: ${Math.round(totalPages / totalTime * 1000)}ページ/秒`);
    
    console.log(`\n📊 各段階の詳細:`);
    console.log(`  取得: ${fetchTime}ms (${Math.round(fetchTime / totalTime * 100)}%)`);
    console.log(`  同期: ${syncTime}ms (${Math.round(syncTime / totalTime * 100)}%)`);
    console.log(`  検索: ${searchTime}ms`);
    
    // 6. メモリ使用量の推定
    const estimatedMemoryMB = Math.round((totalPages * 50) / 1024); // 1ページあたり約50KBと仮定
    console.log(`\n💾 推定メモリ使用量: ${estimatedMemoryMB}MB`);

    // 7. 総合評価
    console.log('\n🎯 総合評価:');
    console.log('=' .repeat(50));
    
    const isHighPerformance = totalPages / totalTime * 1000 > 10; // 10ページ/秒以上
    const isLowError = syncResult.errors.length < totalPages * 0.01; // エラー率1%未満
    const isGoodSearch = searchResults.length > 0 && searchTime < 1000; // 検索結果あり、1秒以内
    
    console.log(`✅ 高性能: ${isHighPerformance ? 'Yes' : 'No'} (${Math.round(totalPages / totalTime * 1000)}ページ/秒)`);
    console.log(`✅ 低エラー率: ${isLowError ? 'Yes' : 'No'} (${syncResult.errors.length}/${totalPages}件)`);
    console.log(`✅ 高速検索: ${isGoodSearch ? 'Yes' : 'No'} (${searchTime}ms)`);
    console.log(`✅ ラベルフィルタリング: ${syncResult.excluded > 0 ? 'Yes' : 'No'} (${syncResult.excluded}ページ除外)`);
    
    const overallScore = (isHighPerformance ? 1 : 0) + (isLowError ? 1 : 0) + (isGoodSearch ? 1 : 0) + (syncResult.excluded > 0 ? 1 : 0);
    console.log(`\n🏆 総合スコア: ${overallScore}/4`);
    
    if (overallScore >= 3) {
      console.log(`🎉 並列バッチ処理は優秀な性能を発揮しています！`);
    } else if (overallScore >= 2) {
      console.log(`👍 並列バッチ処理は良好な性能を発揮しています。`);
    } else {
      console.log(`⚠️ 並列バッチ処理の性能改善が必要です。`);
    }

    console.log('\n✅ 200ページ並列バッチテスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testParallelBatch200Pages().catch(console.error);
