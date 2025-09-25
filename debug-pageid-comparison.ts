/**
 * pageIdの型比較と更新判定をデバッグ
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function debugPageIdComparison() {
  console.log('🔍 pageIdの型比較と更新判定をデバッグ...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();

    // 1. 有効なページを取得
    console.log('📄 有効なページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(10, 0);
    
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
      console.log('❌ 有効なページが見つかりませんでした');
      return;
    }

    const testPage = validPages[0];
    console.log(`\n🧪 テストページ: ${testPage.title} (ID: ${testPage.id})`);
    console.log(`📅 Confluence更新日時: ${testPage.version?.when}`);

    // 2. pageIdの型を詳細に確認
    console.log('\n🔍 pageIdの型詳細:');
    console.log(`  Confluence page.id: ${testPage.id} (型: ${typeof testPage.id})`);
    console.log(`  parseInt(page.id): ${parseInt(testPage.id)} (型: ${typeof parseInt(testPage.id)})`);
    console.log(`  Number(page.id): ${Number(testPage.id)} (型: ${typeof Number(testPage.id)})`);

    // 3. 1回目の同期
    console.log('\n🔄 1回目の同期...');
    const syncResult1 = await confluenceSyncService.syncPages([testPage]);
    console.log(`📈 1回目同期結果: 追加=${syncResult1.added}, 更新=${syncResult1.updated}, 変更なし=${syncResult1.unchanged}`);

    // 4. データベースの状態確認
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`\n📊 データベース状態:`);
    console.log(`  総チャンク数: ${allChunks.length}`);
    
    const pageChunks = allChunks.filter((chunk: any) => chunk.pageId === parseInt(testPage.id));
    console.log(`  テストページのチャンク数: ${pageChunks.length}`);
    
    if (pageChunks.length > 0) {
      pageChunks.forEach((chunk: any, index: number) => {
        console.log(`    チャンク ${index}: pageId=${chunk.pageId} (型: ${typeof chunk.pageId}), 更新日時=${chunk.lastUpdated}`);
      });
    }

    // 5. 2回目の同期（同じデータ）
    console.log('\n🔄 2回目の同期（同じデータ）...');
    const syncResult2 = await confluenceSyncService.syncPages([testPage]);
    console.log(`📈 2回目同期結果: 追加=${syncResult2.added}, 更新=${syncResult2.updated}, 変更なし=${syncResult2.unchanged}`);

    // 6. 3回目の同期（同じデータ）
    console.log('\n🔄 3回目の同期（同じデータ）...');
    const syncResult3 = await confluenceSyncService.syncPages([testPage]);
    console.log(`📈 3回目同期結果: 追加=${syncResult3.added}, 更新=${syncResult3.updated}, 変更なし=${syncResult3.unchanged}`);

    // 7. 最終データベース状態
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    const finalPageChunks = finalChunks.filter((chunk: any) => chunk.pageId === parseInt(testPage.id));
    
    console.log(`\n📊 最終データベース状態:`);
    console.log(`  総チャンク数: ${finalChunks.length}`);
    console.log(`  テストページのチャンク数: ${finalPageChunks.length}`);
    
    // 8. 重複チェック
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
        console.log(`⚠️ ページID ${pageId} に重複チャンクがあります`);
      }
    }

    // 9. 型比較の詳細デバッグ
    console.log('\n🔍 型比較の詳細デバッグ:');
    if (finalPageChunks.length > 0) {
      const existingChunk = finalPageChunks[0];
      console.log(`  既存チャンクのpageId: ${existingChunk.pageId} (型: ${typeof existingChunk.pageId})`);
      console.log(`  Confluence page.id: ${testPage.id} (型: ${typeof testPage.id})`);
      console.log(`  parseInt(testPage.id): ${parseInt(testPage.id)} (型: ${typeof parseInt(testPage.id)})`);
      console.log(`  比較結果: ${existingChunk.pageId === parseInt(testPage.id)}`);
      console.log(`  厳密等価: ${existingChunk.pageId === parseInt(testPage.id)}`);
      console.log(`  緩い等価: ${existingChunk.pageId == parseInt(testPage.id)}`);
    }

    // 10. 日時比較の詳細デバッグ
    console.log('\n🔍 日時比較の詳細デバッグ:');
    if (finalPageChunks.length > 0) {
      const existingLastModified = finalPageChunks[0].lastUpdated;
      const confluenceLastModified = testPage.version?.when || new Date().toISOString();
      
      console.log(`  既存データ: ${existingLastModified}`);
      console.log(`  Confluence: ${confluenceLastModified}`);
      
      const existingDate = new Date(existingLastModified);
      const confluenceDate = new Date(confluenceLastModified);
      
      console.log(`  既存Date: ${existingDate.toISOString()}`);
      console.log(`  ConfluenceDate: ${confluenceDate.toISOString()}`);
      console.log(`  既存タイムスタンプ: ${existingDate.getTime()}`);
      console.log(`  Confluenceタイムスタンプ: ${confluenceDate.getTime()}`);
      console.log(`  差分(ms): ${confluenceDate.getTime() - existingDate.getTime()}`);
      
      const timeDiff = confluenceDate.getTime() - existingDate.getTime();
      const isSignificantlyNewer = timeDiff > 1000;
      
      console.log(`  1秒以上新しい: ${isSignificantlyNewer} (差分: ${timeDiff}ms)`);
    }

    // 11. 評価
    console.log('\n🎯 評価:');
    console.log('=' .repeat(50));
    
    const isFirstSyncAdded = syncResult1.added === 1;
    const isSecondSyncUnchanged = syncResult2.unchanged === 1;
    const isThirdSyncUnchanged = syncResult3.unchanged === 1;
    const isNoDuplicates = duplicatePages === 0;
    const isCorrectChunkCount = finalPageChunks.length === 1;
    
    console.log(`✅ 1回目同期（新規追加）: ${isFirstSyncAdded ? 'Yes' : 'No'}`);
    console.log(`✅ 2回目同期（変更なし）: ${isSecondSyncUnchanged ? 'Yes' : 'No'}`);
    console.log(`✅ 3回目同期（変更なし）: ${isThirdSyncUnchanged ? 'Yes' : 'No'}`);
    console.log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'}`);
    console.log(`✅ チャンク数正常: ${isCorrectChunkCount ? 'Yes' : 'No'}`);
    
    const overallScore = (isFirstSyncAdded ? 1 : 0) + (isSecondSyncUnchanged ? 1 : 0) + 
                        (isThirdSyncUnchanged ? 1 : 0) + (isNoDuplicates ? 1 : 0) + 
                        (isCorrectChunkCount ? 1 : 0);
    
    console.log(`\n🏆 総合スコア: ${overallScore}/5`);
    
    if (overallScore >= 4) {
      console.log(`🎉 pageId比較と更新判定は正常に動作しています！`);
    } else if (overallScore >= 3) {
      console.log(`👍 pageId比較と更新判定は概ね正常に動作しています。`);
    } else {
      console.log(`⚠️ pageId比較と更新判定に問題があります。`);
    }

    console.log('\n✅ pageId比較と更新判定のデバッグ完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

debugPageIdComparison().catch(console.error);
