/**
 * ページ数を増やしてテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-more-pages-sync.txt', message + '\n');
}

async function testMorePagesSync() {
  // 結果ファイルをクリア
  fs.writeFileSync('test-more-pages-sync.txt', '');
  
  log('🚀 ページ数を増やしてテスト...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 50ページのテスト
    log('📄 50ページのテスト開始...');
    const startTime50 = Date.now();
    
    const pages50 = await confluenceSyncService.getConfluencePagesBatch(50, 10);
    log(`📊 50ページ取得完了: ${pages50.length}ページ (${Date.now() - startTime50}ms)`);
    
    const syncResult50 = await confluenceSyncService.syncPagesParallel(pages50, 5);
    log(`📊 50ページ同期完了: 追加=${syncResult50.added}, 更新=${syncResult50.updated}, 除外=${syncResult50.excluded}, エラー=${syncResult50.errors.length}`);
    
    // データベースの状態確認
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks50 = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 50ページ後データベース: ${allChunks50.length}チャンク`);

    // 重複チェック
    const chunksByPageId50 = new Map<number, any[]>();
    allChunks50.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId50.has(pageId)) {
        chunksByPageId50.set(pageId, []);
      }
      chunksByPageId50.get(pageId)!.push(chunk);
    });

    let duplicatePages50 = 0;
    for (const [pageId, chunks] of chunksByPageId50) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages50++;
      }
    }

    log(`📊 50ページ重複チェック: 重複ページ=${duplicatePages50}`);

    // ハイブリッド検索テスト
    const searchResult50 = await searchEngine.search({ query: '機能 要件', topK: 5 });
    log(`📊 50ページ検索テスト: ${searchResult50.length}件の結果`);

    log(`\n✅ 50ページテスト完了\n`);

    // 2. 100ページのテスト
    log('📄 100ページのテスト開始...');
    const startTime100 = Date.now();
    
    const pages100 = await confluenceSyncService.getConfluencePagesBatch(100, 10);
    log(`📊 100ページ取得完了: ${pages100.length}ページ (${Date.now() - startTime100}ms)`);
    
    const syncResult100 = await confluenceSyncService.syncPagesParallel(pages100, 10);
    log(`📊 100ページ同期完了: 追加=${syncResult100.added}, 更新=${syncResult100.updated}, 除外=${syncResult100.excluded}, エラー=${syncResult100.errors.length}`);
    
    // データベースの状態確認
    const allChunks100 = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 100ページ後データベース: ${allChunks100.length}チャンク`);

    // 重複チェック
    const chunksByPageId100 = new Map<number, any[]>();
    allChunks100.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId100.has(pageId)) {
        chunksByPageId100.set(pageId, []);
      }
      chunksByPageId100.get(pageId)!.push(chunk);
    });

    let duplicatePages100 = 0;
    for (const [pageId, chunks] of chunksByPageId100) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages100++;
      }
    }

    log(`📊 100ページ重複チェック: 重複ページ=${duplicatePages100}`);

    // ハイブリッド検索テスト
    const searchResult100 = await searchEngine.search({ query: '管理 フロー', topK: 5 });
    log(`📊 100ページ検索テスト: ${searchResult100.length}件の結果`);

    log(`\n✅ 100ページテスト完了\n`);

    // 3. 200ページのテスト
    log('📄 200ページのテスト開始...');
    const startTime200 = Date.now();
    
    const pages200 = await confluenceSyncService.getConfluencePagesBatch(200, 20);
    log(`📊 200ページ取得完了: ${pages200.length}ページ (${Date.now() - startTime200}ms)`);
    
    const syncResult200 = await confluenceSyncService.syncPagesParallel(pages200, 20);
    log(`📊 200ページ同期完了: 追加=${syncResult200.added}, 更新=${syncResult200.updated}, 除外=${syncResult200.excluded}, エラー=${syncResult200.errors.length}`);
    
    // データベースの状態確認
    const allChunks200 = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 200ページ後データベース: ${allChunks200.length}チャンク`);

    // 重複チェック
    const chunksByPageId200 = new Map<number, any[]>();
    allChunks200.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId200.has(pageId)) {
        chunksByPageId200.set(pageId, []);
      }
      chunksByPageId200.get(pageId)!.push(chunk);
    });

    let duplicatePages200 = 0;
    for (const [pageId, chunks] of chunksByPageId200) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages200++;
      }
    }

    log(`📊 200ページ重複チェック: 重複ページ=${duplicatePages200}`);

    // ハイブリッド検索テスト
    const searchResult200 = await searchEngine.search({ query: 'データベース 同期', topK: 5 });
    log(`📊 200ページ検索テスト: ${searchResult200.length}件の結果`);

    log(`\n✅ 200ページテスト完了\n`);

    // 4. 総合評価
    log('🎯 総合評価:');
    log('=' .repeat(50));
    
    log(`📊 50ページ結果:`);
    log(`  取得時間: ${Date.now() - startTime50}ms`);
    log(`  同期結果: 追加=${syncResult50.added}, 更新=${syncResult50.updated}, 除外=${syncResult50.excluded}`);
    log(`  データベース: ${allChunks50.length}チャンク`);
    log(`  重複ページ: ${duplicatePages50}`);
    log(`  検索結果: ${searchResult50.length}件`);
    
    log(`\n📊 100ページ結果:`);
    log(`  取得時間: ${Date.now() - startTime100}ms`);
    log(`  同期結果: 追加=${syncResult100.added}, 更新=${syncResult100.updated}, 除外=${syncResult100.excluded}`);
    log(`  データベース: ${allChunks100.length}チャンク`);
    log(`  重複ページ: ${duplicatePages100}`);
    log(`  検索結果: ${searchResult100.length}件`);
    
    log(`\n📊 200ページ結果:`);
    log(`  取得時間: ${Date.now() - startTime200}ms`);
    log(`  同期結果: 追加=${syncResult200.added}, 更新=${syncResult200.updated}, 除外=${syncResult200.excluded}`);
    log(`  データベース: ${allChunks200.length}チャンク`);
    log(`  重複ページ: ${duplicatePages200}`);
    log(`  検索結果: ${searchResult200.length}件`);

    // パフォーマンス分析
    const totalTime = Date.now() - startTime50;
    const totalPages = pages50.length + pages100.length + pages200.length;
    const totalChunks = allChunks200.length;
    
    log(`\n📊 パフォーマンス分析:`);
    log(`  総実行時間: ${totalTime}ms`);
    log(`  総ページ数: ${totalPages}`);
    log(`  総チャンク数: ${totalChunks}`);
    log(`  ページ/秒: ${Math.round(totalPages / totalTime * 1000)}`);
    log(`  チャンク/秒: ${Math.round(totalChunks / totalTime * 1000)}`);

    // 重複率の分析
    const totalDuplicatePages = duplicatePages50 + duplicatePages100 + duplicatePages200;
    const totalPagesProcessed = chunksByPageId50.size + chunksByPageId100.size + chunksByPageId200.size;
    const duplicateRate = (totalDuplicatePages / totalPagesProcessed * 100).toFixed(2);
    
    log(`\n📊 重複率分析:`);
    log(`  総重複ページ数: ${totalDuplicatePages}`);
    log(`  総処理ページ数: ${totalPagesProcessed}`);
    log(`  重複率: ${duplicateRate}%`);

    if (totalDuplicatePages === 0) {
      log(`\n🎉 重複ファイルは全く生成されていません！`);
    } else {
      log(`\n⚠️ 重複ファイルが生成されています: ${totalDuplicatePages}ページ`);
    }

    log('\n✅ ページ数増加テスト完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testMorePagesSync().catch(console.error);
