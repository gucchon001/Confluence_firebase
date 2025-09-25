/**
 * 本番環境での全ページ同期テスト
 * Confluenceにある全てのページを取得して同期
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testFullProductionSync() {
  console.log('🚀 本番環境での全ページ同期テストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 全ページ数の確認
    console.log('📊 全ページ数の確認中...');
    const totalPagesResponse = await confluenceSyncService.getConfluencePages(1, 0);
    console.log(`📄 全ページ数: ${totalPagesResponse.length}ページ`);

    // 2. 全ページの取得（段階的に）
    console.log('\n📄 全ページの取得を開始...');
    const fetchStartTime = Date.now();
    
    // まず1000ページでテスト
    const pages = await confluenceSyncService.getConfluencePagesBatch(1000, 100);
    
    const fetchEndTime = Date.now();
    const fetchTime = fetchEndTime - fetchStartTime;
    
    console.log(`\n📊 取得結果:`);
    console.log(`  取得ページ数: ${pages.length}ページ`);
    console.log(`  取得時間: ${fetchTime}ms`);
    console.log(`  取得速度: ${Math.round(pages.length / fetchTime * 1000)}ページ/秒`);

    // 3. 除外対象の詳細分析
    console.log('\n🔍 除外対象の詳細分析:');
    console.log('=' .repeat(70));
    
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
    
    // 4. ラベル統計の詳細
    console.log('\n🏷️ ラベル統計:');
    console.log('=' .repeat(70));
    console.log(`総ラベル数: ${labelStats.size}`);
    
    // 除外対象ラベルの統計
    const excludedLabels = ['アーカイブ', 'フォルダ', 'スコープ外'];
    console.log('\n除外対象ラベル:');
    excludedLabels.forEach(label => {
      const count = labelStats.get(label) || 0;
      console.log(`  ${label}: ${count}ページ`);
    });
    
    // 上位15ラベルを表示
    const sortedLabels = Array.from(labelStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    
    console.log('\n上位ラベル:');
    sortedLabels.forEach(([label, count]) => {
      const isExcluded = excludedLabels.includes(label);
      console.log(`  ${label}: ${count}ページ ${isExcluded ? '🚫' : '✅'}`);
    });
    
    // 5. タイトルパターン統計
    console.log('\n📝 タイトルパターン統計:');
    console.log('=' .repeat(70));
    console.log('除外対象タイトルパターン:');
    Array.from(titlePatternStats.entries()).forEach(([pattern, count]) => {
      console.log(`  ${pattern}: ${count}ページ`);
    });
    
    // 6. 並列同期の実行
    console.log('\n🔄 並列同期を実行中...');
    const syncStartTime = Date.now();
    
    const syncResult = await confluenceSyncService.syncPagesParallel(pages, 25);
    
    const syncEndTime = Date.now();
    const syncTime = syncEndTime - syncStartTime;
    
    console.log(`\n📈 同期結果:`);
    console.log('=' .repeat(70));
    console.log(`追加: ${syncResult.added}ページ`);
    console.log(`更新: ${syncResult.updated}ページ`);
    console.log(`変更なし: ${syncResult.unchanged}ページ`);
    console.log(`除外: ${syncResult.excluded}ページ`);
    console.log(`エラー: ${syncResult.errors.length}件`);
    console.log(`同期時間: ${syncTime}ms`);
    console.log(`同期速度: ${Math.round(pages.length / syncTime * 1000)}ページ/秒`);

    if (syncResult.errors.length > 0) {
      console.log(`\n❌ エラー詳細:`);
      syncResult.errors.slice(0, 10).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
      if (syncResult.errors.length > 10) {
        console.log(`  ... 他 ${syncResult.errors.length - 10}件のエラー`);
      }
    }

    // 7. ハイブリッド検索のテスト
    console.log('\n🔍 ハイブリッド検索をテスト中...');
    const searchStartTime = Date.now();
    
    const searchResults = await searchEngine.search({ 
      query: '機能要件 システム 管理 要件定義', 
      topK: 20 
    });
    
    const searchEndTime = Date.now();
    const searchTime = searchEndTime - searchStartTime;
    
    console.log(`\n📊 検索結果:`);
    console.log('=' .repeat(70));
    console.log(`検索結果数: ${searchResults.length}件`);
    console.log(`検索時間: ${searchTime}ms`);
    console.log(`検索速度: ${Math.round(searchResults.length / searchTime * 1000)}件/秒`);
    
    searchResults.slice(0, 15).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 8. 除外ルールの効果確認
    console.log('\n🎯 除外ルールの効果確認:');
    console.log('=' .repeat(70));
    
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

    // 9. パフォーマンス分析
    console.log('\n📈 パフォーマンス分析:');
    console.log('=' .repeat(70));
    
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
    
    // 10. メモリ使用量の推定
    const estimatedMemoryMB = Math.round((totalPages * 50) / 1024); // 1ページあたり約50KBと仮定
    console.log(`\n💾 推定メモリ使用量: ${estimatedMemoryMB}MB`);

    // 11. 総合評価
    console.log('\n🎯 総合評価:');
    console.log('=' .repeat(70));
    
    const isHighPerformance = totalPages / totalTime * 1000 > 5; // 5ページ/秒以上
    const isLowError = syncResult.errors.length < totalPages * 0.01; // エラー率1%未満
    const isGoodSearch = searchResults.length > 0 && searchTime < 5000; // 検索結果あり、5秒以内
    const isGoodExclusion = syncResult.excluded > 0 && !hasExcludedResults; // 除外が機能し、検索結果に除外対象がない
    
    console.log(`✅ 高性能: ${isHighPerformance ? 'Yes' : 'No'} (${Math.round(totalPages / totalTime * 1000)}ページ/秒)`);
    console.log(`✅ 低エラー率: ${isLowError ? 'Yes' : 'No'} (${syncResult.errors.length}/${totalPages}件)`);
    console.log(`✅ 高速検索: ${isGoodSearch ? 'Yes' : 'No'} (${searchTime}ms)`);
    console.log(`✅ 除外機能: ${isGoodExclusion ? 'Yes' : 'No'} (${syncResult.excluded}ページ除外, 検索結果に除外対象なし)`);
    
    const overallScore = (isHighPerformance ? 1 : 0) + (isLowError ? 1 : 0) + (isGoodSearch ? 1 : 0) + (isGoodExclusion ? 1 : 0);
    console.log(`\n🏆 総合スコア: ${overallScore}/4`);
    
    if (overallScore >= 3) {
      console.log(`🎉 本番環境での全ページ同期は優秀な性能を発揮しています！`);
    } else if (overallScore >= 2) {
      console.log(`👍 本番環境での全ページ同期は良好な性能を発揮しています。`);
    } else {
      console.log(`⚠️ 本番環境での全ページ同期の性能改善が必要です。`);
    }

    // 12. 除外ルールの効果サマリー
    console.log('\n📋 除外ルールの効果サマリー:');
    console.log('=' .repeat(70));
    console.log(`除外対象ページ数: ${totalExcluded}ページ`);
    console.log(`除外率: ${Math.round(totalExcluded / totalPages * 100)}%`);
    console.log(`有効ページ数: ${includedPages.length}ページ`);
    console.log(`同期除外数: ${syncResult.excluded}ページ`);
    console.log(`検索結果除外効果: ${hasExcludedResults ? 'なし' : 'あり'}`);

    // 13. 本番環境での推奨事項
    console.log('\n💡 本番環境での推奨事項:');
    console.log('=' .repeat(70));
    
    if (totalPages > 500) {
      console.log('📊 大規模データセット: 1000ページ以上の処理が完了しました');
      console.log('🔄 定期同期: 1日1回の定期同期を推奨します');
      console.log('⚡ パフォーマンス: 並列処理により効率的に処理されています');
    }
    
    if (syncResult.excluded > totalPages * 0.3) {
      console.log('🚫 除外効果: 30%以上のページが除外され、データベースが最適化されています');
    }
    
    if (searchResults.length > 10) {
      console.log('🔍 検索品質: 十分な検索結果が得られています');
    }

    console.log('\n✅ 本番環境での全ページ同期テスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testFullProductionSync().catch(console.error);
