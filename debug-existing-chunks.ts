/**
 * 既存チャンクの作成理由をデバッグ
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';

async function debugExistingChunks() {
  console.log('🔍 既存チャンクの作成理由をデバッグ中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();

    // 1. 1ページを取得
    console.log('📄 1ページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(1, 0);
    
    if (pages.length === 0) {
      console.log('❌ ページが取得できませんでした');
      return;
    }

    const page = pages[0];
    console.log(`📄 取得ページ: ${page.title} (ID: ${page.id})`);
    console.log(`📅 Confluence更新日時: ${page.version?.when}`);

    // 2. 既存チャンクを検索
    console.log('\n🔍 既存チャンクを検索中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    // 既存チャンク検索のデバッグ
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    console.log(`📊 全チャンク数: ${allChunks.length}`);
    
    const existingChunks = allChunks.filter((chunk: any) => chunk.pageId === parseInt(page.id));
    console.log(`🔍 ページID ${page.id} の既存チャンク数: ${existingChunks.length}`);
    
    if (existingChunks.length > 0) {
      console.log('\n📋 既存チャンクの詳細:');
      existingChunks.forEach((chunk, index) => {
        console.log(`  ${index + 1}. ID: ${chunk.id}`);
        console.log(`     PageID: ${chunk.pageId} (型: ${typeof chunk.pageId})`);
        console.log(`     Title: ${chunk.title}`);
        console.log(`     LastUpdated: ${chunk.lastUpdated} (型: ${typeof chunk.lastUpdated})`);
        console.log(`     ChunkIndex: ${chunk.chunkIndex}`);
        console.log(`     Labels: ${JSON.stringify(chunk.labels)}`);
        console.log('');
      });

      // 3. 日時比較のデバッグ
      console.log('📅 日時比較のデバッグ:');
      const existingLastModified = existingChunks[0].lastUpdated;
      const confluenceLastModified = page.version?.when || new Date().toISOString();
      
      console.log(`  既存データ: ${existingLastModified}`);
      console.log(`  Confluence: ${confluenceLastModified}`);
      
      const existingDate = new Date(existingLastModified);
      const confluenceDate = new Date(confluenceLastModified);
      
      console.log(`  既存Date: ${existingDate.toISOString()}`);
      console.log(`  ConfluenceDate: ${confluenceDate.toISOString()}`);
      console.log(`  既存タイムスタンプ: ${existingDate.getTime()}`);
      console.log(`  Confluenceタイムスタンプ: ${confluenceDate.getTime()}`);
      console.log(`  差分(ms): ${confluenceDate.getTime() - existingDate.getTime()}`);
      
      if (confluenceDate > existingDate) {
        console.log('  ✅ Confluenceが新しい → 更新が必要');
      } else if (confluenceDate < existingDate) {
        console.log('  ⏭️ 既存が新しい → 更新不要');
      } else {
        console.log('  ⏭️ 同じ日時 → 更新不要');
      }

      // 4. チャンク分割の比較
      console.log('\n📝 チャンク分割の比較:');
      const newChunks = confluenceSyncService.splitPageIntoChunks(page);
      console.log(`  既存チャンク数: ${existingChunks.length}`);
      console.log(`  新しいチャンク数: ${newChunks.length}`);
      
      if (existingChunks.length !== newChunks.length) {
        console.log('  ⚠️ チャンク数が異なります → 更新が必要');
      } else {
        console.log('  ✅ チャンク数は同じです');
      }

      // 5. チャンク内容の比較
      console.log('\n📄 チャンク内容の比較:');
      for (let i = 0; i < Math.min(existingChunks.length, newChunks.length); i++) {
        const existingChunk = existingChunks[i];
        const newChunk = newChunks[i];
        
        console.log(`  チャンク ${i + 1}:`);
        console.log(`    既存タイトル: ${existingChunk.title}`);
        console.log(`    新しいタイトル: ${newChunk.title}`);
        console.log(`    既存コンテンツ長: ${existingChunk.content?.length || 0}`);
        console.log(`    新しいコンテンツ長: ${newChunk.content?.length || 0}`);
        
        if (existingChunk.title !== newChunk.title) {
          console.log('    ⚠️ タイトルが異なります');
        }
        if (existingChunk.content !== newChunk.content) {
          console.log('    ⚠️ コンテンツが異なります');
        }
      }
    } else {
      console.log('✅ 既存チャンクはありません → 新規追加');
    }

    // 6. 同期実行
    console.log('\n🔄 同期を実行中...');
    const syncResult = await confluenceSyncService.syncPages(pages);
    
    console.log('\n📈 同期結果:');
    console.log(`  追加: ${syncResult.added}`);
    console.log(`  更新: ${syncResult.updated}`);
    console.log(`  変更なし: ${syncResult.unchanged}`);
    console.log(`  除外: ${syncResult.excluded}`);
    console.log(`  エラー: ${syncResult.errors.length}`);

    if (syncResult.errors.length > 0) {
      console.log('\n❌ エラー詳細:');
      syncResult.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

debugExistingChunks().catch(console.error);
