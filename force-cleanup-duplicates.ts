/**
 * 強制的な重複チャンククリーンアップ
 * より確実に重複を削除する
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';

async function forceCleanupDuplicates() {
  console.log('🧹 強制的な重複チャンククリーンアップを開始...\n');

  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    const table = await lancedbClient.getTable();

    // 1. 全チャンクを取得
    console.log('📊 全チャンクを取得中...');
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📄 全チャンク数: ${allChunks.length}`);

    // 2. ページIDごとにグループ化
    const chunksByPageId = new Map<number, any[]>();
    
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId.has(pageId)) {
        chunksByPageId.set(pageId, []);
      }
      chunksByPageId.get(pageId)!.push(chunk);
    });

    console.log(`📊 ユニークページ数: ${chunksByPageId.size}`);

    // 3. 重複チャンクを特定
    let duplicatePages = 0;
    let totalDuplicates = 0;
    const pagesToCleanup = [];

    for (const [pageId, chunks] of chunksByPageId) {
      if (chunks.length > 1) {
        duplicatePages++;
        totalDuplicates += chunks.length - 1;
        
        // 最新のチャンクを特定（lastUpdatedが最新のもの）
        const sortedChunks = chunks.sort((a, b) => 
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
        );
        
        const latestChunk = sortedChunks[0];
        const duplicates = sortedChunks.slice(1);
        
        pagesToCleanup.push({
          pageId,
          latestChunk,
          duplicates,
          totalChunks: chunks.length
        });
      }
    }

    console.log(`\n📊 重複統計:`);
    console.log(`  重複ページ数: ${duplicatePages}`);
    console.log(`  重複チャンク数: ${totalDuplicates}`);

    if (pagesToCleanup.length === 0) {
      console.log('✅ 重複チャンクはありません');
      return;
    }

    // 4. より強力な削除方法を試行
    console.log('\n🗑️ 強制的な重複チャンク削除を実行中...');
    let deletedCount = 0;
    let failedDeletions = 0;

    for (const pageInfo of pagesToCleanup) {
      console.log(`\n🧹 ページID ${pageInfo.pageId} の重複チャンクを強制削除中...`);
      
      for (const duplicate of pageInfo.duplicates) {
        try {
          // 複数の削除方法を試行
          let deleted = false;
          
          // 方法1: IDで削除
          try {
            await table.delete(`"id" = '${duplicate.id}'`);
            deleted = true;
            console.log(`  ✅ ID削除成功: ${duplicate.id}`);
          } catch (error) {
            console.log(`  ⚠️ ID削除失敗: ${duplicate.id} - ${error}`);
          }
          
          // 方法2: pageId + lastUpdatedで削除
          if (!deleted) {
            try {
              await table.delete(`"pageId" = ${duplicate.pageId} AND "lastUpdated" = '${duplicate.lastUpdated}'`);
              deleted = true;
              console.log(`  ✅ 条件削除成功: ${duplicate.id}`);
            } catch (error) {
              console.log(`  ⚠️ 条件削除失敗: ${duplicate.id} - ${error}`);
            }
          }
          
          // 方法3: より具体的な条件で削除
          if (!deleted) {
            try {
              await table.delete(`"pageId" = ${duplicate.pageId} AND "chunkIndex" = ${duplicate.chunkIndex} AND "lastUpdated" = '${duplicate.lastUpdated}'`);
              deleted = true;
              console.log(`  ✅ 詳細条件削除成功: ${duplicate.id}`);
            } catch (error) {
              console.log(`  ⚠️ 詳細条件削除失敗: ${duplicate.id} - ${error}`);
            }
          }
          
          if (deleted) {
            deletedCount++;
          } else {
            failedDeletions++;
            console.log(`  ❌ 全削除方法失敗: ${duplicate.id}`);
          }
          
        } catch (error) {
          failedDeletions++;
          console.error(`  ❌ 削除エラー: ${duplicate.id} - ${error}`);
        }
      }
    }

    console.log(`\n📊 強制削除結果:`);
    console.log(`  削除成功: ${deletedCount}チャンク`);
    console.log(`  削除失敗: ${failedDeletions}チャンク`);
    console.log(`  処理したページ数: ${pagesToCleanup.length}`);

    // 5. 削除後の確認
    console.log('\n🔍 削除後の確認...');
    const remainingChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📄 残存チャンク数: ${remainingChunks.length}`);

    // ページIDごとのチャンク数を再確認
    const remainingChunksByPageId = new Map<number, any[]>();
    remainingChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!remainingChunksByPageId.has(pageId)) {
        remainingChunksByPageId.set(pageId, []);
      }
      remainingChunksByPageId.get(pageId)!.push(chunk);
    });

    let stillDuplicatePages = 0;
    let stillDuplicateChunks = 0;
    
    for (const [pageId, chunks] of remainingChunksByPageId) {
      if (chunks.length > 1) {
        stillDuplicatePages++;
        stillDuplicateChunks += chunks.length - 1;
        console.log(`⚠️ ページID ${pageId} はまだ ${chunks.length} チャンクあります`);
      }
    }

    console.log(`\n📊 最終結果:`);
    console.log(`  残存重複ページ数: ${stillDuplicatePages}`);
    console.log(`  残存重複チャンク数: ${stillDuplicateChunks}`);
    console.log(`  削除率: ${Math.round((totalDuplicates - stillDuplicateChunks) / totalDuplicates * 100)}%`);

    if (stillDuplicatePages === 0) {
      console.log('✅ すべての重複チャンクが削除されました');
    } else {
      console.log(`⚠️ ${stillDuplicatePages}ページにまだ重複があります`);
      
      // 6. 残存重複の詳細分析
      console.log('\n🔍 残存重複の詳細分析:');
      for (const [pageId, chunks] of remainingChunksByPageId) {
        if (chunks.length > 1) {
          console.log(`\n📄 ページID ${pageId} (${chunks.length}チャンク):`);
          chunks.forEach((chunk, index) => {
            console.log(`  ${index + 1}. ID: ${chunk.id}`);
            console.log(`     LastUpdated: ${chunk.lastUpdated}`);
            console.log(`     ChunkIndex: ${chunk.chunkIndex}`);
            console.log(`     Title: ${chunk.title.substring(0, 50)}...`);
          });
        }
      }
    }

    console.log('\n✅ 強制的な重複チャンククリーンアップ完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

forceCleanupDuplicates().catch(console.error);
