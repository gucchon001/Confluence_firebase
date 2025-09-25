/**
 * 大規模本番環境テスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-large-scale-production.txt', message + '\n');
}

async function testLargeScaleProduction() {
  fs.writeFileSync('test-large-scale-production.txt', '');
  
  log('🚀 大規模本番環境テスト開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 500ページのテスト
    log('📄 500ページのテスト開始...');
    const startTime500 = Date.now();
    
    const pages500 = await confluenceSyncService.getConfluencePagesBatch(500, 20);
    log(`📊 500ページ取得完了: ${pages500.length}ページ (${Date.now() - startTime500}ms)`);
    
    const syncResult500 = await confluenceSyncService.syncPagesParallel(pages500, 15);
    log(`📊 500ページ同期完了: 追加=${syncResult500.added}, 更新=${syncResult500.updated}, 除外=${syncResult500.excluded}, エラー=${syncResult500.errors.length}`);
    
    // データベースの状態確認
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allChunks500 = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 500ページ後データベース: ${allChunks500.length}チャンク`);

    // 重複チェック
    const chunksByPageId500 = new Map<number, any[]>();
    allChunks500.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId500.has(pageId)) {
        chunksByPageId500.set(pageId, []);
      }
      chunksByPageId500.get(pageId)!.push(chunk);
    });

    let duplicatePages500 = 0;
    for (const [pageId, chunks] of chunksByPageId500) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages500++;
      }
    }

    log(`📊 500ページ重複チェック: 重複ページ=${duplicatePages500}`);

    // ハイブリッド検索テスト
    const searchResult500 = await searchEngine.search({ query: '機能 要件', topK: 5 });
    log(`📊 500ページ検索テスト: ${searchResult500.length}件の結果`);

    log(`\n✅ 500ページテスト完了\n`);

    // 2. 1000ページのテスト
    log('📄 1000ページのテスト開始...');
    const startTime1000 = Date.now();
    
    const pages1000 = await confluenceSyncService.getConfluencePagesBatch(1000, 25);
    log(`📊 1000ページ取得完了: ${pages1000.length}ページ (${Date.now() - startTime1000}ms)`);
    
    const syncResult1000 = await confluenceSyncService.syncPagesParallel(pages1000, 20);
    log(`📊 1000ページ同期完了: 追加=${syncResult1000.added}, 更新=${syncResult1000.updated}, 除外=${syncResult1000.excluded}, エラー=${syncResult1000.errors.length}`);
    
    // データベースの状態確認
    const allChunks1000 = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 1000ページ後データベース: ${allChunks1000.length}チャンク`);

    // 重複チェック
    const chunksByPageId1000 = new Map<number, any[]>();
    allChunks1000.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId1000.has(pageId)) {
        chunksByPageId1000.set(pageId, []);
      }
      chunksByPageId1000.get(pageId)!.push(chunk);
    });

    let duplicatePages1000 = 0;
    for (const [pageId, chunks] of chunksByPageId1000) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages1000++;
      }
    }

    log(`📊 1000ページ重複チェック: 重複ページ=${duplicatePages1000}`);

    // ハイブリッド検索テスト
    const searchResult1000 = await searchEngine.search({ query: '管理 フロー', topK: 5 });
    log(`📊 1000ページ検索テスト: ${searchResult1000.length}件の結果`);

    log(`\n✅ 1000ページテスト完了\n`);

    // 3. 2000ページのテスト
    log('📄 2000ページのテスト開始...');
    const startTime2000 = Date.now();
    
    const pages2000 = await confluenceSyncService.getConfluencePagesBatch(2000, 30);
    log(`📊 2000ページ取得完了: ${pages2000.length}ページ (${Date.now() - startTime2000}ms)`);
    
    const syncResult2000 = await confluenceSyncService.syncPagesParallel(pages2000, 25);
    log(`📊 2000ページ同期完了: 追加=${syncResult2000.added}, 更新=${syncResult2000.updated}, 除外=${syncResult2000.excluded}, エラー=${syncResult2000.errors.length}`);
    
    // データベースの状態確認
    const allChunks2000 = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 2000ページ後データベース: ${allChunks2000.length}チャンク`);

    // 重複チェック
    const chunksByPageId2000 = new Map<number, any[]>();
    allChunks2000.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId2000.has(pageId)) {
        chunksByPageId2000.set(pageId, []);
      }
      chunksByPageId2000.get(pageId)!.push(chunk);
    });

    let duplicatePages2000 = 0;
    for (const [pageId, chunks] of chunksByPageId2000) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages2000++;
      }
    }

    log(`📊 2000ページ重複チェック: 重複ページ=${duplicatePages2000}`);

    // ハイブリッド検索テスト
    const searchResult2000 = await searchEngine.search({ query: 'データベース 同期', topK: 5 });
    log(`📊 2000ページ検索テスト: ${searchResult2000.length}件の結果`);

    log(`\n✅ 2000ページテスト完了\n`);

    // 4. 総合評価
    log('🎯 総合評価:');
    log('=' .repeat(50));
    
    log(`📊 500ページ結果:`);
    log(`  取得時間: ${Date.now() - startTime500}ms`);
    log(`  同期結果: 追加=${syncResult500.added}, 更新=${syncResult500.updated}, 除外=${syncResult500.excluded}`);
    log(`  データベース: ${allChunks500.length}チャンク`);
    log(`  重複ページ: ${duplicatePages500}`);
    log(`  検索結果: ${searchResult500.length}件`);
    
    log(`\n📊 1000ページ結果:`);
    log(`  取得時間: ${Date.now() - startTime1000}ms`);
    log(`  同期結果: 追加=${syncResult1000.added}, 更新=${syncResult1000.updated}, 除外=${syncResult1000.excluded}`);
    log(`  データベース: ${allChunks1000.length}チャンク`);
    log(`  重複ページ: ${duplicatePages1000}`);
    log(`  検索結果: ${searchResult1000.length}件`);
    
    log(`\n📊 2000ページ結果:`);
    log(`  取得時間: ${Date.now() - startTime2000}ms`);
    log(`  同期結果: 追加=${syncResult2000.added}, 更新=${syncResult2000.updated}, 除外=${syncResult2000.excluded}`);
    log(`  データベース: ${allChunks2000.length}チャンク`);
    log(`  重複ページ: ${duplicatePages2000}`);
    log(`  検索結果: ${searchResult2000.length}件`);

    // パフォーマンス分析
    const totalTime = Date.now() - startTime500;
    const totalPages = pages500.length + pages1000.length + pages2000.length;
    const totalChunks = allChunks2000.length;
    
    log(`\n📊 パフォーマンス分析:`);
    log(`  総実行時間: ${totalTime}ms`);
    log(`  総ページ数: ${totalPages}`);
    log(`  総チャンク数: ${totalChunks}`);
    log(`  ページ/秒: ${Math.round(totalPages / totalTime * 1000)}`);
    log(`  チャンク/秒: ${Math.round(totalChunks / totalTime * 1000)}`);

    // 重複率の分析
    const totalDuplicatePages = duplicatePages500 + duplicatePages1000 + duplicatePages2000;
    const totalPagesProcessed = chunksByPageId500.size + chunksByPageId1000.size + chunksByPageId2000.size;
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

    log('\n✅ 大規模本番環境テスト完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testLargeScaleProduction().catch(console.error);
