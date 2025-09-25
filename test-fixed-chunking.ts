/**
 * 修正後のチャンク分割をテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-fixed-chunking.txt', message + '\n');
}

async function testFixedChunking() {
  fs.writeFileSync('test-fixed-chunking.txt', '');
  
  log('🧪 修正後のチャンク分割をテスト中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. ページを取得
    log('📄 ページを取得中...');
    const page = await confluenceSyncService.getConfluencePageById('703529146');
    
    if (page) {
      log(`✅ ページ取得成功:`);
      log(`- ID: ${page.id}`);
      log(`- タイトル: ${page.title}`);
      log(`- コンテンツ長: ${page.content?.length || 0}文字`);
      log(`- スペース: ${page.spaceKey}`);
      
      // 2. チャンク分割をテスト
      log('\n📝 チャンク分割をテスト中...');
      const chunks = confluenceSyncService.splitPageIntoChunks(page);
      
      log(`- 分割されたチャンク数: ${chunks.length}`);
      
      chunks.forEach((chunk, index) => {
        log(`- チャンク ${index + 1}:`);
        log(`  - サイズ: ${chunk.content?.length || 0}文字`);
        log(`  - インデックス: ${chunk.chunkIndex}`);
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
      
      // 古いデータを削除
      await confluenceSyncService.lancedbClient.connect();
      const table = await confluenceSyncService.lancedbClient.getTable();
      await table.delete(`"pageId" = ${page.id}`);
      log(`✅ 古いデータを削除しました`);
      
      // 新しいデータで同期
      const syncResult = await confluenceSyncService.syncPages([page]);
      
      log(`📊 同期結果:`);
      log(`- 追加: ${syncResult.added}`);
      log(`- 更新: ${syncResult.updated}`);
      log(`- 変更なし: ${syncResult.unchanged}`);
      log(`- 除外: ${syncResult.excluded}`);
      log(`- エラー: ${syncResult.errors.length}`);
      
      // 5. 最終確認
      log('\n📊 最終確認中...');
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      const targetChunks = allChunks.filter((chunk: any) => chunk.pageId === parseInt(page.id));
      
      log(`最終結果:`);
      log(`- 総チャンク数: ${allChunks.length}`);
      log(`- 対象ページのチャンク数: ${targetChunks.length}`);
      
      if (targetChunks.length > 0) {
        const chunk = targetChunks[0];
        log(`- 最終コンテンツ長: ${chunk.content?.length || 0}文字`);
        log(`- 最終スペース: ${chunk.space_key}`);
        log(`- 最終チャンクインデックス: ${chunk.chunkIndex}`);
        
        if (chunk.content && chunk.content.length > 26) {
          log(`✅ データ修正成功！`);
          log(`- 古いコンテンツ: 26文字`);
          log(`- 新しいコンテンツ: ${chunk.content.length}文字`);
        } else {
          log(`❌ データ修正失敗`);
        }
      }
      
    } else {
      log(`❌ ページ取得に失敗しました`);
    }
    
    log('\n✅ 修正後チャンク分割テスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testFixedChunking().catch(console.error);
