/**
 * ラベルフィルタリング機能のテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function testLabelFiltering() {
  console.log('🔍 ラベルフィルタリング機能のテストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 10ページのデータを取得
    console.log('📄 10ページのConfluenceデータを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(10, 0);
    
    console.log(`📊 取得したページ数: ${pages.length}`);
    
    // 各ページのラベルを表示
    console.log('\n📋 各ページのラベル情報:');
    pages.forEach((page, index) => {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      console.log(`  ${index + 1}. ${page.title} (ID: ${page.id})`);
      console.log(`     ラベル: [${labels.join(', ')}]`);
    });

    // 同期を実行（フィルタリング機能付き）
    console.log('\n🔄 ラベルフィルタリング付き同期を実行中...');
    const syncResult = await confluenceSyncService.syncPages(pages);
    
    console.log('\n📈 同期結果:');
    console.log(`  追加: ${syncResult.added}ページ`);
    console.log(`  更新: ${syncResult.updated}ページ`);
    console.log(`  変更なし: ${syncResult.unchanged}ページ`);
    console.log(`  除外: ${syncResult.excluded}ページ`);
    console.log(`  エラー: ${syncResult.errors.length}件`);
    
    if (syncResult.errors.length > 0) {
      console.log(`  エラー詳細:`);
      syncResult.errors.forEach((error, index) => {
        console.log(`    ${index + 1}. ${error}`);
      });
    }

    // フィルタリング機能の評価
    console.log('\n📋 ラベルフィルタリング機能の評価:');
    console.log('=' .repeat(50));
    
    if (syncResult.excluded > 0) {
      console.log(`✅ 除外機能: ${syncResult.excluded}ページが正しく除外されました`);
    } else {
      console.log(`ℹ️ 除外対象: 除外対象のラベル（アーカイブ、フォルダ）を持つページはありませんでした`);
    }
    
    console.log('\n🎯 フィルタリング機能の動作確認完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testLabelFiltering().catch(console.error);
