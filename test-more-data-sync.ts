/**
 * より多くのデータで同期テストを実行
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function testMoreDataSync() {
  console.log('🚀 より多くのデータで同期テストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 5ページのデータを取得
    console.log('📄 5ページのConfluenceデータを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(5, 0);
    
    console.log(`📊 取得したページ数: ${pages.length}`);
    pages.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page.title} (ID: ${page.id})`);
      console.log(`     ラベル数: ${page.metadata?.labels?.results?.length || 0}`);
    });

    // 同期を実行
    console.log('\n🔄 ページ同期を実行中...');
    const syncResult = await confluenceSyncService.syncPages(pages);
    
    console.log('\n📈 同期結果:');
    console.log(`  追加: ${syncResult.added}ページ`);
    console.log(`  更新: ${syncResult.updated}ページ`);
    console.log(`  変更なし: ${syncResult.unchanged}ページ`);
    console.log(`  エラー: ${syncResult.errors}件`);

    console.log('\n✅ 同期完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testMoreDataSync().catch(console.error);
