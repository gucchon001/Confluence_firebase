/**
 * 現在の重複ファイル状況確認
 * 重複チャンクの存在を詳細に調査
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function checkCurrentDuplicates() {
  console.log('🔍 現在の重複ファイル状況を確認中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    // 1. 現在のLanceDBデータを取得
    console.log('📊 LanceDBデータを取得中...');
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`- 総チャンク数: ${allChunks.length}`);
    
    // 2. ページID別のチャンク数を分析
    console.log('\n📊 ページID別チャンク数分析:');
    const pageIdCounts = new Map();
    const pageIdDetails = new Map();
    
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId.toString();
      
      // カウント
      pageIdCounts.set(pageId, (pageIdCounts.get(pageId) || 0) + 1);
      
      // 詳細情報
      if (!pageIdDetails.has(pageId)) {
        pageIdDetails.set(pageId, {
          pageId,
          title: chunk.title,
          chunkIds: [],
          lastUpdated: chunk.lastUpdated,
          contentLengths: [],
          chunkCount: 0
        });
      }
      
      const details = pageIdDetails.get(pageId);
      details.chunkIds.push(chunk.id);
      details.contentLengths.push(chunk.content?.length || 0);
      details.chunkCount++;
    });
    
    console.log(`- 総ページ数: ${pageIdCounts.size}`);
    
    // 3. 重複ページの特定（10チャンク以上）
    console.log('\n🔍 重複ページの特定:');
    const duplicatePages = Array.from(pageIdCounts.entries())
      .filter(([pageId, count]) => count > 10)
      .sort(([,a], [,b]) => b - a);
    
    console.log(`重複ページ数（10チャンク以上）: ${duplicatePages.length}件`);
    
    if (duplicatePages.length > 0) {
      console.log('\n重複ページの詳細:');
      duplicatePages.forEach(([pageId, count], index) => {
        const details = pageIdDetails.get(pageId);
        console.log(`  ${index + 1}. ページID ${pageId}: ${count}チャンク`);
        console.log(`     - タイトル: ${details.title}`);
        console.log(`     - 最終更新: ${details.lastUpdated}`);
        console.log(`     - コンテンツ長: [${details.contentLengths.slice(0, 5).join(', ')}${details.contentLengths.length > 5 ? '...' : ''}]`);
      });
    }
    
    // 4. 異常な重複の検出（20チャンク以上）
    console.log('\n🚨 異常な重複の検出（20チャンク以上）:');
    const abnormalPages = Array.from(pageIdCounts.entries())
      .filter(([pageId, count]) => count > 20)
      .sort(([,a], [,b]) => b - a);
    
    console.log(`異常な重複ページ数: ${abnormalPages.length}件`);
    
    if (abnormalPages.length > 0) {
      console.log('\n異常な重複ページの詳細:');
      abnormalPages.forEach(([pageId, count], index) => {
        const details = pageIdDetails.get(pageId);
        console.log(`  ${index + 1}. ページID ${pageId}: ${count}チャンク`);
        console.log(`     - タイトル: ${details.title}`);
        console.log(`     - 最終更新: ${details.lastUpdated}`);
        
        // このページのチャンクを詳細確認
        const pageChunks = allChunks.filter((chunk: any) => 
          chunk.pageId.toString() === pageId
        );
        
        // 更新日時別の分析
        const updateTimeGroups = new Map();
        pageChunks.forEach((chunk: any) => {
          const updateTime = chunk.lastUpdated;
          if (!updateTimeGroups.has(updateTime)) {
            updateTimeGroups.set(updateTime, []);
          }
          updateTimeGroups.get(updateTime).push(chunk);
        });
        
        console.log(`     - 更新日時グループ数: ${updateTimeGroups.size}`);
        
        if (updateTimeGroups.size > 1) {
          console.log(`     ⚠️ 複数の更新日時が存在 → 重複の可能性`);
          Array.from(updateTimeGroups.entries()).forEach(([updateTime, chunks]) => {
            console.log(`       - ${updateTime}: ${chunks.length}チャンク`);
          });
        } else {
          console.log(`     ✅ 更新日時は統一されている`);
        }
        
        // チャンクIDの重複チェック
        const chunkIdCounts = new Map();
        pageChunks.forEach((chunk: any) => {
          const chunkId = chunk.id;
          chunkIdCounts.set(chunkId, (chunkIdCounts.get(chunkId) || 0) + 1);
        });
        
        const duplicateChunkIds = Array.from(chunkIdCounts.entries())
          .filter(([,count]) => count > 1);
        
        if (duplicateChunkIds.length > 0) {
          console.log(`     ❌ 重複チャンクID: ${duplicateChunkIds.length}件`);
          duplicateChunkIds.slice(0, 3).forEach(([chunkId, count]) => {
            console.log(`       - ${chunkId}: ${count}個の重複`);
          });
        } else {
          console.log(`     ✅ チャンクIDは重複していません`);
        }
      });
    }
    
    // 5. 重複の原因分析
    console.log('\n💡 重複の原因分析:');
    
    if (abnormalPages.length > 0) {
      console.log('❌ 異常な重複が検出されました');
      console.log('原因として考えられるもの:');
      console.log('1. 同一ページが複数回同期されている');
      console.log('2. チャンク削除処理が不完全');
      console.log('3. ページID型不一致による重複');
      console.log('4. 並列処理での競合状態');
    } else if (duplicatePages.length > 0) {
      console.log('⚠️ 大きなページが正常に分割されている可能性があります');
      console.log('実際のコンテンツ長を確認する必要があります');
    } else {
      console.log('✅ 重複は検出されませんでした');
    }
    
    // 6. 推奨アクション
    console.log('\n🔧 推奨アクション:');
    
    if (abnormalPages.length > 0) {
      console.log('1. 重複チャンクのクリーンアップが必要');
      console.log('2. 同期ロジックの修正が必要');
      console.log('3. 全ページ同期は実行しないことを推奨');
    } else if (duplicatePages.length > 0) {
      console.log('1. 大きなページのコンテンツ長を確認');
      console.log('2. 正常な分割結果の可能性を調査');
      console.log('3. 必要に応じてクリーンアップを実行');
    } else {
      console.log('1. 重複問題はありません');
      console.log('2. 全ページ同期を安全に実行できます');
    }
    
    console.log('\n📊 調査結果サマリー:');
    console.log(`- 総チャンク数: ${allChunks.length}`);
    console.log(`- 総ページ数: ${pageIdCounts.size}`);
    console.log(`- 重複ページ数（10チャンク以上）: ${duplicatePages.length}`);
    console.log(`- 異常な重複ページ数（20チャンク以上）: ${abnormalPages.length}`);
    
    if (abnormalPages.length === 0 && duplicatePages.length === 0) {
      console.log('\n🎉 重複ファイルは作成されていません！');
      return true;
    } else {
      console.log('\n⚠️ 重複ファイルが検出されました');
      return false;
    }

  } catch (error) {
    console.error('❌ 調査中にエラーが発生しました:', error);
    return false;
  }
}

// 実行
checkCurrentDuplicates().then((noDuplicates) => {
  if (noDuplicates) {
    console.log('\n✅ 現在、重複ファイルは作成されていません');
  } else {
    console.log('\n❌ 現在、重複ファイルが存在します');
  }
}).catch(console.error);
