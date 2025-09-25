/**
 * より多くのページでセットデータ管理をテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testSetManagementWithMorePages() {
  console.log('🧹 より多くのページでセットデータ管理をテスト...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. より多くのページを取得
    console.log('📄 20ページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(20, 0);
    console.log(`📊 取得ページ数: ${pages.length}ページ`);
    
    // 除外対象でないページを特定
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

    console.log(`📊 ページ分類:`);
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

    // 2. 最初の3ページでテスト
    const testPages = validPages.slice(0, 3);
    console.log(`\n🧪 テストページ数: ${testPages.length}ページ`);
    testPages.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page.title} (ID: ${page.id})`);
    });

    // 3. セットデータとして同期
    console.log('\n🔄 セットデータとして同期中...');
    const syncResult = await confluenceSyncService.syncPages(testPages);
    
    console.log(`\n📈 同期結果:`);
    console.log(`  追加: ${syncResult.added}ページ`);
    console.log(`  更新: ${syncResult.updated}ページ`);
    console.log(`  変更なし: ${syncResult.unchanged}ページ`);
    console.log(`  除外: ${syncResult.excluded}ページ`);
    console.log(`  エラー: ${syncResult.errors.length}件`);

    // 4. セットデータの確認
    console.log('\n🔍 セットデータの確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📊 総チャンク数: ${finalChunks.length}`);

    // ページIDごとのチャンク数を確認
    const chunksByPageId = new Map<number, any[]>();
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId.has(pageId)) {
        chunksByPageId.set(pageId, []);
      }
      chunksByPageId.get(pageId)!.push(chunk);
    });

    console.log(`\n📊 ページIDごとのチャンク数:`);
    let totalPages = 0;
    let totalChunks = 0;
    let duplicatePages = 0;

    for (const [pageId, chunks] of chunksByPageId) {
      totalPages++;
      totalChunks += chunks.length;
      
      // チャンクを枝番順にソート
      chunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      
      console.log(`  PageID ${pageId}: ${chunks.length}チャンク`);
      
      // 重複チェック
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages++;
        console.log(`    ⚠️ 重複チャンクあり`);
      } else {
        console.log(`    ✅ 正常なセット`);
      }
      
      // 各チャンクの詳細
      chunks.forEach((chunk: any, index: number) => {
        console.log(`      チャンク ${index}: 枝番=${chunk.chunkIndex}, 長さ=${chunk.content?.length || 0}文字`);
      });
    }

    // 5. 重複統計
    console.log(`\n📊 重複統計:`);
    console.log(`  総ページ数: ${totalPages}`);
    console.log(`  総チャンク数: ${totalChunks}`);
    console.log(`  重複ページ数: ${duplicatePages}`);
    console.log(`  正常ページ数: ${totalPages - duplicatePages}`);

    // 6. ハイブリッド検索のテスト
    console.log('\n🔍 ハイブリッド検索のテスト...');
    const searchResults = await searchEngine.search({ 
      query: '機能 要件 システム', 
      topK: 5 
    });
    
    console.log(`📊 検索結果: ${searchResults.length}件`);
    searchResults.slice(0, 3).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     PageID: ${result.pageId}, スコア: ${result.score}`);
    });

    // 7. 2回目の同期テスト（差分同期の確認）
    console.log('\n🔄 2回目の同期テスト（差分同期の確認）...');
    const syncResult2 = await confluenceSyncService.syncPages(testPages);
    
    console.log(`\n📈 2回目同期結果:`);
    console.log(`  追加: ${syncResult2.added}ページ`);
    console.log(`  更新: ${syncResult2.updated}ページ`);
    console.log(`  変更なし: ${syncResult2.unchanged}ページ`);
    console.log(`  除外: ${syncResult2.excluded}ページ`);
    console.log(`  エラー: ${syncResult2.errors.length}件`);

    // 8. 最終確認
    const finalChunks2 = await table.search(dummyVector).limit(10000).toArray();
    console.log(`\n📊 最終チャンク数: ${finalChunks2.length}`);

    // 9. セット管理の評価
    console.log('\n🎯 セット管理の評価:');
    console.log('=' .repeat(50));
    
    const isCorrectInitialSync = syncResult.added === testPages.length;
    const isCorrectSecondSync = syncResult2.unchanged === testPages.length;
    const isNoDuplicates = duplicatePages === 0;
    const isSearchWorking = searchResults.length > 0;
    const isCorrectChunkCount = finalChunks2.length > 0;
    
    console.log(`✅ 初期同期（全ページ追加）: ${isCorrectInitialSync ? 'Yes' : 'No'}`);
    console.log(`✅ 2回目同期（変更なし）: ${isCorrectSecondSync ? 'Yes' : 'No'}`);
    console.log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'}`);
    console.log(`✅ 検索機能: ${isSearchWorking ? 'Yes' : 'No'}`);
    console.log(`✅ チャンク数正常: ${isCorrectChunkCount ? 'Yes' : 'No'}`);
    
    const overallScore = (isCorrectInitialSync ? 1 : 0) + (isCorrectSecondSync ? 1 : 0) + 
                        (isNoDuplicates ? 1 : 0) + (isSearchWorking ? 1 : 0) + 
                        (isCorrectChunkCount ? 1 : 0);
    
    console.log(`\n🏆 総合スコア: ${overallScore}/5`);
    
    if (overallScore >= 4) {
      console.log(`🎉 セットデータ管理は正常に動作しています！`);
    } else if (overallScore >= 3) {
      console.log(`👍 セットデータ管理は概ね正常に動作しています。`);
    } else {
      console.log(`⚠️ セットデータ管理に問題があります。`);
    }

    console.log('\n✅ セットデータ管理のテスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testSetManagementWithMorePages().catch(console.error);
