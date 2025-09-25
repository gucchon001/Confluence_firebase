/**
 * 特定のページID (703529146) が取得できているか確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('check-specific-page.txt', message + '\n');
}

async function checkSpecificPage() {
  fs.writeFileSync('check-specific-page.txt', '');
  
  log('🔍 ページID 703529146 の取得状況を確認中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. LanceDBに接続
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    // 2. 指定されたページIDのチャンクを検索
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    
    const targetPageId = 703529146;
    const targetChunks = allChunks.filter((chunk: any) => chunk.pageId === targetPageId);
    
    log(`📊 ページID ${targetPageId} の検索結果:`);
    log(`- 見つかったチャンク数: ${targetChunks.length}`);
    
    if (targetChunks.length > 0) {
      log(`\n✅ ページID ${targetPageId} は取得されています`);
      
      // チャンクの詳細情報を表示
      targetChunks.forEach((chunk, index) => {
        log(`\n📄 チャンク ${index + 1}:`);
        log(`  - ID: ${chunk.id}`);
        log(`  - タイトル: ${chunk.title}`);
        log(`  - チャンクインデックス: ${chunk.chunkIndex}`);
        log(`  - コンテンツ長: ${chunk.content?.length || 0}文字`);
        log(`  - 最終更新: ${chunk.lastUpdated}`);
        log(`  - スペース: ${chunk.space_key}`);
        log(`  - ラベル: ${JSON.stringify(chunk.labels)}`);
        log(`  - URL: ${chunk.url}`);
        
        // コンテンツのプレビュー
        const contentPreview = chunk.content?.substring(0, 200) || '';
        log(`  - コンテンツプレビュー: ${contentPreview}...`);
      });
      
    } else {
      log(`\n❌ ページID ${targetPageId} は取得されていません`);
      
      // 3. Confluence APIから直接取得を試行
      log(`\n🌐 Confluence APIから直接取得を試行中...`);
      
      try {
        const page = await confluenceSyncService.getConfluencePageById(targetPageId.toString());
        log(`✅ Confluence APIから取得成功:`);
        log(`  - タイトル: ${page.title}`);
        log(`  - コンテンツ長: ${page.content?.length || 0}文字`);
        log(`  - 最終更新: ${page.lastModified}`);
        log(`  - スペース: ${page.spaceKey}`);
        log(`  - URL: ${page.url}`);
        
        // ラベルの確認
        const labels = confluenceSyncService.extractLabelsFromPage(page);
        log(`  - ラベル: ${JSON.stringify(labels)}`);
        
        // 除外対象かどうかチェック
        const isExcluded = confluenceSyncService.shouldExcludePage(page);
        log(`  - 除外対象: ${isExcluded ? 'Yes' : 'No'}`);
        
        if (isExcluded) {
          log(`  - 除外理由: ラベルまたはタイトルパターンによる除外`);
        }
        
      } catch (error) {
        log(`❌ Confluence API取得エラー: ${error}`);
      }
    }
    
    // 4. 類似のページIDを検索
    log(`\n🔍 類似のページIDを検索中...`);
    const similarPages = allChunks.filter((chunk: any) => 
      chunk.pageId.toString().includes('703529') || 
      chunk.pageId.toString().includes('3529146')
    );
    
    if (similarPages.length > 0) {
      log(`類似のページIDが見つかりました:`);
      similarPages.forEach((chunk, index) => {
        log(`  ${index + 1}. PageID: ${chunk.pageId}, タイトル: ${chunk.title}`);
      });
    } else {
      log(`類似のページIDは見つかりませんでした`);
    }
    
    // 5. 全ページIDの範囲を確認
    log(`\n📊 全ページIDの範囲を確認中...`);
    const pageIds = allChunks.map((chunk: any) => chunk.pageId).sort((a, b) => a - b);
    const minPageId = Math.min(...pageIds);
    const maxPageId = Math.max(...pageIds);
    
    log(`- 最小PageID: ${minPageId}`);
    log(`- 最大PageID: ${maxPageId}`);
    log(`- 指定PageID: ${targetPageId}`);
    log(`- 範囲内: ${targetPageId >= minPageId && targetPageId <= maxPageId ? 'Yes' : 'No'}`);
    
    // 6. 指定PageIDに近いPageIDを検索
    log(`\n🔍 指定PageIDに近いPageIDを検索中...`);
    const nearbyPages = allChunks.filter((chunk: any) => 
      Math.abs(chunk.pageId - targetPageId) <= 1000
    ).sort((a, b) => Math.abs(a.pageId - targetPageId) - Math.abs(b.pageId - targetPageId));
    
    if (nearbyPages.length > 0) {
      log(`近いPageIDが見つかりました:`);
      nearbyPages.slice(0, 10).forEach((chunk, index) => {
        const diff = Math.abs(chunk.pageId - targetPageId);
        log(`  ${index + 1}. PageID: ${chunk.pageId} (差: ${diff}), タイトル: ${chunk.title}`);
      });
    } else {
      log(`近いPageIDは見つかりませんでした`);
    }
    
    log('\n✅ 特定ページ確認完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

checkSpecificPage().catch(console.error);
