/**
 * データベースの完全リセット
 * 重複データを完全にクリアして新しく開始
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function resetDatabaseCompletely() {
  console.log('🔄 データベースの完全リセットを開始...\n');

  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    const table = await lancedbClient.getTable();

    // 1. 現在のデータを確認
    console.log('📊 現在のデータを確認中...');
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📄 現在のチャンク数: ${allChunks.length}`);

    if (allChunks.length === 0) {
      console.log('✅ データベースは既に空です');
      return;
    }

    // 2. 全データを削除
    console.log('\n🗑️ 全データを削除中...');
    
    // 方法1: 全チャンクを個別に削除
    let deletedCount = 0;
    for (const chunk of allChunks) {
      try {
        await table.delete(`"id" = '${chunk.id}'`);
        deletedCount++;
      } catch (error) {
        console.log(`⚠️ 削除失敗: ${chunk.id} - ${error}`);
      }
    }

    console.log(`📊 削除結果: ${deletedCount}/${allChunks.length}チャンク`);

    // 3. 削除後の確認
    console.log('\n🔍 削除後の確認...');
    const remainingChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📄 残存チャンク数: ${remainingChunks.length}`);

    if (remainingChunks.length > 0) {
      console.log('⚠️ まだデータが残っています。強制削除を試行します...');
      
      // 方法2: より強力な削除方法
      try {
        // テーブル全体を削除して再作成
        const db = await lancedbClient.getDatabase();
        await db.dropTable('confluence');
        console.log('✅ テーブルを完全に削除しました');
        
        // 新しいテーブルを作成
        await lancedbClient.connect();
        console.log('✅ 新しいテーブルを作成しました');
      } catch (error) {
        console.error(`❌ 強制削除エラー: ${error}`);
      }
    } else {
      console.log('✅ 全データが正常に削除されました');
    }

    // 4. 最終確認
    console.log('\n🔍 最終確認...');
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📄 最終チャンク数: ${finalChunks.length}`);

    if (finalChunks.length === 0) {
      console.log('✅ データベースの完全リセットが完了しました');
      
      // 5. テスト用に1ページを同期
      console.log('\n🧪 テスト用に1ページを同期中...');
      const confluenceSyncService = new ConfluenceSyncService();
      const pages = await confluenceSyncService.getConfluencePages(1, 0);
      
      if (pages.length > 0) {
        const syncResult = await confluenceSyncService.syncPages(pages);
        console.log(`📊 テスト同期結果:`);
        console.log(`  追加: ${syncResult.added}`);
        console.log(`  更新: ${syncResult.updated}`);
        console.log(`  変更なし: ${syncResult.unchanged}`);
        console.log(`  除外: ${syncResult.excluded}`);
        console.log(`  エラー: ${syncResult.errors.length}`);
        
        // 6. テストデータの確認
        const testChunks = await table.search(dummyVector).limit(10000).toArray();
        console.log(`\n📄 テスト後のチャンク数: ${testChunks.length}`);
        
        if (testChunks.length > 0) {
          console.log('✅ テスト同期が成功しました');
          console.log('🎉 データベースは正常に動作しています');
        } else {
          console.log('⚠️ テスト同期に問題があります');
        }
      } else {
        console.log('⚠️ テスト用のページが取得できませんでした');
      }
    } else {
      console.log('❌ データベースのリセットに失敗しました');
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

resetDatabaseCompletely().catch(console.error);
