/**
 * 古いデータを削除して正しいデータで再同期
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('fix-old-data.txt', message + '\n');
}

async function fixOldData() {
  fs.writeFileSync('fix-old-data.txt', '');
  
  log('🔧 古いデータを削除して正しいデータで再同期中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 現在のLanceDBの状況を確認
    log('📊 現在のLanceDBの状況を確認中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`- 総チャンク数: ${allChunks.length}`);
    
    const targetPageId = 703529146;
    const targetChunks = allChunks.filter((chunk: any) => chunk.pageId === targetPageId);
    
    if (targetChunks.length > 0) {
      log(`- 対象ページのチャンク数: ${targetChunks.length}`);
      log(`- 古いコンテンツ長: ${targetChunks[0].content?.length || 0}文字`);
      log(`- 古いスペース: ${targetChunks[0].space_key}`);
    }
    
    // 2. 古いデータを削除
    log('\n🗑️ 古いデータを削除中...');
    if (targetChunks.length > 0) {
      await table.delete(`"pageId" = ${targetPageId}`);
      log(`✅ ページID ${targetPageId} の古いデータを削除しました`);
    }
    
    // 3. 正しいデータを取得
    log('\n📄 正しいデータを取得中...');
    const page = await confluenceSyncService.getConfluencePageById('703529146');
    
    if (page) {
      log(`✅ 正しいデータ取得成功:`);
      log(`- ID: ${page.id}`);
      log(`- タイトル: ${page.title}`);
      log(`- コンテンツ長: ${page.content?.length || 0}文字`);
      log(`- スペース: ${page.spaceKey}`);
      log(`- 最終更新: ${page.lastModified}`);
      
      // 4. 正しいデータで同期
      log('\n🔄 正しいデータで同期中...');
      const syncResult = await confluenceSyncService.syncPages([page]);
      
      log(`📊 同期結果:`);
      log(`- 追加: ${syncResult.added}`);
      log(`- 更新: ${syncResult.updated}`);
      log(`- 変更なし: ${syncResult.unchanged}`);
      log(`- 除外: ${syncResult.excluded}`);
      log(`- エラー: ${syncResult.errors.length}`);
      
      // 5. 同期後の確認
      log('\n📊 同期後の確認中...');
      const updatedChunks = await table.search(dummyVector).limit(10000).toArray();
      const updatedTargetChunks = updatedChunks.filter((chunk: any) => chunk.pageId === targetPageId);
      
      log(`更新後の状況:`);
      log(`- 総チャンク数: ${updatedChunks.length}`);
      log(`- 対象ページのチャンク数: ${updatedTargetChunks.length}`);
      
      if (updatedTargetChunks.length > 0) {
        const chunk = updatedTargetChunks[0];
        log(`- 新しいコンテンツ長: ${chunk.content?.length || 0}文字`);
        log(`- 新しいスペース: ${chunk.space_key}`);
        log(`- チャンクインデックス: ${chunk.chunkIndex}`);
        
        // コンテンツのプレビュー
        if (chunk.content && chunk.content.length > 0) {
          log(`- コンテンツプレビュー (最初の500文字):`);
          log(`"${chunk.content.substring(0, 500)}..."`);
        }
      }
      
      // 6. 改善状況の確認
      const improvement = updatedChunks.length - allChunks.length;
      log(`\n📈 改善状況:`);
      log(`- チャンク数変化: ${improvement}`);
      
      if (updatedTargetChunks.length > 0 && updatedTargetChunks[0].content?.length > 26) {
        log(`✅ コンテンツが正しく更新されました`);
        log(`- 古いコンテンツ: 26文字`);
        log(`- 新しいコンテンツ: ${updatedTargetChunks[0].content.length}文字`);
      } else {
        log(`⚠️ コンテンツの更新に問題があります`);
      }
      
    } else {
      log(`❌ 正しいデータの取得に失敗しました`);
    }
    
    log('\n✅ 古いデータ修正完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

fixOldData().catch(console.error);
