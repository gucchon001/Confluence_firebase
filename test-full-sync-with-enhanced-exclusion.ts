/**
 * 拡張除外ルールでの全件処理テスト
 * ラベル「スコープ外」とタイトルパターン「■要件定義」「xxx_」の除外を含む
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testFullSyncWithEnhancedExclusion() {
  console.log('🚀 拡張除外ルールでの全件処理テストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 200ページの並列バッチ取得
    console.log('📄 200ページの並列バッチ取得を開始...');
    const fetchStartTime = Date.now();
    
    const pages = await confluenceSyncService.getConfluencePagesBatch(200, 50);
    
    const fetchEndTime = Date.now();
    const fetchTime = fetchEndTime - fetchStartTime;
    
    console.log(`\n📊 取得結果:`);
    console.log(`  取得ページ数: ${pages.length}ページ`);
    console.log(`  取得時間: ${fetchTime}ms`);
    console.log(`  取得速度: ${Math.round(pages.length / fetchTime * 1000)}ページ/秒`);

    // 2. 除外対象の詳細分析
    console.log('\n🔍 除外対象の詳細分析:');
    console.log('=' .repeat(60));
    
    let excludedByLabel = 0;
    let excludedByTitle = 0;
    let excludedByBoth = 0;
    let totalExcluded = 0;
    
    const labelStats = new Map<string, number>();
    const titlePatternStats = new Map<string, number>();
    
    const excludedPages = [];
    const includedPages = [];
    
    pages.forEach(page => {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      
      // ラベル統計
      labels.forEach(label => {
        labelStats.set(label, (labelStats.get(label) || 0) + 1);
      });
      
      // 除外チェック
      const hasExcludedLabel = labels.some(label => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label));
      const hasExcludedTitle = page.title.includes('■要件定義') || page.title.includes('xxx_');
      
      if (hasExcludedLabel || hasExcludedTitle) {
        excludedPages.push({
          title: page.title,
          id: page.id,
          labels: labels,
          excludedByLabel: hasExcludedLabel,
          excludedByTitle: hasExcludedTitle
        });
        
        if (hasExcludedLabel) excludedByLabel++;
        if (hasExcludedTitle) excludedByTitle++;
        if (hasExcludedLabel && hasExcludedTitle) excludedByBoth++;
        totalExcluded++;
        
        // タイトルパターン統計
        if (page.title.includes('■要件定義')) {
          titlePatternStats.set('■要件定義', (titlePatternStats.get('■要件定義') || 0) + 1);
        }
        if (page.title.includes('xxx_')) {
          titlePatternStats.set('xxx_', (titlePatternStats.get('xxx_') || 0) + 1);
        }
      } else {
        includedPages.push({
          title: page.title,
          id: page.id,
          labels: labels
        });
      }
    });
    
    console.log(`除外対象ページ: ${totalExcluded}ページ (${Math.round(totalExcluded / pages.length * 100)}%)`);
    console.log(`  - ラベルで除外: ${excludedByLabel}ページ`);
    console.log(`  - タイトルで除外: ${excludedByTitle}ページ`);
    console.log(`  - 両方で除外: ${excludedByBoth}ページ`);
    console.log(`有効ページ: ${includedPages.length}ページ (${Math.round(includedPages.length / pages.length * 100)}%)`);
    
    // 3. ラベル統計の詳細
    console.log('\n🏷️ ラベル統計:');
    console.log('=' .repeat(60));
    console.log(`総ラベル数: ${labelStats.size}`);
    
    // 除外対象ラベルの統計
    const excludedLabels = ['アーカイブ', 'フォルダ', 'スコープ外'];
    console.log('\n除外対象ラベル:');
    excludedLabels.forEach(label => {
      const count = labelStats.get(label) || 0;
      console.log(`  ${label}: ${count}ページ`);
    });
    
    // 上位10ラベルを表示
    const sortedLabels = Array.from(labelStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    console.log('\n上位ラベル:');
    sortedLabels.forEach(([label, count]) => {
      const isExcluded = excludedLabels.includes(label);
      console.log(`  ${label}: ${count}ページ ${isExcluded ? '🚫' : '✅'}`);
    });
    
    // 4. タイトルパターン統計
    console.log('\n📝 タイトルパターン統計:');
    console.log('=' .repeat(60));
    console.log('除外対象タイトルパターン:');
    Array.from(titlePatternStats.entries()).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count}ページ`);
    });
    
    // 5. 並列同期の実行
    console.log('\n🔄 並列同期を実行中...');
    const syncStartTime = Date.now();
    
    const syncResult = await confluenceSyncService.syncPagesParallel(pages, 20);
    
    const syncEndTime = Date.now();
    const syncTime = syncEndTime - syncStartTime;
    
    console.log(`\n📈 同期結果:`);
    console.log('=' .repeat(60));
    console.log(`追加: ${syncResult.added}ページ`);
    console.log(`更新: ${syncResult.updated}ページ`);
    console.log(`変更なし: ${syncResult.unchanged}ページ`);
    console.log(`除外: ${syncResult.excluded}ページ`);
    console.log(`エラー: ${syncResult.errors.length}件`);
    console.log(`同期時間: ${syncTime}ms`);
    console.log(`同期速度: ${Math.round(pages.length / syncTime * 1000)}ページ/秒`);

    if (syncResult.errors.length > 0) {
      console.log(`\n❌ エラー詳細:`);
      syncResult.errors.slice(0, 5).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      if (syncResult.errors.length > 5) {
        console.log(`  ... 他 ${syncResult.errors.length - 5}件のエラー`);
      }
    }

    // 6. ハイブリッド検索のテスト
    console.log('\n🔍 ハイブリッド検索をテスト中...');
    const searchStartTime = Date.now();
    
    const searchResults = await searchEngine.search({ 
      query: '機能要件 システム 管理', 
      topK: 15 
    });
    
    const searchEndTime = Date.now();
    const searchTime = searchEndTime - searchStartTime;
    
    console.log(`\n📊 検索結果:`);
    console.log('=' .repeat(60));
    console.log(`検索結果数: ${searchResults.length}件`);
    console.log(`検索時間: ${searchTime}ms`);
    console.log(`検索速度: ${Math.round(searchResults.length / searchTime * 1000)}件/秒`);
    
    searchResults.slice(0, 10).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 7. 除外ルールの効果確認
    console.log('\n🎯 除外ルールの効果確認:');
    console.log('=' .repeat(60));
    
    const hasExcludedResults = searchResults.some(result => 
      result.title.includes('■要件定義') || 
      result.title.includes('xxx_') ||
      (result.labels && result.labels.some((label: string) => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label)))
    );
    
    if (hasExcludedResults) {
      console.log('⚠️ 警告: 除外対象のページが検索結果に含まれています');
      
      // 除外対象の検索結果を特定
      const excludedInResults = searchResults.filter(result => 
        result.title.includes('■要件定義') || 
        result.title.includes('xxx_') ||
        (result.labels && result.labels.some((label: string) => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label)))
      );
      
      console.log('\n除外対象の検索結果:');
      excludedInResults.forEach((result, index) => {
        console.log(`  ${index + 1}. ${result.title}`);
        console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
      });
    } else {
      console.log('✅ 成功: 除外対象のページは検索結果に含まれていません');
    }

    // 8. パフォーマンス分析
    console.log('\n📈 パフォーマンス分析:');
    console.log('=' .repeat(60));
    
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
    
    // 9. メモリ使用量の推定
    const estimatedMemoryMB = Math.round((totalPages * 50) / 1024); // 1ページあたり約50KBと仮定
    console.log(`\n💾 推定メモリ使用量: ${estimatedMemoryMB}MB`);

    // 10. 総合評価
    console.log('\n🎯 総合評価:');
    console.log('=' .repeat(60));
    
    const isHighPerformance = totalPages / totalTime * 1000 > 10; // 10ページ/秒以上
    const isLowError = syncResult.errors.length < totalPages * 0.01; // エラー率1%未満
    const isGoodSearch = searchResults.length > 0 && searchTime < 2000; // 検索結果あり、2秒以内
    const isGoodExclusion = syncResult.excluded > 0 && !hasExcludedResults; // 除外が機能し、検索結果に除外対象がない
    
    console.log(`✅ 高性能: ${isHighPerformance ? 'Yes' : 'No'} (${Math.round(totalPages / totalTime * 1000)}ページ/秒)`);
    console.log(`✅ 低エラー率: ${isLowError ? 'Yes' : 'No'} (${syncResult.errors.length}/${totalPages}件)`);
    console.log(`✅ 高速検索: ${isGoodSearch ? 'Yes' : 'No'} (${searchTime}ms)`);
    console.log(`✅ 除外機能: ${isGoodExclusion ? 'Yes' : 'No'} (${syncResult.excluded}ページ除外, 検索結果に除外対象なし)`);
    
    const overallScore = (isHighPerformance ? 1 : 0) + (isLowError ? 1 : 0) + (isGoodSearch ? 1 : 0) + (isGoodExclusion ? 1 : 0);
    console.log(`\n🏆 総合スコア: ${overallScore}/4`);
    
    if (overallScore >= 3) {
      console.log(`🎉 拡張除外ルールでの全件処理は優秀な性能を発揮しています！`);
    } else if (overallScore >= 2) {
      console.log(`👍 拡張除外ルールでの全件処理は良好な性能を発揮しています。`);
    } else {
      console.log(`⚠️ 拡張除外ルールでの全件処理の性能改善が必要です。`);
    }

    // 11. 除外ルールの効果サマリー
    console.log('\n📋 除外ルールの効果サマリー:');
    console.log('=' .repeat(60));
    console.log(`除外対象ページ数: ${totalExcluded}ページ`);
    console.log(`除外率: ${Math.round(totalExcluded / totalPages * 100)}%`);
    console.log(`有効ページ数: ${includedPages.length}ページ`);
    console.log(`同期除外数: ${syncResult.excluded}ページ`);
    console.log(`検索結果除外効果: ${hasExcludedResults ? 'なし' : 'あり'}`);

    console.log('\n✅ 拡張除外ルールでの全件処理テスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testFullSyncWithEnhancedExclusion().catch(console.error);
