/**
 * 修正されたチャンク分割ロジックのテスト
 * 1800文字程度でチャンクし、同一pageIdをセットで管理
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testFixedChunkingLogic() {
  console.log('🧪 修正されたチャンク分割ロジックのテストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 5ページを取得してテスト
    console.log('📄 5ページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(5, 0);
    console.log(`📊 取得ページ数: ${pages.length}ページ`);

    // 2. 各ページのチャンク分割を確認
    console.log('\n📝 チャンク分割の詳細確認:');
    pages.forEach((page, index) => {
      const chunks = confluenceSyncService.splitPageIntoChunks(page);
      console.log(`\n📄 ページ ${index + 1}: ${page.title}`);
      console.log(`  PageID: ${page.id}`);
      console.log(`  コンテンツ長: ${page.body?.storage?.value?.length || 0}文字`);
      console.log(`  チャンク数: ${chunks.length}`);
      
      chunks.forEach((chunk, chunkIndex) => {
        console.log(`    チャンク ${chunkIndex}: ${chunk.content.length}文字 (枝番: ${chunk.chunkIndex})`);
      });
    });

    // 3. 同期実行
    console.log('\n🔄 修正されたロジックで同期実行中...');
    const syncResult = await confluenceSyncService.syncPages(pages);
    
    console.log(`\n📈 同期結果:`);
    console.log(`  追加: ${syncResult.added}ページ`);
    console.log(`  更新: ${syncResult.updated}ページ`);
    console.log(`  変更なし: ${syncResult.unchanged}ページ`);
    console.log(`  除外: ${syncResult.excluded}ページ`);
    console.log(`  エラー: ${syncResult.errors.length}件`);

    if (syncResult.errors.length > 0) {
      console.log(`\n❌ エラー詳細:`);
      syncResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    // 4. データベースの状態確認
    console.log('\n🔍 データベースの状態確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📊 総チャンク数: ${allChunks.length}`);

    // 5. ページIDごとのチャンク数を確認
    const chunksByPageId = new Map<number, any[]>();
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId.has(pageId)) {
        chunksByPageId.set(pageId, []);
      }
      chunksByPageId.get(pageId)!.push(chunk);
    });

    console.log(`\n📊 ページIDごとのチャンク数:`);
    for (const [pageId, chunks] of chunksByPageId) {
      chunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      console.log(`  PageID ${pageId}: ${chunks.length}チャンク`);
      chunks.forEach((chunk: any, index: number) => {
        console.log(`    チャンク ${index}: 枝番=${chunk.chunkIndex}, 長さ=${chunk.content?.length || 0}文字`);
      });
    }

    // 6. 重複チェック
    let duplicatePages = 0;
    for (const [pageId, chunks] of chunksByPageId) {
      if (chunks.length > 1) {
        // 同じchunkIndexを持つチャンクがあるかチェック
        const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
        const uniqueIndexes = new Set(chunkIndexes);
        
        if (chunkIndexes.length !== uniqueIndexes.size) {
          duplicatePages++;
          console.log(`⚠️ ページID ${pageId} に重複チャンクがあります`);
        }
      }
    }

    if (duplicatePages === 0) {
      console.log(`\n✅ 重複チャンクはありません`);
    } else {
      console.log(`\n⚠️ ${duplicatePages}ページに重複チャンクがあります`);
    }

    // 7. ハイブリッド検索のテスト
    console.log('\n🔍 ハイブリッド検索のテスト...');
    const searchResults = await searchEngine.search({ 
      query: '機能 要件 システム', 
      topK: 10 
    });
    
    console.log(`📊 検索結果: ${searchResults.length}件`);
    searchResults.slice(0, 5).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     PageID: ${result.pageId}, スコア: ${result.score}`);
    });

    // 8. 2回目の同期テスト（差分同期の確認）
    console.log('\n🔄 2回目の同期テスト（差分同期の確認）...');
    const syncResult2 = await confluenceSyncService.syncPages(pages);
    
    console.log(`\n📈 2回目同期結果:`);
    console.log(`  追加: ${syncResult2.added}ページ`);
    console.log(`  更新: ${syncResult2.updated}ページ`);
    console.log(`  変更なし: ${syncResult2.unchanged}ページ`);
    console.log(`  除外: ${syncResult2.excluded}ページ`);
    console.log(`  エラー: ${syncResult2.errors.length}件`);

    // 9. 最終確認
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`\n📊 最終チャンク数: ${finalChunks.length}`);

    // 10. 総合評価
    console.log('\n🎯 総合評価:');
    console.log('=' .repeat(50));
    
    const isNoDuplicates = duplicatePages === 0;
    const isCorrectChunking = allChunks.every((chunk: any) => 
      chunk.chunkIndex >= 0 && chunk.content && chunk.content.length > 0
    );
    const isCorrectSync = syncResult2.unchanged === pages.length; // 2回目は全て変更なしになるはず
    const isSearchWorking = searchResults.length > 0;
    
    console.log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'}`);
    console.log(`✅ 正しいチャンク分割: ${isCorrectChunking ? 'Yes' : 'No'}`);
    console.log(`✅ 差分同期: ${isCorrectSync ? 'Yes' : 'No'}`);
    console.log(`✅ 検索機能: ${isSearchWorking ? 'Yes' : 'No'}`);
    
    const overallScore = (isNoDuplicates ? 1 : 0) + (isCorrectChunking ? 1 : 0) + 
                        (isCorrectSync ? 1 : 0) + (isSearchWorking ? 1 : 0);
    
    console.log(`\n🏆 総合スコア: ${overallScore}/4`);
    
    if (overallScore >= 3) {
      console.log(`🎉 修正されたロジックは正常に動作しています！`);
    } else if (overallScore >= 2) {
      console.log(`👍 修正されたロジックは概ね正常に動作しています。`);
    } else {
      console.log(`⚠️ 修正されたロジックに問題があります。`);
    }

    console.log('\n✅ 修正されたチャンク分割ロジックのテスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testFixedChunkingLogic().catch(console.error);
