/**
 * 現在のLanceDBの状況を詳しく調査
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('debug-current-state.txt', message + '\n');
}

async function debugCurrentState() {
  fs.writeFileSync('debug-current-state.txt', '');
  
  log('🔍 現在のLanceDBの状況を詳しく調査中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. LanceDBに接続
    log('📊 LanceDBに接続中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    
    // 2. 全データを取得
    log('📊 全データを取得中...');
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`- 総チャンク数: ${allChunks.length}`);
    
    if (allChunks.length === 0) {
      log('✅ データベースは空です');
      return;
    }
    
    // 3. ページID別に分析
    log('\n📊 ページID別分析:');
    const pageIdGroups = allChunks.reduce((groups: any, chunk: any) => {
      const pageId = chunk.pageId;
      if (!groups[pageId]) {
        groups[pageId] = [];
      }
      groups[pageId].push(chunk);
      return groups;
    }, {});
    
    const pageIds = Object.keys(pageIdGroups);
    log(`- ユニークなページ数: ${pageIds.length}`);
    
    // 4. 各ページの詳細を分析
    for (const pageId of pageIds.slice(0, 5)) { // 最初の5ページを分析
      const chunks = pageIdGroups[pageId];
      log(`\n📄 ページID ${pageId}:`);
      log(`  - チャンク数: ${chunks.length}`);
      log(`  - タイトル: ${chunks[0].title}`);
      log(`  - スペース: ${chunks[0].space_key}`);
      log(`  - 最終更新: ${chunks[0].lastUpdated}`);
      
      // チャンクサイズの分析
      const chunkSizes = chunks.map((chunk: any) => chunk.content?.length || 0);
      log(`  - チャンクサイズ: ${chunkSizes.join(', ')}文字`);
      log(`  - 平均サイズ: ${Math.round(chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length)}文字`);
      
      // チャンクインデックスの分析
      const chunkIndexes = chunks.map((chunk: any) => chunk.chunkIndex);
      log(`  - チャンクインデックス: ${chunkIndexes.join(', ')}`);
      
      // 重複チェック
      const uniqueIndexes = new Set(chunkIndexes);
      if (uniqueIndexes.size !== chunkIndexes.length) {
        log(`  ⚠️ 重複するチャンクインデックスが存在します`);
      }
      
      // コンテンツのプレビュー
      if (chunks[0].content && chunks[0].content.length > 0) {
        log(`  - コンテンツプレビュー: "${chunks[0].content.substring(0, 100)}..."`);
      }
    }
    
    // 5. 全体の統計
    log('\n📊 全体統計:');
    const allChunkSizes = allChunks.map((chunk: any) => chunk.content?.length || 0);
    const allChunkIndexes = allChunks.map((chunk: any) => chunk.chunkIndex);
    
    log(`- 平均チャンクサイズ: ${Math.round(allChunkSizes.reduce((a, b) => a + b, 0) / allChunkSizes.length)}文字`);
    log(`- 最小チャンクサイズ: ${Math.min(...allChunkSizes)}文字`);
    log(`- 最大チャンクサイズ: ${Math.max(...allChunkSizes)}文字`);
    
    // チャンクサイズの分布
    const sizeRanges = {
      '0-100': 0,
      '101-500': 0,
      '501-1000': 0,
      '1001-1500': 0,
      '1501-2000': 0,
      '2000+': 0
    };
    
    allChunkSizes.forEach(size => {
      if (size <= 100) sizeRanges['0-100']++;
      else if (size <= 500) sizeRanges['101-500']++;
      else if (size <= 1000) sizeRanges['501-1000']++;
      else if (size <= 1500) sizeRanges['1001-1500']++;
      else if (size <= 2000) sizeRanges['1501-2000']++;
      else sizeRanges['2000+']++;
    });
    
    log('\n📊 チャンクサイズ分布:');
    Object.entries(sizeRanges).forEach(([range, count]) => {
      log(`  - ${range}文字: ${count}チャンク`);
    });
    
    // 6. 問題の特定
    log('\n🔍 問題の特定:');
    
    // 小さなチャンクが多い場合
    const smallChunks = allChunkSizes.filter(size => size < 1000).length;
    if (smallChunks > allChunks.length * 0.5) {
      log(`⚠️ 小さなチャンクが多すぎます (${smallChunks}/${allChunks.length})`);
      log(`   チャンク分割ロジックに問題がある可能性があります`);
    }
    
    // 重複チャンクのチェック
    const duplicateChunks = allChunks.filter((chunk: any, index: number) => {
      return allChunks.findIndex((other: any) => 
        other.pageId === chunk.pageId && 
        other.chunkIndex === chunk.chunkIndex && 
        other.content === chunk.content
      ) !== index;
    });
    
    if (duplicateChunks.length > 0) {
      log(`⚠️ 重複チャンクが ${duplicateChunks.length} 個見つかりました`);
    }
    
    // 7. 推奨アクション
    log('\n💡 推奨アクション:');
    if (smallChunks > allChunks.length * 0.5) {
      log('1. チャンク分割ロジックを修正する');
      log('2. 既存データを削除して再同期する');
    }
    if (duplicateChunks.length > 0) {
      log('3. 重複チャンクを削除する');
    }
    
    log('\n✅ 現在の状況調査完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

debugCurrentState().catch(console.error);
