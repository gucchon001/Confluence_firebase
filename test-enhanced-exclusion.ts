/**
 * 拡張除外ルールのテスト
 * ラベル「スコープ外」とタイトルパターン「■要件定義」「xxx_」の除外をテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testEnhancedExclusion() {
  console.log('🚫 拡張除外ルールのテストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 10ページを取得してテスト
    console.log('📄 10ページのConfluenceデータを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(10, 0);
    
    console.log(`\n📊 取得したページ数: ${pages.length}ページ`);
    
    // 2. 除外対象の分析
    console.log('\n🔍 除外対象の分析:');
    console.log('=' .repeat(50));
    
    let excludedByLabel = 0;
    let excludedByTitle = 0;
    let excludedByBoth = 0;
    let totalExcluded = 0;
    
    const excludedPages = [];
    const includedPages = [];
    
    pages.forEach(page => {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
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
      } else {
        includedPages.push({
          title: page.title,
          id: page.id,
          labels: labels
        });
      }
    });
    
    console.log(`除外対象ページ: ${totalExcluded}ページ`);
    console.log(`  - ラベルで除外: ${excludedByLabel}ページ`);
    console.log(`  - タイトルで除外: ${excludedByTitle}ページ`);
    console.log(`  - 両方で除外: ${excludedByBoth}ページ`);
    console.log(`有効ページ: ${includedPages.length}ページ`);
    
    // 3. 除外対象ページの詳細表示
    if (excludedPages.length > 0) {
      console.log('\n🚫 除外対象ページの詳細:');
      console.log('=' .repeat(50));
      
      excludedPages.forEach((page, index) => {
        console.log(`\n${index + 1}. ${page.title} (ID: ${page.id})`);
        console.log(`   ラベル: [${page.labels.join(', ')}]`);
        console.log(`   除外理由:`);
        if (page.excludedByLabel) {
          const excludedLabels = page.labels.filter(label => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label));
          console.log(`     - ラベル: [${excludedLabels.join(', ')}]`);
        }
        if (page.excludedByTitle) {
          if (page.title.includes('■要件定義')) {
            console.log(`     - タイトルパターン: ■要件定義`);
          }
          if (page.title.includes('xxx_')) {
            console.log(`     - タイトルパターン: xxx_`);
          }
        }
      });
    }
    
    // 4. 有効ページの詳細表示
    if (includedPages.length > 0) {
      console.log('\n✅ 有効ページの詳細:');
      console.log('=' .repeat(50));
      
      includedPages.forEach((page, index) => {
        console.log(`${index + 1}. ${page.title} (ID: ${page.id})`);
        console.log(`   ラベル: [${page.labels.join(', ')}]`);
      });
    }

    // 5. 同期テスト
    console.log('\n🔄 同期テストを実行中...');
    const syncResult = await confluenceSyncService.syncPages(pages);
    
    console.log('\n📈 同期結果:');
    console.log('=' .repeat(50));
    console.log(`追加: ${syncResult.added}ページ`);
    console.log(`更新: ${syncResult.updated}ページ`);
    console.log(`変更なし: ${syncResult.unchanged}ページ`);
    console.log(`除外: ${syncResult.excluded}ページ`);
    console.log(`エラー: ${syncResult.errors.length}件`);
    
    // 6. 検索テスト
    console.log('\n🔍 検索テストを実行中...');
    const searchResults = await searchEngine.search({ 
      query: '要件定義 システム', 
      topK: 10 
    });
    
    console.log('\n📊 検索結果:');
    console.log('=' .repeat(50));
    console.log(`検索結果数: ${searchResults.length}件`);
    
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   ラベル: [${JSON.stringify(result.labels)}]`);
    });
    
    // 7. 除外ルールの効果確認
    console.log('\n🎯 除外ルールの効果確認:');
    console.log('=' .repeat(50));
    
    const hasExcludedResults = searchResults.some(result => 
      result.title.includes('■要件定義') || 
      result.title.includes('xxx_') ||
      (result.labels && result.labels.some((label: string) => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label)))
    );
    
    if (hasExcludedResults) {
      console.log('⚠️ 警告: 除外対象のページが検索結果に含まれています');
    } else {
      console.log('✅ 成功: 除外対象のページは検索結果に含まれていません');
    }
    
    // 8. 統計サマリー
    console.log('\n📊 統計サマリー:');
    console.log('=' .repeat(50));
    console.log(`総ページ数: ${pages.length}ページ`);
    console.log(`除外ページ数: ${totalExcluded}ページ (${Math.round(totalExcluded / pages.length * 100)}%)`);
    console.log(`有効ページ数: ${includedPages.length}ページ (${Math.round(includedPages.length / pages.length * 100)}%)`);
    console.log(`同期除外数: ${syncResult.excluded}ページ`);
    console.log(`検索結果数: ${searchResults.length}件`);
    
    // 9. 除外ルールの評価
    console.log('\n🏆 除外ルールの評価:');
    console.log('=' .repeat(50));
    
    const labelExclusionRate = Math.round(excludedByLabel / pages.length * 100);
    const titleExclusionRate = Math.round(excludedByTitle / pages.length * 100);
    const totalExclusionRate = Math.round(totalExcluded / pages.length * 100);
    
    console.log(`ラベル除外率: ${labelExclusionRate}%`);
    console.log(`タイトル除外率: ${titleExclusionRate}%`);
    console.log(`総除外率: ${totalExclusionRate}%`);
    
    if (totalExclusionRate > 0) {
      console.log('✅ 除外ルールが正常に動作しています');
    } else {
      console.log('ℹ️ 除外対象のページがありませんでした');
    }
    
    console.log('\n✅ 拡張除外ルールテスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testEnhancedExclusion().catch(console.error);
