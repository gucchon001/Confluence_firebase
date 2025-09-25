/**
 * Confluenceの更新日時が毎回異なる原因を調査（ファイル出力版）
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('debug-confluence-timestamps.txt', message + '\n');
}

async function debugConfluenceTimestamps() {
  // 結果ファイルをクリア
  fs.writeFileSync('debug-confluence-timestamps.txt', '');
  
  log('🔍 Confluenceの更新日時が毎回異なる原因を調査...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();

    // 1. 同じページを複数回取得して更新日時を比較
    log('📄 同じページを複数回取得中...');
    
    const page1 = await confluenceSyncService.getConfluencePages(1, 0);
    const page2 = await confluenceSyncService.getConfluencePages(1, 0);
    const page3 = await confluenceSyncService.getConfluencePages(1, 0);
    
    if (page1.length === 0) {
      log('❌ ページが見つかりませんでした');
      return;
    }

    const testPage1 = page1[0];
    const testPage2 = page2[0];
    const testPage3 = page3[0];

    log(`\n🧪 テストページ: ${testPage1.title} (ID: ${testPage1.id})`);
    
    log('\n📅 更新日時の詳細比較:');
    log(`  1回目: ${testPage1.version?.when}`);
    log(`  2回目: ${testPage2.version?.when}`);
    log(`  3回目: ${testPage3.version?.when}`);
    
    // 2. 更新日時の型と内容を詳細に確認
    log('\n🔍 更新日時の型と内容:');
    log(`  1回目の型: ${typeof testPage1.version?.when}`);
    log(`  2回目の型: ${typeof testPage2.version?.when}`);
    log(`  3回目の型: ${typeof testPage3.version?.when}`);
    
    // 3. 日時オブジェクトとして比較
    if (testPage1.version?.when && testPage2.version?.when && testPage3.version?.when) {
      const date1 = new Date(testPage1.version.when);
      const date2 = new Date(testPage2.version.when);
      const date3 = new Date(testPage3.version.when);
      
      log('\n📊 日時オブジェクト比較:');
      log(`  1回目: ${date1.toISOString()}`);
      log(`  2回目: ${date2.toISOString()}`);
      log(`  3回目: ${date3.toISOString()}`);
      
      log('\n📊 タイムスタンプ比較:');
      log(`  1回目: ${date1.getTime()}`);
      log(`  2回目: ${date2.getTime()}`);
      log(`  3回目: ${date3.getTime()}`);
      
      log('\n📊 差分比較:');
      log(`  2回目 - 1回目: ${date2.getTime() - date1.getTime()}ms`);
      log(`  3回目 - 2回目: ${date3.getTime() - date2.getTime()}ms`);
      log(`  3回目 - 1回目: ${date3.getTime() - date1.getTime()}ms`);
      
      // 4. 同じかどうか判定
      const isSame1_2 = date1.getTime() === date2.getTime();
      const isSame2_3 = date2.getTime() === date3.getTime();
      const isSame1_3 = date1.getTime() === date3.getTime();
      
      log('\n🎯 同一性判定:');
      log(`  1回目 = 2回目: ${isSame1_2}`);
      log(`  2回目 = 3回目: ${isSame2_3}`);
      log(`  1回目 = 3回目: ${isSame1_3}`);
      
      if (isSame1_2 && isSame2_3 && isSame1_3) {
        log('✅ 更新日時は同じです！');
      } else {
        log('❌ 更新日時が異なります！');
      }
    } else {
      log('❌ 更新日時が取得できませんでした');
    }

    // 5. ページ全体の比較
    log('\n🔍 ページ全体の比較:');
    log(`  タイトルが同じ: ${testPage1.title === testPage2.title && testPage2.title === testPage3.title}`);
    log(`  IDが同じ: ${testPage1.id === testPage2.id && testPage2.id === testPage3.id}`);
    log(`  コンテンツ長が同じ: ${testPage1.body?.storage?.value?.length === testPage2.body?.storage?.value?.length && testPage2.body?.storage?.value?.length === testPage3.body?.storage?.value?.length}`);

    // 6. ラベルの比較
    const labels1 = testPage1.metadata?.labels?.results?.map(label => label.name) || [];
    const labels2 = testPage2.metadata?.labels?.results?.map(label => label.name) || [];
    const labels3 = testPage3.metadata?.labels?.results?.map(label => label.name) || [];
    
    log('\n🏷️ ラベルの比較:');
    log(`  1回目: [${labels1.join(', ')}]`);
    log(`  2回目: [${labels2.join(', ')}]`);
    log(`  3回目: [${labels3.join(', ')}]`);
    log(`  ラベルが同じ: ${JSON.stringify(labels1) === JSON.stringify(labels2) && JSON.stringify(labels2) === JSON.stringify(labels3)}`);

    // 7. 実際の同期テスト
    log('\n🔄 実際の同期テスト...');
    
    // データベースをリセット
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    // 1回目の同期
    log('\n📝 1回目の同期...');
    const syncResult1 = await confluenceSyncService.syncPages([testPage1]);
    log(`  結果: 追加=${syncResult1.added}, 更新=${syncResult1.updated}, 変更なし=${syncResult1.unchanged}`);
    
    // 2回目の同期（同じページ）
    log('\n📝 2回目の同期（同じページ）...');
    const syncResult2 = await confluenceSyncService.syncPages([testPage1]);
    log(`  結果: 追加=${syncResult2.added}, 更新=${syncResult2.updated}, 変更なし=${syncResult2.unchanged}`);
    
    // 3回目の同期（同じページ）
    log('\n📝 3回目の同期（同じページ）...');
    const syncResult3 = await confluenceSyncService.syncPages([testPage1]);
    log(`  結果: 追加=${syncResult3.added}, 更新=${syncResult3.updated}, 変更なし=${syncResult3.unchanged}`);

    // 8. データベースの状態確認
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    const pageChunks = allChunks.filter((chunk: any) => chunk.pageId === parseInt(testPage1.id));
    
    log('\n📊 データベース状態:');
    log(`  総チャンク数: ${allChunks.length}`);
    log(`  テストページのチャンク数: ${pageChunks.length}`);
    
    if (pageChunks.length > 0) {
      pageChunks.forEach((chunk: any, index: number) => {
        log(`    チャンク ${index}: 更新日時=${chunk.lastUpdated}`);
      });
    }

    log('\n✅ Confluence更新日時の調査完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

debugConfluenceTimestamps().catch(console.error);
