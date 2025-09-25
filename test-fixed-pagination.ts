/**
 * 修正版ページネーションのテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-fixed-pagination.txt', message + '\n');
}

async function testFixedPagination() {
  fs.writeFileSync('test-fixed-pagination.txt', '');
  
  log('🧪 修正版ページネーションのテスト開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 現在のLanceDBの状況を確認
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const currentChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`📊 現在のLanceDB: ${currentChunks.length}チャンク`);
    
    // 2. 修正版メソッドで全ページ取得
    log('\n🚀 修正版メソッドで全ページ取得中...');
    const allPages = await confluenceSyncService.getAllConfluencePages(1000);
    log(`📊 取得したページ数: ${allPages.length}`);
    
    // 3. 重複チェック
    const pageIds = new Set();
    const duplicates = [];
    
    allPages.forEach(page => {
      if (pageIds.has(page.id)) {
        duplicates.push(page.id);
      } else {
        pageIds.add(page.id);
      }
    });
    
    log(`📊 ユニークページ数: ${pageIds.size}`);
    log(`📊 重複ページ数: ${duplicates.length}`);
    
    // 4. 全ページ同期を実行
    if (allPages.length > 0) {
      log('\n🔄 全ページ同期を実行中...');
      const syncResult = await confluenceSyncService.syncPages(allPages);
      
      log(`📊 同期結果:`);
      log(`  - 追加: ${syncResult.added}`);
      log(`  - 更新: ${syncResult.updated}`);
      log(`  - 変更なし: ${syncResult.unchanged}`);
      log(`  - 除外: ${syncResult.excluded}`);
      log(`  - エラー: ${syncResult.errors.length}`);
      
      if (syncResult.errors.length > 0) {
        log(`\n❌ エラー詳細:`);
        syncResult.errors.forEach((error, index) => {
          log(`  ${index + 1}. ${error}`);
        });
      }
    }
    
    // 5. 最終的なLanceDBの状況を確認
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`\n📊 最終的なLanceDB: ${finalChunks.length}チャンク`);
    
    // 6. ページID別の集計
    const pageIdMap = new Map();
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!pageIdMap.has(pageId)) {
        pageIdMap.set(pageId, []);
      }
      pageIdMap.get(pageId).push(chunk);
    });
    
    log(`📊 最終的なユニークページ数: ${pageIdMap.size}`);
    
    // 7. 改善状況の確認
    const improvement = finalChunks.length - currentChunks.length;
    log(`\n📈 改善状況:`);
    log(`  - チャンク数増加: ${improvement}`);
    log(`  - ページ数増加: ${pageIdMap.size - 799}`);
    
    if (improvement > 0) {
      log(`✅ ページネーション修正により ${improvement} チャンクが追加されました`);
    } else {
      log(`⚠️ チャンク数に変化がありませんでした`);
    }
    
    log('\n✅ 修正版ページネーションテスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testFixedPagination().catch(console.error);
