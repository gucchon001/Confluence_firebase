/**
 * LanceDBの全データを一括削除
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('batch-delete-all.txt', message + '\n');
}

async function batchDeleteAll() {
  fs.writeFileSync('batch-delete-all.txt', '');
  
  log('🗑️ LanceDBの全データを一括削除中...\n');

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
    
    // 3. 一括削除を実行
    log('\n🗑️ 一括削除を実行中...');
    
    // 方法1: 全ページIDを取得して一括削除
    const pageIds = [...new Set(allChunks.map((chunk: any) => chunk.pageId))];
    log(`- 削除対象のページ数: ${pageIds.length}`);
    
    // ページIDをバッチで削除
    const batchSize = 100; // 100ページずつ削除
    let deletedPages = 0;
    
    for (let i = 0; i < pageIds.length; i += batchSize) {
      const batch = pageIds.slice(i, i + batchSize);
      const deleteConditions = batch.map(pageId => `"pageId" = ${pageId}`).join(' OR ');
      
      try {
        await table.delete(deleteConditions);
        deletedPages += batch.length;
        log(`✅ バッチ ${Math.floor(i / batchSize) + 1}: ${batch.length}ページ削除完了 (累計: ${deletedPages}/${pageIds.length})`);
      } catch (error) {
        log(`❌ バッチ ${Math.floor(i / batchSize) + 1} 削除失敗: ${error}`);
        
        // 個別削除を試行
        for (const pageId of batch) {
          try {
            await table.delete(`"pageId" = ${pageId}`);
            deletedPages++;
            log(`✅ 個別削除: ページID ${pageId} 削除完了`);
          } catch (individualError) {
            log(`❌ 個別削除失敗: ページID ${pageId} - ${individualError}`);
          }
        }
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
      
      // 残存チャンクを個別削除
      log('\n🗑️ 残存チャンクを個別削除中...');
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
    
    log('\n✅ 一括削除完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

batchDeleteAll().catch(console.error);
