/**
 * 1ページあたりの平均チャンク数を確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('check-average-chunks-per-page.txt', message + '\n');
}

async function checkAverageChunksPerPage() {
  fs.writeFileSync('check-average-chunks-per-page.txt', '');
  
  log('📊 1ページあたりの平均チャンク数を確認中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. LanceDBに接続
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    // 2. 全チャンクを取得
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`📊 総チャンク数: ${allChunks.length}`);
    
    // 3. ページID別に集計
    const pageIdMap = new Map<number, any[]>();
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!pageIdMap.has(pageId)) {
        pageIdMap.set(pageId, []);
      }
      pageIdMap.get(pageId)!.push(chunk);
    });
    
    log(`📊 ユニークページ数: ${pageIdMap.size}`);
    
    // 4. チャンク数の分布を分析
    const chunkCounts = Array.from(pageIdMap.values()).map(chunks => chunks.length);
    const totalChunks = chunkCounts.reduce((sum, count) => sum + count, 0);
    const averageChunksPerPage = totalChunks / pageIdMap.size;
    
    log(`\n📊 チャンク数統計:`);
    log(`- 総チャンク数: ${totalChunks}`);
    log(`- ユニークページ数: ${pageIdMap.size}`);
    log(`- 平均チャンク数/ページ: ${averageChunksPerPage.toFixed(2)}`);
    
    // 5. チャンク数の分布を詳細分析
    const chunkDistribution = new Map<number, number>();
    chunkCounts.forEach(count => {
      chunkDistribution.set(count, (chunkDistribution.get(count) || 0) + 1);
    });
    
    log(`\n📊 チャンク数分布:`);
    const sortedDistribution = Array.from(chunkDistribution.entries()).sort((a, b) => a[0] - b[0]);
    sortedDistribution.forEach(([chunkCount, pageCount]) => {
      const percentage = (pageCount / pageIdMap.size * 100).toFixed(1);
      log(`  ${chunkCount}チャンク: ${pageCount}ページ (${percentage}%)`);
    });
    
    // 6. 最大・最小チャンク数
    const maxChunks = Math.max(...chunkCounts);
    const minChunks = Math.min(...chunkCounts);
    
    log(`\n📊 チャンク数範囲:`);
    log(`- 最大チャンク数: ${maxChunks}`);
    log(`- 最小チャンク数: ${minChunks}`);
    
    // 7. チャンク数が多いページの詳細
    log(`\n📊 チャンク数が多いページ (上位10件):`);
    const sortedPages = Array.from(pageIdMap.entries()).sort((a, b) => b[1].length - a[1].length);
    sortedPages.slice(0, 10).forEach(([pageId, chunks], index) => {
      const firstChunk = chunks[0];
      log(`${index + 1}. PageID: ${pageId}, チャンク数: ${chunks.length}, タイトル: ${firstChunk.title}`);
    });
    
    // 8. チャンク数の中央値
    const sortedChunkCounts = chunkCounts.sort((a, b) => a - b);
    const median = sortedChunkCounts[Math.floor(sortedChunkCounts.length / 2)];
    
    log(`\n📊 中央値:`);
    log(`- チャンク数の中央値: ${median}`);
    
    // 9. チャンクサイズの分析
    log(`\n📊 チャンクサイズ分析:`);
    const chunkSizes = allChunks.map((chunk: any) => chunk.content?.length || 0);
    const averageChunkSize = chunkSizes.reduce((sum, size) => sum + size, 0) / chunkSizes.length;
    const maxChunkSize = Math.max(...chunkSizes);
    const minChunkSize = Math.min(...chunkSizes);
    
    log(`- 平均チャンクサイズ: ${averageChunkSize.toFixed(0)}文字`);
    log(`- 最大チャンクサイズ: ${maxChunkSize}文字`);
    log(`- 最小チャンクサイズ: ${minChunkSize}文字`);
    
    // 10. チャンクインデックスの分析
    log(`\n📊 チャンクインデックス分析:`);
    const chunkIndexes = allChunks.map((chunk: any) => chunk.chunkIndex || 0);
    const maxChunkIndex = Math.max(...chunkIndexes);
    const minChunkIndex = Math.min(...chunkIndexes);
    
    log(`- 最大チャンクインデックス: ${maxChunkIndex}`);
    log(`- 最小チャンクインデックス: ${minChunkIndex}`);
    
    // 11. 結論
    log(`\n🎯 結論:`);
    log(`✅ 現在の1ページあたりの平均チャンク数: ${averageChunkSize.toFixed(2)}`);
    
    if (averageChunkSize === 1) {
      log(`⚠️ 全てのページが1チャンクのみです`);
      log(`   これは以下の理由が考えられます:`);
      log(`   - ページのコンテンツが短い`);
      log(`   - チャンク分割ロジックが1800文字で分割しているが、ページが短い`);
      log(`   - チャンク分割が正しく動作していない`);
    } else if (averageChunkSize < 2) {
      log(`⚠️ 平均チャンク数が2未満です`);
      log(`   多くのページが1チャンクのみで、長いページの分割が不十分な可能性があります`);
    } else {
      log(`✅ 適切なチャンク分割が行われています`);
    }
    
    log('\n✅ 平均チャンク数確認完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

checkAverageChunksPerPage().catch(console.error);
