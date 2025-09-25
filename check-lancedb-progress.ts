/**
 * LanceDBの進捗状況確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function checkLanceDBProgress() {
  console.log('📊 LanceDBの進捗状況を確認中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    console.log(`📊 現在のデータベース状態:`);
    console.log(`- 総チャンク数: ${allChunks.length}`);
    
    if (allChunks.length > 0) {
      // ページID別のチャンク数を確認
      const pageChunkCounts: { [pageId: string]: number } = {};
      allChunks.forEach((chunk: any) => {
        const pageId = chunk.pageId.toString();
        pageChunkCounts[pageId] = (pageChunkCounts[pageId] || 0) + 1;
      });
      
      console.log(`- ページ数: ${Object.keys(pageChunkCounts).length}`);
      console.log(`- 平均チャンク数/ページ: ${(allChunks.length / Object.keys(pageChunkCounts).length).toFixed(2)}`);
      
      // ページID別の詳細
      console.log('\n📄 ページID別チャンク数:');
      Object.entries(pageChunkCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([pageId, count]) => {
          console.log(`- ページID ${pageId}: ${count}チャンク`);
        });
      
      if (Object.keys(pageChunkCounts).length > 10) {
        console.log(`... 他 ${Object.keys(pageChunkCounts).length - 10} ページ`);
      }
      
      // ラベルの統計
      let labeledChunks = 0;
      let arrayFromSuccess = 0;
      const labelTypes: { [key: string]: number } = {};
      
      allChunks.forEach((chunk: any) => {
        try {
          const labelsArray = Array.from(chunk.labels);
          arrayFromSuccess++;
          if (labelsArray.length > 0) {
            labeledChunks++;
            labelsArray.forEach((label: string) => {
              labelTypes[label] = (labelTypes[label] || 0) + 1;
            });
          }
        } catch (e) {
          // エラーは無視
        }
      });
      
      console.log('\n🏷️ ラベル統計:');
      console.log(`- Array.from成功: ${arrayFromSuccess}/${allChunks.length} (${(arrayFromSuccess / allChunks.length * 100).toFixed(1)}%)`);
      console.log(`- ラベル付きチャンク: ${labeledChunks} (${(labeledChunks / allChunks.length * 100).toFixed(1)}%)`);
      console.log(`- ラベル種類: ${Object.keys(labelTypes).length}種類`);
      
      if (Object.keys(labelTypes).length > 0) {
        console.log('\n📊 ラベル種類別チャンク数:');
        Object.entries(labelTypes)
          .sort(([,a], [,b]) => b - a)
          .forEach(([label, count]) => {
            console.log(`- ${label}: ${count}チャンク`);
          });
      }
      
      // 重複チェック
      console.log('\n🔍 重複チェック...');
      const duplicateCheck: { [pageId: string]: { [chunkIndex: string]: number } } = {};
      allChunks.forEach((chunk: any) => {
        const pageId = chunk.pageId.toString();
        const chunkIndex = chunk.chunkIndex.toString();
        
        if (!duplicateCheck[pageId]) {
          duplicateCheck[pageId] = {};
        }
        duplicateCheck[pageId][chunkIndex] = (duplicateCheck[pageId][chunkIndex] || 0) + 1;
      });
      
      let hasDuplicates = false;
      let duplicateCount = 0;
      Object.entries(duplicateCheck).forEach(([pageId, chunkIndices]) => {
        Object.entries(chunkIndices).forEach(([chunkIndex, count]) => {
          if (count > 1) {
            hasDuplicates = true;
            duplicateCount += count - 1;
          }
        });
      });
      
      if (!hasDuplicates) {
        console.log('✅ 重複は見つかりませんでした');
      } else {
        console.log(`❌ 重複が ${duplicateCount} 個見つかりました`);
      }
      
      // サンプルチャンクの表示
      console.log('\n📄 サンプルチャンク（最初の3チャンク）:');
      allChunks.slice(0, 3).forEach((chunk: any, index: number) => {
        console.log(`\nチャンク ${index + 1}:`);
        console.log(`- ID: ${chunk.id}`);
        console.log(`- ページID: ${chunk.pageId}`);
        console.log(`- チャンクインデックス: ${chunk.chunkIndex}`);
        console.log(`- タイトル: ${chunk.title}`);
        console.log(`- ラベル: [${Array.from(chunk.labels).join(', ')}]`);
        console.log(`- 最終更新: ${chunk.lastUpdated}`);
        console.log(`- コンテンツ長: ${chunk.content?.length || 0}文字`);
      });
      
    } else {
      console.log('📊 データベースは空です');
    }
    
    console.log('\n✅ LanceDBの進捗状況確認完了');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkLanceDBProgress().catch(console.error);
