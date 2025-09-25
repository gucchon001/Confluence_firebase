/**
 * 修正されたロジックで200ページのテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-200pages-fixed-logic.txt', message + '\n');
}

async function test200PagesFixedLogic() {
  // 結果ファイルをクリア
  fs.writeFileSync('test-200pages-fixed-logic.txt', '');
  
  log('🚀 修正されたロジックで200ページのテスト...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 200ページを並列バッチ取得
    log('📄 200ページを並列バッチ取得中...');
    const startTime = Date.now();
    
    const pages = await confluenceSyncService.getConfluencePagesBatch(200, 50);
    
    const fetchTime = Date.now() - startTime;
    log(`📊 取得完了: ${pages.length}ページ (${fetchTime}ms)`);
    log(`📊 パフォーマンス: ${Math.round(pages.length / fetchTime * 1000)}ページ/秒`);
    
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

    log(`\n📊 ページ分類:`);
    log(`  有効ページ: ${validPages.length}ページ`);
    log(`  除外ページ: ${excludedPages.length}ページ`);

    if (validPages.length === 0) {
      log('❌ 有効なページが見つかりませんでした');
      return;
    }

    // 3. 並列同期を実行
    log(`\n🔄 ${validPages.length}ページの並列同期を開始...`);
    const syncStartTime = Date.now();
    
    const syncResult = await confluenceSyncService.syncPagesParallel(validPages, 20);
    
    const syncTime = Date.now() - syncStartTime;
    log(`📊 同期完了: ${syncTime}ms`);
    log(`📊 パフォーマンス: ${Math.round(validPages.length / syncTime * 1000)}ページ/秒`);
    
    log(`\n📈 同期結果:`);
    log(`  追加: ${syncResult.added}ページ`);
    log(`  更新: ${syncResult.updated}ページ`);
    log(`  変更なし: ${syncResult.unchanged}ページ`);
    log(`  除外: ${syncResult.excluded}ページ`);
    log(`  エラー: ${syncResult.errors.length}件`);

    // 4. データベースの状態確認
    log('\n🔍 データベースの状態確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${allChunks.length}`);

    // 5. ページIDごとのチャンク数を確認
    const chunksByPageId = new Map<number, any[]>();
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId.has(pageId)) {
        chunksByPageId.set(pageId, []);
      }
      chunksByPageId.get(pageId)!.push(chunk);
    });

    log(`\n📊 ページIDごとのチャンク数:`);
    let totalPages = 0;
    let totalChunks = 0;
    let duplicatePages = 0;

    for (const [pageId, chunks] of chunksByPageId) {
      totalPages++;
      totalChunks += chunks.length;
      
      // チャンクを枝番順にソート
      chunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      
      // 重複チェック
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages++;
      }
    }

    // 6. 重複統計
    log(`\n📊 重複統計:`);
    log(`  総ページ数: ${totalPages}`);
    log(`  総チャンク数: ${totalChunks}`);
    log(`  重複ページ数: ${duplicatePages}`);
    log(`  正常ページ数: ${totalPages - duplicatePages}`);
    log(`  平均チャンク数: ${(totalChunks / totalPages).toFixed(2)}`);

    // 7. ハイブリッド検索のテスト
    log('\n🔍 ハイブリッド検索のテスト...');
    const searchStartTime = Date.now();
    
    const searchResults = await searchEngine.search({ 
      query: '機能 要件 システム 管理', 
      topK: 10 
    });
    
    const searchTime = Date.now() - searchStartTime;
    log(`📊 検索完了: ${searchTime}ms`);
    log(`📊 検索結果: ${searchResults.length}件`);
    
    searchResults.slice(0, 5).forEach((result, index) => {
      log(`  ${index + 1}. ${result.title}`);
      log(`     PageID: ${result.pageId}, スコア: ${result.score}`);
    });

    // 8. 2回目の同期テスト（差分同期の確認）
    log('\n🔄 2回目の同期テスト（差分同期の確認）...');
    const sync2StartTime = Date.now();
    
    const syncResult2 = await confluenceSyncService.syncPagesParallel(validPages, 20);
    
    const sync2Time = Date.now() - sync2StartTime;
    log(`📊 2回目同期完了: ${sync2Time}ms`);
    
    log(`\n📈 2回目同期結果:`);
    log(`  追加: ${syncResult2.added}ページ`);
    log(`  更新: ${syncResult2.updated}ページ`);
    log(`  変更なし: ${syncResult2.unchanged}ページ`);
    log(`  除外: ${syncResult2.excluded}ページ`);
    log(`  エラー: ${syncResult2.errors.length}件`);

    // 9. 最終データベース状態
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`\n📊 最終チャンク数: ${finalChunks.length}`);

    // 10. パフォーマンス統計
    const totalTime = Date.now() - startTime;
    log(`\n📊 パフォーマンス統計:`);
    log(`  総実行時間: ${totalTime}ms`);
    log(`  ページ取得時間: ${fetchTime}ms (${Math.round(fetchTime / totalTime * 100)}%)`);
    log(`  1回目同期時間: ${syncTime}ms (${Math.round(syncTime / totalTime * 100)}%)`);
    log(`  2回目同期時間: ${sync2Time}ms (${Math.round(sync2Time / totalTime * 100)}%)`);
    log(`  検索時間: ${searchTime}ms (${Math.round(searchTime / totalTime * 100)}%)`);

    // 11. セット管理の評価
    log('\n🎯 セット管理の評価:');
    log('=' .repeat(50));
    
    const isCorrectInitialSync = syncResult.added > 0;
    const isCorrectSecondSync = syncResult2.unchanged === validPages.length;
    const isNoDuplicates = duplicatePages === 0;
    const isSearchWorking = searchResults.length > 0;
    const isCorrectChunkCount = finalChunks.length > 0;
    
    log(`✅ 初期同期（ページ追加）: ${isCorrectInitialSync ? 'Yes' : 'No'}`);
    log(`✅ 2回目同期（変更なし）: ${isCorrectSecondSync ? 'Yes' : 'No'}`);
    log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'}`);
    log(`✅ 検索機能: ${isSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ チャンク数正常: ${isCorrectChunkCount ? 'Yes' : 'No'}`);
    
    const overallScore = (isCorrectInitialSync ? 1 : 0) + (isCorrectSecondSync ? 1 : 0) + 
                        (isNoDuplicates ? 1 : 0) + (isSearchWorking ? 1 : 0) + 
                        (isCorrectChunkCount ? 1 : 0);
    
    log(`\n🏆 総合スコア: ${overallScore}/5`);
    
    if (overallScore >= 4) {
      log(`🎉 200ページでのセットデータ管理は正常に動作しています！`);
    } else if (overallScore >= 3) {
      log(`👍 200ページでのセットデータ管理は概ね正常に動作しています。`);
    } else {
      log(`⚠️ 200ページでのセットデータ管理に問題があります。`);
    }

    log('\n✅ 200ページテスト完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

test200PagesFixedLogic().catch(console.error);
