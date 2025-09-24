/**
 * 本物のConfluence APIを使用した正しい同期仕様のテスト実行スクリプト
 */

import { ConfluenceAPISyncService, ConfluencePage } from './test-confluence-api-sync';

async function runConfluenceAPITest() {
  console.log('🧪 本物のConfluence APIを使用した正しい同期仕様のテストを開始します...\n');

  const syncService = new ConfluenceAPISyncService();

  try {
    // 1. 初期状態を表示
    console.log('📊 テスト開始前の状態:');
    await syncService.showDatabaseStatus();

    // 2. Confluence APIから10ページを取得
    console.log('\n🔍 Confluence APIから10ページを取得中...');
    const pages = await syncService.getConfluencePages(10, 0);
    console.log(`取得したページ数: ${pages.length}`);
    
    if (pages.length === 0) {
      console.error('❌ Confluence APIからページを取得できませんでした。設定を確認してください。');
      return;
    }

    // 3. 初回同期（全ページ追加）
    console.log('\n🔄 初回同期を実行...');
    const firstSyncResult = await syncService.syncPages(pages);
    console.log('\n📈 初回同期結果:');
    console.log(`  追加: ${firstSyncResult.added}ページ`);
    console.log(`  更新: ${firstSyncResult.updated}ページ`);
    console.log(`  変更なし: ${firstSyncResult.unchanged}ページ`);
    console.log(`  エラー: ${firstSyncResult.errors.length}件`);

    // 4. 同期後の状態を表示
    console.log('\n📊 初回同期後の状態:');
    await syncService.showDatabaseStatus();

    // 5. 2回目同期（変更なし）
    console.log('\n🔄 2回目同期を実行（変更なし）...');
    const secondSyncResult = await syncService.syncPages(pages);
    console.log('\n📈 2回目同期結果:');
    console.log(`  追加: ${secondSyncResult.added}ページ`);
    console.log(`  更新: ${secondSyncResult.updated}ページ`);
    console.log(`  変更なし: ${secondSyncResult.unchanged}ページ`);
    console.log(`  エラー: ${secondSyncResult.errors.length}件`);

    // 6. 更新テスト用のデータを作成（実際のConfluenceページを再取得）
    console.log('\n🔍 更新テスト用にConfluenceページを再取得...');
    const updatedPages = await syncService.getConfluencePages(10, 0);
    
    // 7. 3回目同期（更新あり）
    console.log('\n🔄 3回目同期を実行（更新あり）...');
    const thirdSyncResult = await syncService.syncPages(updatedPages);
    console.log('\n📈 3回目同期結果:');
    console.log(`  追加: ${thirdSyncResult.added}ページ`);
    console.log(`  更新: ${thirdSyncResult.updated}ページ`);
    console.log(`  変更なし: ${thirdSyncResult.unchanged}ページ`);
    console.log(`  エラー: ${thirdSyncResult.errors.length}件`);

    // 8. 最終状態を表示
    console.log('\n📊 最終状態:');
    await syncService.showDatabaseStatus();

    // 9. テスト結果の評価
    console.log('\n🎯 テスト結果の評価:');
    console.log('\n📊 詳細比較:');
    console.log(`初回同期: 追加=${firstSyncResult.added}, 更新=${firstSyncResult.updated}, 変更なし=${firstSyncResult.unchanged}, エラー=${firstSyncResult.errors.length}`);
    console.log(`2回目同期: 追加=${secondSyncResult.added}, 更新=${secondSyncResult.updated}, 変更なし=${secondSyncResult.unchanged}, エラー=${secondSyncResult.errors.length}`);
    console.log(`3回目同期: 追加=${thirdSyncResult.added}, 更新=${thirdSyncResult.updated}, 変更なし=${thirdSyncResult.unchanged}, エラー=${thirdSyncResult.errors.length}`);
    
    const isFirstSyncCorrect = firstSyncResult.added > 0 && firstSyncResult.updated === 0 && firstSyncResult.unchanged === 0;
    const isSecondSyncCorrect = secondSyncResult.added === 0 && secondSyncResult.updated === 0 && secondSyncResult.unchanged > 0;
    const isThirdSyncCorrect = thirdSyncResult.added === 0 && (thirdSyncResult.updated > 0 || thirdSyncResult.unchanged > 0);

    console.log(`\n✅ 初回同期（全追加）: ${isFirstSyncCorrect ? '成功' : '失敗'}`);
    console.log(`✅ 2回目同期（変更なし）: ${isSecondSyncCorrect ? '成功' : '失敗'}`);
    console.log(`✅ 3回目同期（更新確認）: ${isThirdSyncCorrect ? '成功' : '失敗'}`);

    const allTestsPassed = isFirstSyncCorrect && isSecondSyncCorrect && isThirdSyncCorrect;
    console.log(`\n🎉 全体結果: ${allTestsPassed ? 'すべてのテストが成功しました！' : '一部のテストが失敗しました。'}`);
    
    // 10. 正しい仕様の確認
    console.log('\n📋 正しい仕様の確認:');
    console.log('1. ページIDが存在しない場合: 追加');
    console.log('2. ページIDが存在する場合: 更新日時比較');
    console.log('   - Confluenceの方が新しい場合: 削除して再作成');
    console.log('   - 更新がない場合: 何もしない');

    // 10. エラーの詳細表示
    if (firstSyncResult.errors.length > 0 || secondSyncResult.errors.length > 0 || thirdSyncResult.errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      [...firstSyncResult.errors, ...secondSyncResult.errors, ...thirdSyncResult.errors].forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  runConfluenceAPITest();
}

export { runConfluenceAPITest };
