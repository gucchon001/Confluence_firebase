/**
 * 特定のページIDがLanceDBに存在するかチェック
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';

async function checkSpecificPage(pageId: string): Promise<void> {
  console.log(`🔍 ページID ${pageId} の存在確認中...\n`);

  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();

    const table = await lancedbClient.getTable();
    
    // 1. 特定のページIDで検索
    console.log(`📄 ページID ${pageId} で検索中...`);
    const dummyVector = new Array(768).fill(0);
    const chunks = await table.search(dummyVector).limit(10000).toArray();
    
    const matchingChunks = chunks.filter((chunk: any) => chunk.pageId.toString() === pageId);
    
    if (matchingChunks.length > 0) {
      console.log(`✅ ページID ${pageId} は存在します！`);
      console.log(`📊 チャンク数: ${matchingChunks.length}`);
      
      // チャンクの詳細情報を表示
      matchingChunks.forEach((chunk: any, index: number) => {
        console.log(`\n📝 チャンク ${index + 1}:`);
        console.log(`  🆔 ページID: ${chunk.pageId}`);
        console.log(`  📄 タイトル: ${chunk.title}`);
        console.log(`  📝 コンテンツ長: ${chunk.content?.length || 0}文字`);
        console.log(`  🏷️ ラベル: ${JSON.stringify(chunk.labels)}`);
        console.log(`  📅 最終更新: ${chunk.lastUpdated}`);
        console.log(`  🔢 チャンク番号: ${chunk.chunkIndex}`);
      });
    } else {
      console.log(`❌ ページID ${pageId} は存在しません`);
    }
    
    // 2. 全ページIDのリストを表示（参考用）
    console.log(`\n📊 参考: 全ページIDの一部 (最新20件):`);
    const allPageIds = chunks.map((chunk: any) => chunk.pageId.toString());
    const uniquePageIds = Array.from(new Set(allPageIds));
    const sortedPageIds = uniquePageIds.map(id => parseInt(id)).sort((a, b) => b - a);
    
    console.log(`📄 総ページ数: ${uniquePageIds.length}`);
    console.log(`🆕 最新のページID: ${sortedPageIds.slice(0, 20).join(', ')}`);
    
    // 3. 指定されたページIDが範囲内かチェック
    const pageIdNum = parseInt(pageId);
    const minPageId = Math.min(...sortedPageIds);
    const maxPageId = Math.max(...sortedPageIds);
    
    console.log(`\n📊 ページID範囲:`);
    console.log(`  📉 最小ページID: ${minPageId}`);
    console.log(`  📈 最大ページID: ${maxPageId}`);
    console.log(`  🎯 対象ページID: ${pageIdNum}`);
    
    if (pageIdNum < minPageId) {
      console.log(`⚠️ 対象ページIDは最小値より小さいです`);
    } else if (pageIdNum > maxPageId) {
      console.log(`⚠️ 対象ページIDは最大値より大きいです`);
    } else {
      console.log(`✅ 対象ページIDは範囲内です`);
    }

  } catch (error) {
    console.error('❌ ページ確認中にエラーが発生しました:', error);
  }
}

// 実行
const targetPageId = '717979831';
checkSpecificPage(targetPageId).catch(console.error);