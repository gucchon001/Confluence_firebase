/**
 * 日時比較ロジックのテスト
 * 除外対象ではないページで差分同期を確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function testDateComparison() {
  console.log('🕐 日時比較ロジックのテストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();

    // 1. より多くのページを取得して除外対象でないページを探す
    console.log('📄 20ページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(20, 0);
    console.log(`📊 取得ページ数: ${pages.length}ページ`);

    // 2. 除外対象でないページを特定
    const validPages = [];
    const excludedPages = [];

    for (const page of pages) {
      const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
      const hasExcludedLabel = labels.some(label => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label));
      const hasExcludedTitle = page.title.includes('■要件定義') || page.title.includes('xxx_');
      
      if (hasExcludedLabel || hasExcludedTitle) {
        excludedPages.push(page);
      } else {
        validPages.push(page);
      }
    }

    console.log(`\n📊 ページ分類:`);
    console.log(`  有効ページ: ${validPages.length}ページ`);
    console.log(`  除外ページ: ${excludedPages.length}ページ`);

    if (validPages.length === 0) {
      console.log('⚠️ 有効なページが見つかりませんでした。50ページ取得を試行します...');
      const morePages = await confluenceSyncService.getConfluencePages(50, 0);
      
      for (const page of morePages) {
        const labels = page.metadata?.labels?.results?.map(label => label.name) || [];
        const hasExcludedLabel = labels.some(label => ['アーカイブ', 'フォルダ', 'スコープ外'].includes(label));
        const hasExcludedTitle = page.title.includes('■要件定義') || page.title.includes('xxx_');
        
        if (!hasExcludedLabel && !hasExcludedTitle) {
          validPages.push(page);
        }
      }
      
      console.log(`📊 追加取得後の有効ページ: ${validPages.length}ページ`);
    }

    if (validPages.length === 0) {
      console.log('❌ 有効なページが見つかりませんでした。テストを終了します。');
      return;
    }

    // 3. 最初の有効ページでテスト
    const testPage = validPages[0];
    console.log(`\n🧪 テストページ: ${testPage.title} (ID: ${testPage.id})`);
    console.log(`📅 Confluence更新日時: ${testPage.version?.when}`);

    // 4. 1回目の同期（新規追加）
    console.log('\n🔄 1回目の同期（新規追加）...');
    const syncResult1 = await confluenceSyncService.syncPages([testPage]);
    
    console.log(`📈 1回目同期結果:`);
    console.log(`  追加: ${syncResult1.added}`);
    console.log(`  更新: ${syncResult1.updated}`);
    console.log(`  変更なし: ${syncResult1.unchanged}`);
    console.log(`  除外: ${syncResult1.excluded}`);
    console.log(`  エラー: ${syncResult1.errors.length}`);

    // 5. データベースの状態確認
    console.log('\n🔍 1回目同期後のデータベース状態...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📊 総チャンク数: ${allChunks.length}`);

    const pageChunks = allChunks.filter((chunk: any) => chunk.pageId === parseInt(testPage.id));
    console.log(`📊 テストページのチャンク数: ${pageChunks.length}`);
    
    if (pageChunks.length > 0) {
      pageChunks.forEach((chunk: any, index: number) => {
        console.log(`  チャンク ${index}: 枝番=${chunk.chunkIndex}, 更新日時=${chunk.lastUpdated}`);
      });
    }

    // 6. 2回目の同期（変更なしの確認）
    console.log('\n🔄 2回目の同期（変更なしの確認）...');
    const syncResult2 = await confluenceSyncService.syncPages([testPage]);
    
    console.log(`📈 2回目同期結果:`);
    console.log(`  追加: ${syncResult2.added}`);
    console.log(`  更新: ${syncResult2.updated}`);
    console.log(`  変更なし: ${syncResult2.unchanged}`);
    console.log(`  除外: ${syncResult2.excluded}`);
    console.log(`  エラー: ${syncResult2.errors.length}`);

    // 7. 3回目の同期（変更なしの再確認）
    console.log('\n🔄 3回目の同期（変更なしの再確認）...');
    const syncResult3 = await confluenceSyncService.syncPages([testPage]);
    
    console.log(`📈 3回目同期結果:`);
    console.log(`  追加: ${syncResult3.added}`);
    console.log(`  更新: ${syncResult3.updated}`);
    console.log(`  変更なし: ${syncResult3.unchanged}`);
    console.log(`  除外: ${syncResult3.excluded}`);
    console.log(`  エラー: ${syncResult3.errors.length}`);

    // 8. 最終データベース状態確認
    console.log('\n🔍 最終データベース状態...');
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📊 最終チャンク数: ${finalChunks.length}`);

    const finalPageChunks = finalChunks.filter((chunk: any) => chunk.pageId === parseInt(testPage.id));
    console.log(`📊 最終テストページのチャンク数: ${finalPageChunks.length}`);

    // 9. 重複チェック
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
      if (chunks.length > 1) {
        const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
        const uniqueIndexes = new Set(chunkIndexes);
        
        if (chunkIndexes.length !== uniqueIndexes.size) {
          duplicatePages++;
          console.log(`⚠️ ページID ${pageId} に重複チャンクがあります`);
        }
      }
    }

    // 10. 日時比較ロジックの評価
    console.log('\n🎯 日時比較ロジックの評価:');
    console.log('=' .repeat(50));
    
    const isFirstSyncAdded = syncResult1.added === 1;
    const isSecondSyncUnchanged = syncResult2.unchanged === 1;
    const isThirdSyncUnchanged = syncResult3.unchanged === 1;
    const isNoDuplicates = duplicatePages === 0;
    const isCorrectChunkCount = finalPageChunks.length > 0;
    
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
      console.log(`🎉 日時比較ロジックは正常に動作しています！`);
    } else if (overallScore >= 3) {
      console.log(`👍 日時比較ロジックは概ね正常に動作しています。`);
    } else {
      console.log(`⚠️ 日時比較ロジックに問題があります。`);
    }

    // 11. 詳細な日時比較のデバッグ
    if (finalPageChunks.length > 0) {
      console.log('\n🔍 詳細な日時比較デバッグ:');
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
      
      if (confluenceDate > existingDate) {
        console.log(`  ✅ Confluenceが新しい → 更新が必要`);
      } else if (confluenceDate < existingDate) {
        console.log(`  ⏭️ 既存が新しい → 更新不要`);
      } else {
        console.log(`  ⏭️ 同じ日時 → 更新不要`);
      }
    }

    console.log('\n✅ 日時比較ロジックのテスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testDateComparison().catch(console.error);
