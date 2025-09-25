/**
 * LanceDBの全ページ取得状況を確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('check-lancedb-all-pages.txt', message + '\n');
}

async function checkLanceDBAllPages() {
  fs.writeFileSync('check-lancedb-all-pages.txt', '');
  
  log('🔍 LanceDBの全ページ取得状況を確認中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. LanceDBに接続
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    // 2. 全チャンクを取得
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`📊 LanceDB内の総チャンク数: ${allChunks.length}`);
    
    // 3. ページID別に集計
    const pageIdMap = new Map<number, any[]>();
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!pageIdMap.has(pageId)) {
        pageIdMap.set(pageId, []);
      }
      pageIdMap.get(pageId)!.push(chunk);
    });
    
    log(`📊 ユニークページ数: ${pageIdMap.size}`);
    
    // 4. ページID別のチャンク数を表示
    log('\n📋 ページID別チャンク数:');
    const sortedPages = Array.from(pageIdMap.entries()).sort((a, b) => b[1].length - a[1].length);
    
    sortedPages.slice(0, 20).forEach(([pageId, chunks], index) => {
      const firstChunk = chunks[0];
      log(`${index + 1}. PageID: ${pageId}, チャンク数: ${chunks.length}, タイトル: ${firstChunk.title}`);
    });
    
    if (sortedPages.length > 20) {
      log(`... 他 ${sortedPages.length - 20} ページ`);
    }
    
    // 5. Confluence APIから全ページ数を取得
    log('\n🌐 Confluence APIから全ページ数を確認中...');
    
    try {
      // まず最初のページを取得して総数を確認
      const firstPage = await confluenceSyncService.getConfluencePages(1, 0);
      log(`📊 Confluence API レスポンス: ${firstPage.length}件 (最初のページ)`);
      
      // より多くのページを取得して実際の総数を確認
      const morePages = await confluenceSyncService.getConfluencePages(50, 0);
      log(`📊 Confluence API レスポンス: ${morePages.length}件 (50ページ取得)`);
      
      // さらに多くのページを取得
      const manyPages = await confluenceSyncService.getConfluencePages(200, 0);
      log(`📊 Confluence API レスポンス: ${manyPages.length}件 (200ページ取得)`);
      
      // 最大限取得を試行
      const maxPages = await confluenceSyncService.getConfluencePages(1000, 0);
      log(`📊 Confluence API レスポンス: ${maxPages.length}件 (1000ページ取得)`);
      
    } catch (error) {
      log(`❌ Confluence API取得エラー: ${error}`);
    }
    
    // 6. 同期状況の分析
    log('\n📊 同期状況の分析:');
    log(`- LanceDB内ページ数: ${pageIdMap.size}`);
    log(`- LanceDB内チャンク数: ${allChunks.length}`);
    log(`- 平均チャンク数/ページ: ${(allChunks.length / pageIdMap.size).toFixed(2)}`);
    
    // 7. 最新の同期結果を確認
    log('\n🔄 最新の同期結果を確認中...');
    
    try {
      // 20ページで同期テスト
      const testPages = await confluenceSyncService.getConfluencePages(20, 0);
      log(`📊 テスト用ページ取得: ${testPages.length}件`);
      
      const syncResult = await confluenceSyncService.syncPages(testPages);
      log(`📊 同期結果:`);
      log(`  - 追加: ${syncResult.added}`);
      log(`  - 更新: ${syncResult.updated}`);
      log(`  - 変更なし: ${syncResult.unchanged}`);
      log(`  - 除外: ${syncResult.excluded}`);
      log(`  - エラー: ${syncResult.errors.length}`);
      
    } catch (error) {
      log(`❌ 同期テストエラー: ${error}`);
    }
    
    // 8. データベースの状態確認
    log('\n🔍 データベースの状態確認:');
    
    // 最新のチャンク数を再確認
    const updatedChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 更新後の総チャンク数: ${updatedChunks.length}`);
    
    // ページID別の最新状況
    const updatedPageIdMap = new Map<number, any[]>();
    updatedChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!updatedPageIdMap.has(pageId)) {
        updatedPageIdMap.set(pageId, []);
      }
      updatedPageIdMap.get(pageId)!.push(chunk);
    });
    
    log(`📊 更新後のユニークページ数: ${updatedPageIdMap.size}`);
    
    // 9. 結論
    log('\n🎯 結論:');
    if (updatedPageIdMap.size > 0) {
      log(`✅ LanceDBには ${updatedPageIdMap.size} ページ分のデータが格納されています`);
      log(`✅ 総チャンク数: ${updatedChunks.length}`);
      log(`✅ 平均チャンク数/ページ: ${(updatedChunks.length / updatedPageIdMap.size).toFixed(2)}`);
    } else {
      log(`❌ LanceDBにデータが格納されていません`);
    }
    
    log('\n✅ 全ページ取得状況確認完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

checkLanceDBAllPages().catch(console.error);
