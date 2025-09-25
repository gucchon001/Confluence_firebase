/**
 * LanceDBの既存データを全て削除
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('reset-lancedb-completely.txt', message + '\n');
}

async function resetLanceDBCompletely() {
  fs.writeFileSync('reset-lancedb-completely.txt', '');
  
  log('🗑️ LanceDBの既存データを全て削除中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. LanceDBに接続
    log('📊 LanceDBに接続中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    
    // 2. 現在の状況を確認
    log('📊 現在の状況を確認中...');
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`- 総チャンク数: ${allChunks.length}`);
    
    if (allChunks.length === 0) {
      log('✅ データベースは既に空です');
      return;
    }
    
    // 3. 全データを削除
    log('\n🗑️ 全データを削除中...');
    
    // 方法1: 全ページIDを取得して削除
    const pageIds = [...new Set(allChunks.map((chunk: any) => chunk.pageId))];
    log(`- 削除対象のページ数: ${pageIds.length}`);
    
    let deletedCount = 0;
    for (const pageId of pageIds) {
      try {
        await table.delete(`"pageId" = ${pageId}`);
        deletedCount++;
        log(`✅ ページID ${pageId} 削除完了`);
      } catch (error) {
        log(`❌ ページID ${pageId} 削除失敗: ${error}`);
      }
    }
    
    // 4. 削除確認
    log('\n🔍 削除確認中...');
    const afterDeleteChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`- 削除後の総チャンク数: ${afterDeleteChunks.length}`);
    
    if (afterDeleteChunks.length === 0) {
      log('✅ 全データ削除完了');
    } else {
      log(`❌ まだ ${afterDeleteChunks.length} チャンクが残存しています`);
      
      // 方法2: 個別削除を試行
      log('\n🗑️ 個別削除を試行中...');
      for (const chunk of afterDeleteChunks) {
        try {
          await table.delete(`"id" = '${chunk.id}'`);
          log(`✅ チャンク ${chunk.id} 削除完了`);
        } catch (error) {
          log(`❌ チャンク ${chunk.id} 削除失敗: ${error}`);
        }
      }
      
      // 最終確認
      const finalChunks = await table.search(dummyVector).limit(10000).toArray();
      log(`- 最終チャンク数: ${finalChunks.length}`);
      
      if (finalChunks.length === 0) {
        log('✅ 個別削除で全データ削除完了');
      } else {
        log(`❌ まだ ${finalChunks.length} チャンクが残存しています`);
      }
    }
    
    // 5. データベースの状態を確認
    log('\n📊 データベースの最終状態:');
    const finalCheck = await table.search(dummyVector).limit(10000).toArray();
    log(`- 総チャンク数: ${finalCheck.length}`);
    log(`- データベースサイズ: ${finalCheck.length === 0 ? '空' : 'データあり'}`);
    
    if (finalCheck.length === 0) {
      log('\n✅ LanceDBの全データ削除が完了しました');
      log('🔄 これで正しいデータで再同期できます');
    } else {
      log('\n❌ データ削除に問題があります');
    }
    
    log('\n✅ LanceDBリセット完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

resetLanceDBCompletely().catch(console.error);
