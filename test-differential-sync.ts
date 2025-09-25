/**
 * 差分同期機能のテスト
 * 1. 新規ページの追加
 * 2. 既存ページの更新（日時比較）
 * 3. 重複ファイルの防止
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

function log(message: string) {
  console.log(message);
}

async function testDifferentialSync() {
  log('🧪 差分同期機能のテストを開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 既存データの削除
    log('🗑️ 既存データを削除中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const existingChunks = await table.search(dummyVector).limit(10000).toArray();
    
    if (existingChunks.length > 0) {
      const idsToDelete = existingChunks.map((chunk: any) => chunk.id);
      await table.delete(`id IN (${idsToDelete.map(id => `'${id}'`).join(', ')})`);
      log(`✅ ${existingChunks.length}チャンクを削除しました`);
    } else {
      log('✅ 削除するデータはありません');
    }
    
    // 2. 初回同期（5ページ）
    log('\n📥 初回同期（5ページ）を実行中...');
    const firstSyncResult = await confluenceSyncService.syncPagesByCount(5);
    
    log(`📊 初回同期結果:`);
    log(`- 追加されたチャンク数: ${firstSyncResult.added}`);
    log(`- 更新されたチャンク数: ${firstSyncResult.updated}`);
    log(`- 変更なしのチャンク数: ${firstSyncResult.unchanged}`);
    log(`- 除外されたチャンク数: ${firstSyncResult.excluded}`);
    log(`- エラー数: ${firstSyncResult.errors.length}`);
    
    // 3. データベースの状態確認
    log('\n📊 初回同期後のデータベース状態...');
    const firstChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${firstChunks.length}`);
    
    // ページID別のチャンク数を確認
    const pageChunkCounts: { [pageId: string]: number } = {};
    firstChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      pageChunkCounts[pageId] = (pageChunkCounts[pageId] || 0) + 1;
    });
    
    log('📄 ページID別チャンク数:');
    Object.entries(pageChunkCounts).forEach(([pageId, count]) => {
      log(`- ページID ${pageId}: ${count}チャンク`);
    });
    
    // 4. 同じページ数で再同期（差分テスト）
    log('\n🔄 同じページ数で再同期（差分テスト）...');
    const secondSyncResult = await confluenceSyncService.syncPagesByCount(5);
    
    log(`📊 再同期結果:`);
    log(`- 追加されたチャンク数: ${secondSyncResult.added}`);
    log(`- 更新されたチャンク数: ${secondSyncResult.updated}`);
    log(`- 変更なしのチャンク数: ${secondSyncResult.unchanged}`);
    log(`- 除外されたチャンク数: ${secondSyncResult.excluded}`);
    log(`- エラー数: ${secondSyncResult.errors.length}`);
    
    // 5. 再同期後のデータベース状態確認
    log('\n📊 再同期後のデータベース状態...');
    const secondChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${secondChunks.length}`);
    
    // ページID別のチャンク数を再確認
    const secondPageChunkCounts: { [pageId: string]: number } = {};
    secondChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      secondPageChunkCounts[pageId] = (secondPageChunkCounts[pageId] || 0) + 1;
    });
    
    log('📄 再同期後のページID別チャンク数:');
    Object.entries(secondPageChunkCounts).forEach(([pageId, count]) => {
      log(`- ページID ${pageId}: ${count}チャンク`);
    });
    
    // 6. 重複チェック
    log('\n🔍 重複チェック...');
    const duplicateCheck: { [pageId: string]: { [chunkIndex: string]: number } } = {};
    secondChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      const chunkIndex = chunk.chunkIndex.toString();
      
      if (!duplicateCheck[pageId]) {
        duplicateCheck[pageId] = {};
      }
      duplicateCheck[pageId][chunkIndex] = (duplicateCheck[pageId][chunkIndex] || 0) + 1;
    });
    
    let hasDuplicates = false;
    Object.entries(duplicateCheck).forEach(([pageId, chunkIndices]) => {
      Object.entries(chunkIndices).forEach(([chunkIndex, count]) => {
        if (count > 1) {
          log(`❌ 重複発見: ページID ${pageId}, チャンクインデックス ${chunkIndex} が ${count} 個存在`);
          hasDuplicates = true;
        }
      });
    });
    
    if (!hasDuplicates) {
      log('✅ 重複は見つかりませんでした');
    }
    
    // 7. 差分同期の評価
    log('\n🎯 差分同期の評価:');
    
    if (secondSyncResult.added === 0) {
      log('✅ 新規追加: 正しく0件（既存ページは追加されていない）');
    } else {
      log(`❌ 新規追加: ${secondSyncResult.added}件（期待値: 0件）`);
    }
    
    if (secondSyncResult.updated === 0) {
      log('✅ 更新: 正しく0件（日時が同じため更新されていない）');
    } else {
      log(`❌ 更新: ${secondSyncResult.updated}件（期待値: 0件）`);
    }
    
    if (secondSyncResult.unchanged > 0) {
      log(`✅ 変更なし: ${secondSyncResult.unchanged}件（正しく日時比較が動作）`);
    } else {
      log('❌ 変更なし: 0件（日時比較が正しく動作していない可能性）');
    }
    
    if (firstChunks.length === secondChunks.length) {
      log('✅ チャンク数: 初回と再同期で同じ（重複なし）');
    } else {
      log(`❌ チャンク数: 初回 ${firstChunks.length} → 再同期 ${secondChunks.length}（重複の可能性）`);
    }
    
    // 8. 詳細なチャンク情報
    log('\n📄 詳細なチャンク情報（最初の3チャンク）:');
    secondChunks.slice(0, 3).forEach((chunk: any, index: number) => {
      log(`\nチャンク ${index + 1}:`);
      log(`- ID: ${chunk.id}`);
      log(`- ページID: ${chunk.pageId}`);
      log(`- チャンクインデックス: ${chunk.chunkIndex}`);
      log(`- タイトル: ${chunk.title}`);
      log(`- 最終更新: ${chunk.lastUpdated}`);
      log(`- コンテンツ長: ${chunk.content?.length || 0}文字`);
    });
    
    log('\n✅ 差分同期機能のテスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testDifferentialSync().catch(console.error);
