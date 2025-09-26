/**
 * 全ページ同期処理（進捗監視付き）
 * 重複チェック、更新スキップ、進捗監視を実装
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function fullSyncWithMonitoring() {
  console.log('🚀 全ページ同期処理を開始します（進捗監視付き）...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    // 1. 同期前の状況確認
    console.log('📊 同期前の状況確認:');
    const dummyVector = new Array(768).fill(0);
    const beforeChunks = await table.search(dummyVector).limit(10000).toArray();
    
    const beforePageIdMap = new Map();
    beforeChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      if (!beforePageIdMap.has(pageId)) {
        beforePageIdMap.set(pageId, 0);
      }
      beforePageIdMap.set(pageId, beforePageIdMap.get(pageId) + 1);
    });
    
    console.log(`- 同期前チャンク数: ${beforeChunks.length}`);
    console.log(`- 同期前ページ数: ${beforePageIdMap.size}`);
    
    // 2. 全ページ取得
    console.log('\n📄 全ページ取得を開始...');
    const startTime = Date.now();
    
    const allPages = await confluenceSyncService.getAllConfluencePages(2000);
    const fetchTime = Date.now() - startTime;
    
    console.log(`✅ 全ページ取得完了: ${allPages.length}ページ (${fetchTime}ms)`);
    
    // 3. ページの分類
    console.log('\n📋 ページの分類:');
    let totalPages = allPages.length;
    let excludedPages = 0;
    let newPages = 0;
    let existingPages = 0;
    
    for (const page of allPages) {
      if (confluenceSyncService.shouldExcludePage(page)) {
        excludedPages++;
      } else {
        const existingChunks = await confluenceSyncService.findExistingChunks(table, page.id);
        if (existingChunks.length === 0) {
          newPages++;
        } else {
          existingPages++;
        }
      }
    }
    
    console.log(`- 総ページ数: ${totalPages}`);
    console.log(`- 除外ページ数: ${excludedPages}`);
    console.log(`- 新規ページ数: ${newPages}`);
    console.log(`- 既存ページ数: ${existingPages}`);
    
    // 4. 同期処理の実行（バッチ処理）
    console.log('\n🔄 同期処理を開始...');
    const syncStartTime = Date.now();
    
    const batchSize = 50; // 50ページずつ処理
    const batches = [];
    for (let i = 0; i < allPages.length; i += batchSize) {
      batches.push(allPages.slice(i, i + batchSize));
    }
    
    console.log(`📦 ${batches.length}バッチに分割して処理します`);
    
    let totalAdded = 0;
    let totalUpdated = 0;
    let totalUnchanged = 0;
    let totalExcluded = 0;
    let totalErrors = 0;
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`\n⚡ バッチ ${batchIndex + 1}/${batches.length} を処理中... (${batch.length}ページ)`);
      
      try {
        const batchResult = await confluenceSyncService.syncPagesParallel(batch, 5); // 並列度5で安全に
        
        totalAdded += batchResult.added;
        totalUpdated += batchResult.updated;
        totalUnchanged += batchResult.unchanged;
        totalExcluded += batchResult.excluded;
        totalErrors += batchResult.errors;
        
        console.log(`✅ バッチ ${batchIndex + 1} 完了:`);
        console.log(`   - 追加: ${batchResult.added}, 更新: ${batchResult.updated}, 変更なし: ${batchResult.unchanged}, 除外: ${batchResult.excluded}, エラー: ${batchResult.errors}`);
        
        // 進捗表示
        const progress = ((batchIndex + 1) / batches.length * 100).toFixed(1);
        console.log(`📊 進捗: ${progress}% (${batchIndex + 1}/${batches.length} バッチ完了)`);
        
        // 中間チェック（重複確認）
        if ((batchIndex + 1) % 10 === 0) {
          console.log(`\n🔍 中間チェック (バッチ ${batchIndex + 1}):`);
          
          const currentChunks = await table.search(dummyVector).limit(10000).toArray();
          const currentPageIdMap = new Map();
          currentChunks.forEach((chunk: any) => {
            const pageId = chunk.pageId.toString();
            currentPageIdMap.set(pageId, (currentPageIdMap.get(pageId) || 0) + 1);
          });
          
          const duplicatePages = Array.from(currentPageIdMap.entries())
            .filter(([,count]) => count > 15) // 15チャンク以上を重複として検出
            .sort(([,a], [,b]) => b - a);
          
          if (duplicatePages.length > 0) {
            console.log(`⚠️ 重複ページが検出されました:`);
            duplicatePages.slice(0, 3).forEach(([pageId, count]) => {
              console.log(`   - ページID ${pageId}: ${count}チャンク`);
            });
            
            // 重複が異常な場合は処理を停止
            const maxChunks = Math.max(...duplicatePages.map(([,count]) => count));
            if (maxChunks > 50) {
              console.log(`❌ 異常な重複が検出されました (最大${maxChunks}チャンク)`);
              console.log(`🛑 処理を停止します`);
              return;
            }
          } else {
            console.log(`✅ 重複は検出されませんでした`);
          }
          
          console.log(`📊 現在の状況: ${currentChunks.length}チャンク, ${currentPageIdMap.size}ページ`);
        }
        
        // バッチ間の待機（API制限回避）
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`❌ バッチ ${batchIndex + 1} でエラーが発生しました:`, error);
        totalErrors += batch.length;
      }
    }
    
    const syncTime = Date.now() - syncStartTime;
    
    // 5. 同期完了後の確認
    console.log('\n📊 同期完了後の確認:');
    
    const afterChunks = await table.search(dummyVector).limit(10000).toArray();
    const afterPageIdMap = new Map();
    afterChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      if (!afterPageIdMap.has(pageId)) {
        afterPageIdMap.set(pageId, 0);
      }
      afterPageIdMap.set(pageId, afterPageIdMap.get(pageId) + 1);
    });
    
    console.log(`- 同期後チャンク数: ${afterChunks.length}`);
    console.log(`- 同期後ページ数: ${afterPageIdMap.size}`);
    console.log(`- チャンク増加数: ${afterChunks.length - beforeChunks.length}`);
    console.log(`- ページ増加数: ${afterPageIdMap.size - beforePageIdMap.size}`);
    
    // 6. 最終結果サマリー
    console.log('\n🎉 全ページ同期完了！');
    console.log('=' * 60);
    console.log(`📊 処理結果:`);
    console.log(`- 総ページ数: ${totalPages}`);
    console.log(`- 追加: ${totalAdded}ページ`);
    console.log(`- 更新: ${totalUpdated}ページ`);
    console.log(`- 変更なし: ${totalUnchanged}ページ`);
    console.log(`- 除外: ${totalExcluded}ページ`);
    console.log(`- エラー: ${totalErrors}ページ`);
    console.log('');
    console.log(`⏱️ 処理時間:`);
    console.log(`- ページ取得: ${fetchTime}ms`);
    console.log(`- 同期処理: ${syncTime}ms`);
    console.log(`- 合計時間: ${Date.now() - startTime}ms`);
    console.log('');
    console.log(`📈 最終統計:`);
    console.log(`- 総チャンク数: ${afterChunks.length}`);
    console.log(`- 総ページ数: ${afterPageIdMap.size}`);
    
    // 7. 重複チェック（最終確認）
    console.log('\n🔍 最終重複チェック:');
    const finalDuplicatePages = Array.from(afterPageIdMap.entries())
      .filter(([,count]) => count > 15)
      .sort(([,a], [,b]) => b - a);
    
    if (finalDuplicatePages.length > 0) {
      console.log(`⚠️ 重複ページが検出されました:`);
      finalDuplicatePages.slice(0, 5).forEach(([pageId, count]) => {
        console.log(`   - ページID ${pageId}: ${count}チャンク`);
      });
    } else {
      console.log(`✅ 重複ページは検出されませんでした`);
    }
    
    console.log('\n✅ 全ページ同期処理が正常に完了しました！');

  } catch (error) {
    console.error('❌ 同期処理中にエラーが発生しました:', error);
  }
}

// 実行
fullSyncWithMonitoring().catch(console.error);
