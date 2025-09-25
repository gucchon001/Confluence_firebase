/**
 * 修正されたタイムスタンプロジックをテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-fixed-timestamp-logic.txt', message + '\n');
}

async function testFixedTimestampLogic() {
  // 結果ファイルをクリア
  fs.writeFileSync('test-fixed-timestamp-logic.txt', '');
  
  log('🔧 修正されたタイムスタンプロジックをテスト...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();

    // 1. 有効なページを取得
    log('📄 有効なページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(20, 0);
    
    const validPages = [];
    for (const page of pages) {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      const hasExcludedLabel = labels.some(label => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label));
      const hasExcludedTitle = page.title.includes('■要件定義') || page.title.includes('xxx_');
      
      if (!hasExcludedLabel && !hasExcludedTitle) {
        validPages.push(page);
      }
    }

    if (validPages.length === 0) {
      log('❌ 有効なページが見つかりませんでした');
      return;
    }

    const testPage = validPages[0];
    log(`\n🧪 テストページ: ${testPage.title} (ID: ${testPage.id})`);
    
    // 2. 更新日時の詳細を確認
    log('\n📅 更新日時の詳細:');
    log(`  page.lastModified: ${testPage.lastModified}`);
    log(`  page.lastModified の型: ${typeof testPage.lastModified}`);
    log(`  page.version?.when: ${testPage.version?.when}`);
    log(`  page.version?.when の型: ${typeof testPage.version?.when}`);
    
    // 3. 同期ロジックでの更新日時取得を確認
    log('\n🔍 同期ロジックでの更新日時取得:');
    const confluenceLastModified = testPage.lastModified || new Date().toISOString();
    log(`  confluenceLastModified: ${confluenceLastModified}`);
    log(`  confluenceLastModified の型: ${typeof confluenceLastModified}`);
    
    // 4. 日時オブジェクトとして変換
    const confluenceDate = new Date(confluenceLastModified);
    log(`  confluenceDate: ${confluenceDate.toISOString()}`);
    log(`  confluenceDate の型: ${typeof confluenceDate}`);
    log(`  confluenceDate のタイムスタンプ: ${confluenceDate.getTime()}`);

    // 5. 1回目の同期
    log('\n🔄 1回目の同期...');
    const syncResult1 = await confluenceSyncService.syncPages([testPage]);
    log(`📈 1回目同期結果: 追加=${syncResult1.added}, 更新=${syncResult1.updated}, 変更なし=${syncResult1.unchanged}`);

    // 6. データベースの状態確認
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    const pageChunks = allChunks.filter((chunk: any) => chunk.pageId === parseInt(testPage.id));
    
    log(`\n📊 1回目同期後のデータベース状態:`);
    log(`  総チャンク数: ${allChunks.length}`);
    log(`  テストページのチャンク数: ${pageChunks.length}`);
    
    if (pageChunks.length > 0) {
      pageChunks.forEach((chunk: any, index: number) => {
        log(`    チャンク ${index}: 更新日時=${chunk.lastUpdated}`);
      });
    }

    // 7. 2回目の同期（同じページ）
    log('\n🔄 2回目の同期（同じページ）...');
    const syncResult2 = await confluenceSyncService.syncPages([testPage]);
    log(`📈 2回目同期結果: 追加=${syncResult2.added}, 更新=${syncResult2.updated}, 変更なし=${syncResult2.unchanged}`);

    // 8. 3回目の同期（同じページ）
    log('\n🔄 3回目の同期（同じページ）...');
    const syncResult3 = await confluenceSyncService.syncPages([testPage]);
    log(`📈 3回目同期結果: 追加=${syncResult3.added}, 更新=${syncResult3.updated}, 変更なし=${syncResult3.unchanged}`);

    // 9. 最終データベース状態
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    const finalPageChunks = finalChunks.filter((chunk: any) => chunk.pageId === parseInt(testPage.id));
    
    log(`\n📊 最終データベース状態:`);
    log(`  総チャンク数: ${finalChunks.length}`);
    log(`  テストページのチャンク数: ${finalPageChunks.length}`);
    
    if (finalPageChunks.length > 0) {
      finalPageChunks.forEach((chunk: any, index: number) => {
        log(`    チャンク ${index}: 更新日時=${chunk.lastUpdated}`);
      });
    }

    // 10. 重複チェック
    const chunksByPageId = new Map<number, any[]>();
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId.has(pageId)) {
        chunksByPageId.set(pageId, []);
      }
      chunksByPageId.get(pageId)!.push(chunk);
    });

    let duplicatePages = 0;
    for (const [pageId, chunks] of chunksByPageId) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages++;
        log(`⚠️ ページID ${pageId} に重複チャンクがあります`);
      }
    }

    // 11. 評価
    log('\n🎯 修正されたタイムスタンプロジックの評価:');
    log('=' .repeat(50));
    
    const isFirstSyncAdded = syncResult1.added === 1;
    const isSecondSyncUnchanged = syncResult2.unchanged === 1;
    const isThirdSyncUnchanged = syncResult3.unchanged === 1;
    const isNoDuplicates = duplicatePages === 0;
    const isCorrectChunkCount = finalPageChunks.length === 1;
    
    log(`✅ 1回目同期（新規追加）: ${isFirstSyncAdded ? 'Yes' : 'No'}`);
    log(`✅ 2回目同期（変更なし）: ${isSecondSyncUnchanged ? 'Yes' : 'No'}`);
    log(`✅ 3回目同期（変更なし）: ${isThirdSyncUnchanged ? 'Yes' : 'No'}`);
    log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'}`);
    log(`✅ チャンク数正常: ${isCorrectChunkCount ? 'Yes' : 'No'}`);
    
    const overallScore = (isFirstSyncAdded ? 1 : 0) + (isSecondSyncUnchanged ? 1 : 0) + 
                        (isThirdSyncUnchanged ? 1 : 0) + (isNoDuplicates ? 1 : 0) + 
                        (isCorrectChunkCount ? 1 : 0);
    
    log(`\n🏆 総合スコア: ${overallScore}/5`);
    
    if (overallScore >= 4) {
      log(`🎉 修正されたタイムスタンプロジックは正常に動作しています！`);
    } else if (overallScore >= 3) {
      log(`👍 修正されたタイムスタンプロジックは概ね正常に動作しています。`);
    } else {
      log(`⚠️ 修正されたタイムスタンプロジックに問題があります。`);
    }

    log('\n✅ 修正されたタイムスタンプロジックのテスト完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testFixedTimestampLogic().catch(console.error);
