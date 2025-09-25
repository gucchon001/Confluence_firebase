/**
 * 重複チャンクのクリーンアップ
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';

async function cleanupDuplicateChunks() {
  console.log('🧹 重複チャンクのクリーンアップを開始...\n');

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
        
        console.log(`📄 ページID ${pageId}: ${chunks.length}チャンク (${duplicates.length}個の重複)`);
        console.log(`  最新: ${latestChunk.lastUpdated}`);
        console.log(`  重複: ${duplicates.map(c => c.lastUpdated).join(', ')}`);
      }
    }

    console.log(`\n📊 重複統計:`);
    console.log(`  重複ページ数: ${duplicatePages}`);
    console.log(`  重複チャンク数: ${totalDuplicates}`);

    if (pagesToCleanup.length === 0) {
      console.log('✅ 重複チャンクはありません');
      return;
    }

    // 4. 重複チャンクを削除
    console.log('\n🗑️ 重複チャンクを削除中...');
    let deletedCount = 0;

    for (const pageInfo of pagesToCleanup) {
      console.log(`\n🧹 ページID ${pageInfo.pageId} の重複チャンクを削除中...`);
      
      for (const duplicate of pageInfo.duplicates) {
        try {
          await table.delete(`"id" = '${duplicate.id}'`);
          deletedCount++;
          console.log(`  ✅ 削除: ${duplicate.id} (${duplicate.lastUpdated})`);
        } catch (error) {
          console.error(`  ❌ 削除失敗: ${duplicate.id} - ${error}`);
        }
      }
    }

    console.log(`\n📊 クリーンアップ結果:`);
    console.log(`  削除したチャンク数: ${deletedCount}`);
    console.log(`  処理したページ数: ${pagesToCleanup.length}`);

    // 5. クリーンアップ後の確認
    console.log('\n🔍 クリーンアップ後の確認...');
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
    for (const [pageId, chunks] of remainingChunksByPageId) {
      if (chunks.length > 1) {
        stillDuplicatePages++;
        console.log(`⚠️ ページID ${pageId} はまだ ${chunks.length} チャンクあります`);
      }
    }

    if (stillDuplicatePages === 0) {
      console.log('✅ すべての重複チャンクが削除されました');
    } else {
      console.log(`⚠️ ${stillDuplicatePages}ページにまだ重複があります`);
    }

    console.log('\n✅ 重複チャンククリーンアップ完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

cleanupDuplicateChunks().catch(console.error);
