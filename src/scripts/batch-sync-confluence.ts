/**
 * 統一Confluence同期スクリプト（batch-sync-confluence.ts）
 * 
 * 正しい仕様に基づくConfluence同期を実行
 * 1. ページIDが存在しない場合：追加
 * 2. ページIDが存在する場合：更新日時比較
 *    - Confluenceの方が新しい場合：削除して再作成
 *    - 更新がない場合：何もしない
 */

import 'dotenv/config';
import { confluenceSyncService } from '../lib/confluence-sync-service';

async function main() {
    console.log('🚀 統一Confluence同期を開始します...（全件実行）');

  try {
    // 1. テスト開始前のデータベース状態を表示
    console.log('\n📊 同期開始前の状態:');
    await confluenceSyncService.showDatabaseStatus();

    // 2. Confluence APIから全ページを取得（ページネーション対応）
    console.log('\n🔍 Confluence APIから全ページを取得中...');
    const confluencePages = await confluenceSyncService.getAllConfluencePages(); // 全件取得（ページネーション対応）
    console.log(`取得したページ数: ${confluencePages.length}`);

    if (confluencePages.length === 0) {
      console.error('❌ Confluence APIからページを取得できませんでした。同期を中断します。');
      return;
    }

    // 3. 同期を実行
    console.log('\n🔄 同期を実行...');
    const syncResult = await confluenceSyncService.syncPages(confluencePages);
    
    console.log('\n📈 同期結果:');
    console.log(`  追加: ${syncResult.added}ページ`);
    console.log(`  更新: ${syncResult.updated}ページ`);
    console.log(`  変更なし: ${syncResult.unchanged}ページ`);
    console.log(`  エラー: ${syncResult.errors.length}件`);

    // 4. 同期後のデータベース状態を表示
    console.log('\n📊 同期後の状態:');
    await confluenceSyncService.showDatabaseStatus();

    // 5. エラーの詳細表示
    if (syncResult.errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      syncResult.errors.forEach((error, index) => {
        console.error(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n🎉 統一Confluence同期が完了しました！');

  } catch (error) {
    console.error('❌ 同期中にエラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
main();
}
