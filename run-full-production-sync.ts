/**
 * 本番環境で全ページを実行
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('run-full-production-sync.txt', message + '\n');
}

async function runFullProductionSync() {
  fs.writeFileSync('run-full-production-sync.txt', '');
  
  log('🚀 本番環境で全ページを実行開始...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. 全ページ数の確認
    log('📊 全ページ数の確認...');
    const startTime = Date.now();
    
    // 全ページ数を取得するため、大きな数で取得を試行
    let totalPages = 0;
    let offset = 0;
    const batchSize = 1000;
    
    log('📊 全ページ数の詳細確認中...');
    while (true) {
      const batchPages = await confluenceSyncService.getConfluencePages(batchSize, offset);
      if (batchPages.length === 0) {
        break;
      }
      totalPages += batchPages.length;
      offset += batchSize;
      
      if (offset % 5000 === 0) {
        log(`📊 確認進行状況: ${offset}ページまで確認済み`);
      }
      
      // 安全のため、20000ページで制限
      if (offset >= 20000) {
        log(`⚠️ 安全のため20000ページで制限`);
        break;
      }
    }
    
    log(`📊 全ページ数: ${totalPages}ページ`);
    log(`📊 確認時間: ${Date.now() - startTime}ms`);

    // 2. 全ページの同期実行
    log('\n🔄 全ページの同期実行を開始...');
    
    const syncStartTime = Date.now();
    
    try {
      // 全ページを並列バッチで取得・同期
      const pages = await confluenceSyncService.getConfluencePagesBatch(totalPages, 50);
      log(`📊 全ページ取得完了: ${pages.length}ページ (${Date.now() - syncStartTime}ms)`);
      
      const syncResult = await confluenceSyncService.syncPagesParallel(pages, 30);
      const syncEndTime = Date.now();
      
      log(`📊 全ページ同期完了:`);
      log(`  追加: ${syncResult.added}ページ`);
      log(`  更新: ${syncResult.updated}ページ`);
      log(`  除外: ${syncResult.excluded}ページ`);
      log(`  エラー: ${syncResult.errors.length}ページ`);
      log(`  実行時間: ${syncEndTime - syncStartTime}ms`);
      
      // データベースの状態確認
      await confluenceSyncService.lancedbClient.connect();
      const table = await confluenceSyncService.lancedbClient.getTable();
      const dummyVector = new Array(768).fill(0);
      const allChunks = await table.search(dummyVector).limit(10000).toArray();
      
      log(`📊 全ページ後データベース: ${allChunks.length}チャンク`);
      
      // 重複チェック
      const chunksByPageId = new Map<number, any[]>();
      allChunks.forEach((chunk: any) => {
        const pageId = chunk.pageId;
        if (!chunksByPageId.has(pageId)) {
          chunksByPageId.set(pageId, []);
        }
        chunksByPageId.get(pageId)!.push(chunk);
      });

      let duplicatePages = 0;
      for (const [pageId, chunks] of chunksByPageId) {
        const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
        const uniqueIndexes = new Set(chunkIndexes);
        if (chunkIndexes.length !== uniqueIndexes.size) {
          duplicatePages++;
        }
      }

      log(`📊 全ページ重複チェック: 重複ページ=${duplicatePages}`);
      
      // ハイブリッド検索テスト
      const searchResult = await searchEngine.search({ query: '機能 要件', topK: 5 });
      log(`📊 全ページ検索テスト: ${searchResult.length}件の結果`);
      
      // パフォーマンス分析
      const pagesPerSecond = Math.round(pages.length / (syncEndTime - syncStartTime) * 1000);
      log(`📊 全ページパフォーマンス: ${pagesPerSecond}ページ/秒`);
      
      // メモリ使用量の確認
      const memUsage = process.memoryUsage();
      log(`📊 メモリ使用量: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      
    } catch (error) {
      log(`❌ 全ページ同期でエラー: ${error}`);
    }

    // 3. 最終的なデータベース状態確認
    log('\n📊 最終的なデータベース状態確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const finalChunks = await table.search(dummyVector).limit(10000).toArray();
    
    log(`📊 最終データベース: ${finalChunks.length}チャンク`);
    
    // 重複チェック
    const finalChunksByPageId = new Map<number, any[]>();
    finalChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!finalChunksByPageId.has(pageId)) {
        finalChunksByPageId.set(pageId, []);
      }
      finalChunksByPageId.get(pageId)!.push(chunk);
    });

    let finalDuplicatePages = 0;
    for (const [pageId, chunks] of finalChunksByPageId) {
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      if (chunkIndexes.length !== uniqueIndexes.size) {
        finalDuplicatePages++;
      }
    }

    log(`📊 最終重複チェック: 重複ページ=${finalDuplicatePages}`);

    // 4. ハイブリッド検索の最終テスト
    log('\n🔍 ハイブリッド検索の最終テスト...');
    
    const finalTestQueries = [
      '機能 要件 システム',
      '管理 フロー プロセス',
      'データベース 同期 更新',
      'API 連携 外部',
      'エラー 処理 例外'
    ];

    for (const query of finalTestQueries) {
      const searchStartTime = Date.now();
      const searchResults = await searchEngine.search({ query, topK: 5 });
      const searchTime = Date.now() - searchStartTime;
      
      log(`📝 "${query}": ${searchTime}ms, ${searchResults.length}件`);
    }

    // 5. 総合評価
    log('\n🎯 総合評価:');
    log('=' .repeat(50));
    
    const totalTime = Date.now() - startTime;
    
    log(`📊 実行統計:`);
    log(`  総実行時間: ${totalTime}ms`);
    log(`  総ページ数: ${totalPages}ページ`);
    log(`  最終チャンク数: ${finalChunks.length}チャンク`);
    log(`  重複ページ数: ${finalDuplicatePages}`);
    
    // 最終評価
    if (finalDuplicatePages === 0) {
      log(`\n🎉 重複ファイルは全く生成されていません！`);
    } else {
      log(`\n⚠️ 重複ファイルが生成されています: ${finalDuplicatePages}ページ`);
    }
    
    log(`\n✅ 本番環境全ページ同期完了！`);

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

runFullProductionSync().catch(console.error);
