/**
 * 除外対象でない有効なページで同期テスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-valid-page-sync.txt', message + '\n');
}

async function testValidPageSync() {
  fs.writeFileSync('test-valid-page-sync.txt', '');
  
  log('🧪 除外対象でない有効なページで同期テストを実行中...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    
    // 1. 複数ページを取得して有効なページを探す
    log('📄 複数ページを取得して有効なページを探す中...');
    const pages = await confluenceSyncService.getConfluencePages(10, 0);
    
    log(`- 取得したページ数: ${pages.length}`);
    
    // 2. 各ページのラベルを確認
    let validPage = null;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const labels = confluenceSyncService.extractLabelsFromPage(page);
      
      log(`\n📄 ページ ${i + 1}: ${page.title}`);
      log(`- ID: ${page.id}`);
      log(`- ラベル: [${labels.join(', ')}]`);
      log(`- コンテンツ長: ${page.content?.length || 0}文字`);
      
      // 除外対象でないページを探す
      const isExcluded = confluenceSyncService.shouldExcludePage(page);
      log(`- 除外対象: ${isExcluded ? 'はい' : 'いいえ'}`);
      
      if (!isExcluded && page.content && page.content.length > 100) {
        validPage = page;
        log(`✅ 有効なページを発見: ${page.title}`);
        break;
      }
    }
    
    if (!validPage) {
      log('❌ 有効なページが見つかりませんでした');
      return;
    }
    
    // 3. 有効なページでチャンク分割をテスト
    log('\n📝 有効なページでチャンク分割をテスト中...');
    const chunks = confluenceSyncService.splitPageIntoChunks(validPage);
    
    log(`- 分割されたチャンク数: ${chunks.length}`);
    
    chunks.forEach((chunk, index) => {
      log(`- チャンク ${index + 1}:`);
      log(`  - サイズ: ${chunk.content?.length || 0}文字`);
      log(`  - インデックス: ${chunk.chunkIndex}`);
      log(`  - スペース: ${chunk.spaceKey}`);
      log(`  - 最終更新: ${chunk.lastUpdated}`);
    });
    
    // 4. 同期テスト
    log('\n🔄 同期テストを実行中...');
    
    const syncResult = await confluenceSyncService.syncPages([validPage]);
    
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
      log(`- コンテンツ長: ${chunk.content?.length > 100 ? '✅' : '❌'} (期待: 100文字以上)`);
    }
    
    // 6. ハイブリッド検索テスト
    log('\n🔍 ハイブリッド検索テスト中...');
    try {
      const searchResults = await confluenceSyncService.searchEngine.search({
        query: validPage.title?.substring(0, 10) || 'テスト',
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
    
    // 7. 品質スコア計算
    log('\n📊 品質スコア計算中...');
    let qualityScore = 0;
    
    if (allChunks.length > 0) {
      const chunk = allChunks[0];
      
      // データ型の正確性 (2点)
      if (typeof chunk.pageId === 'number') qualityScore += 1;
      if (Array.isArray(chunk.labels)) qualityScore += 1;
      
      // データの完全性 (2点)
      if (chunk.content?.length > 100) qualityScore += 1;
      if (chunk.space_key !== 'N/A') qualityScore += 1;
      
      // 機能の動作 (1点)
      if (chunk.vector?.length === 768) qualityScore += 1;
    }
    
    log(`- 品質スコア: ${qualityScore}/5`);
    
    if (qualityScore >= 4) {
      log(`✅ 高品質なデータベースが構築されました`);
    } else if (qualityScore >= 3) {
      log(`⚠️ 品質に改善の余地があります`);
    } else {
      log(`❌ 品質に問題があります`);
    }
    
    log('\n✅ 有効なページ同期テスト完了');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testValidPageSync().catch(console.error);
