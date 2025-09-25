/**
 * 仕様書に基づいた正しい同期テスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-spec-compliant-sync.txt', message + '\n');
}

async function testSpecCompliantSync() {
  fs.writeFileSync('test-spec-compliant-sync.txt', '');
  
  log('🧪 仕様書に基づいた正しい同期テストを実行中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. テスト用に1ページを取得
    log('📄 テスト用に1ページを取得中...');
    const pages = await confluenceSyncService.getConfluencePages(1, 0);
    
    if (pages.length === 0) {
      log('❌ ページが取得できませんでした');
      return;
    }
    
    const page = pages[0];
    log(`✅ ページ取得成功:`);
    log(`- ID: ${page.id}`);
    log(`- タイトル: ${page.title}`);
    log(`- コンテンツ長: ${page.content?.length || 0}文字`);
    log(`- スペース: ${page.spaceKey}`);
    log(`- 最終更新: ${page.lastModified}`);
    
    // 2. チャンク分割をテスト
    log('\n📝 チャンク分割をテスト中...');
    const chunks = confluenceSyncService.splitPageIntoChunks(page);
    
    log(`- 分割されたチャンク数: ${chunks.length}`);
    
    chunks.forEach((chunk, index) => {
      log(`- チャンク ${index + 1}:`);
      log(`  - サイズ: ${chunk.content?.length || 0}文字`);
      log(`  - インデックス: ${chunk.chunkIndex}`);
      log(`  - スペース: ${chunk.spaceKey}`);
      log(`  - 最終更新: ${chunk.lastUpdated}`);
      log(`  - プレビュー: "${chunk.content?.substring(0, 100)}..."`);
    });
    
    // 3. 期待される結果との比較
    const expectedChunks = Math.ceil((page.content?.length || 0) / 1800);
    log(`\n📊 期待されるチャンク数: ${expectedChunks}`);
    log(`実際のチャンク数: ${chunks.length}`);
    
    if (chunks.length === expectedChunks) {
      log(`✅ チャンク分割が正しく動作しています`);
    } else {
      log(`❌ チャンク分割に問題があります`);
    }
    
    // 4. 同期テスト
    log('\n🔄 同期テストを実行中...');
    
    const syncResult = await confluenceSyncService.syncPages([page]);
    
    log(`📊 同期結果:`);
    log(`- 追加: ${syncResult.added}`);
    log(`- 更新: ${syncResult.updated}`);
    log(`- 変更なし: ${syncResult.unchanged}`);
    log(`- 除外: ${syncResult.excluded}`);
    log(`- エラー: ${syncResult.errors.length}`);
    
    if (syncResult.errors.length > 0) {
      log(`\n❌ エラー詳細:`);
      syncResult.errors.forEach((error, index) => {
        log(`  ${index + 1}. ${error}`);
      });
    }
    
    // 5. データベースの確認
    log('\n📊 データベースの確認中...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`- 総チャンク数: ${allChunks.length}`);
    
    if (allChunks.length > 0) {
      const chunk = allChunks[0];
      log(`- 最初のチャンク:`);
      log(`  - ID: ${chunk.id}`);
      log(`  - ページID: ${chunk.pageId} (型: ${typeof chunk.pageId})`);
      log(`  - タイトル: ${chunk.title}`);
      log(`  - コンテンツ長: ${chunk.content?.length || 0}文字`);
      log(`  - スペース: ${chunk.space_key}`);
      log(`  - チャンクインデックス: ${chunk.chunkIndex}`);
      log(`  - 最終更新: ${chunk.lastUpdated}`);
      log(`  - ラベル: ${JSON.stringify(chunk.labels)}`);
      log(`  - ベクトル次元: ${chunk.vector?.length || 0}`);
      
      // 仕様書との照合
      log(`\n📋 仕様書との照合:`);
      log(`- pageId型: ${typeof chunk.pageId === 'number' ? '✅' : '❌'} (期待: number)`);
      log(`- labels型: ${Array.isArray(chunk.labels) ? '✅' : '❌'} (期待: array)`);
      log(`- lastUpdated型: ${typeof chunk.lastUpdated === 'string' ? '✅' : '❌'} (期待: string)`);
      log(`- vector次元: ${chunk.vector?.length === 768 ? '✅' : '❌'} (期待: 768)`);
      log(`- space_key: ${chunk.space_key !== 'N/A' ? '✅' : '❌'} (期待: 実際のスペースキー)`);
    }
    
    // 6. ハイブリッド検索テスト
    log('\n🔍 ハイブリッド検索テスト中...');
    try {
      const searchResults = await confluenceSyncService.searchEngine.search({
        query: page.title?.substring(0, 10) || 'テスト',
        topK: 5
      });
      
      log(`- 検索結果数: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        const result = searchResults[0];
        log(`- 最初の結果:`);
        log(`  - タイトル: ${result.title}`);
        log(`  - スコア: ${result.score}`);
        log(`  - 距離: ${result.distance}`);
        log(`  - ラベル: ${JSON.stringify(result.labels)}`);
      }
      
      log(`✅ ハイブリッド検索が正常に動作しています`);
    } catch (error) {
      log(`❌ ハイブリッド検索エラー: ${error}`);
    }
    
    log('\n✅ 仕様書に基づいた同期テスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testSpecCompliantSync().catch(console.error);
