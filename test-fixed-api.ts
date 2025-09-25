/**
 * 修正後のAPI呼び出しをテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-fixed-api.txt', message + '\n');
}

async function testFixedApi() {
  fs.writeFileSync('test-fixed-api.txt', '');
  
  log('🧪 修正後のAPI呼び出しをテスト中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 修正後のgetConfluencePageByIdをテスト
    log('📄 修正後のgetConfluencePageByIdをテスト中...');
    const page = await confluenceSyncService.getConfluencePageById('703529146');
    
    if (page) {
      log(`✅ ページ取得成功:`);
      log(`- ID: ${page.id}`);
      log(`- タイトル: ${page.title}`);
      log(`- コンテンツ長: ${page.content?.length || 0}文字`);
      log(`- スペース: ${page.spaceKey}`);
      log(`- URL: ${page.url}`);
      log(`- 最終更新: ${page.lastModified}`);
      
      // コンテンツのプレビュー
      if (page.content && page.content.length > 0) {
        log(`\n📄 コンテンツプレビュー (最初の500文字):`);
        log(`"${page.content.substring(0, 500)}..."`);
      }
      
      // ラベルの確認
      const labels = confluenceSyncService.extractLabelsFromPage(page);
      log(`\n🏷️ ラベル: ${JSON.stringify(labels)}`);
      
    } else {
      log(`❌ ページ取得に失敗しました`);
    }
    
    // 2. 同期テスト
    if (page) {
      log(`\n🔄 同期テストを実行中...`);
      
      try {
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
        
      } catch (error) {
        log(`❌ 同期エラー: ${error}`);
      }
    }
    
    // 3. LanceDBの状況を確認
    log(`\n📊 LanceDBの状況を確認中...`);
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    const targetPageId = 703529146;
    const targetChunks = allChunks.filter((chunk: any) => chunk.pageId === targetPageId);
    
    log(`LanceDB内の該当ページ:`);
    log(`- 見つかったチャンク数: ${targetChunks.length}`);
    
    if (targetChunks.length > 0) {
      const chunk = targetChunks[0];
      log(`- タイトル: ${chunk.title}`);
      log(`- コンテンツ長: ${chunk.content?.length || 0}文字`);
      log(`- スペース: ${chunk.space_key}`);
      log(`- チャンクインデックス: ${chunk.chunkIndex}`);
      
      // コンテンツのプレビュー
      if (chunk.content && chunk.content.length > 0) {
        log(`- コンテンツプレビュー (最初の500文字):`);
        log(`"${chunk.content.substring(0, 500)}..."`);
      }
    }
    
    log('\n✅ 修正後APIテスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testFixedApi().catch(console.error);
