/**
 * 重複ファイルとハイブリッド検索の対応状況を調査
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('investigate-duplicates-and-search.txt', message + '\n');
}

async function investigateDuplicatesAndSearch() {
  // 結果ファイルをクリア
  fs.writeFileSync('investigate-duplicates-and-search.txt', '');
  
  log('🔍 重複ファイルとハイブリッド検索の対応状況を調査...\n');

  try {
    const confluenceSyncService = new ConfluenceSyncService();
    const searchEngine = new HybridSearchEngine();

    // 1. データベースの状態確認
    log('📊 データベースの状態確認...');
    await confluenceSyncService.lancedbClient.connect();
    const table = await confluenceSyncService.lancedbClient.getTable();
    
    const dummyVector = new Array(768).fill(0);
    const allChunks = await table.search(dummyVector).limit(10000).toArray();
    log(`📊 総チャンク数: ${allChunks.length}`);

    // 2. ページIDごとのチャンク数を詳細分析
    const chunksByPageId = new Map<number, any[]>();
    allChunks.forEach((chunk: any) => {
      const pageId = chunk.pageId;
      if (!chunksByPageId.has(pageId)) {
        chunksByPageId.set(pageId, []);
      }
      chunksByPageId.get(pageId)!.push(chunk);
    });

    log(`\n📊 ページIDごとのチャンク数分析:`);
    let totalPages = 0;
    let totalChunks = 0;
    let duplicatePages = 0;
    let normalPages = 0;
    let pagesWithMultipleChunks = 0;

    for (const [pageId, chunks] of chunksByPageId) {
      totalPages++;
      totalChunks += chunks.length;
      
      // チャンクを枝番順にソート
      chunks.sort((a: any, b: any) => a.chunkIndex - b.chunkIndex);
      
      // 重複チェック
      const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
      const uniqueIndexes = new Set(chunkIndexes);
      
      if (chunkIndexes.length !== uniqueIndexes.size) {
        duplicatePages++;
        log(`  ⚠️ ページID ${pageId}: ${chunks.length}チャンク (重複あり)`);
        chunks.forEach((chunk: any, index: number) => {
          log(`    チャンク ${index}: 枝番=${chunk.chunkIndex}, 更新日時=${chunk.lastUpdated}`);
        });
      } else if (chunks.length > 1) {
        pagesWithMultipleChunks++;
        log(`  ✅ ページID ${pageId}: ${chunks.length}チャンク (正常な複数チャンク)`);
        chunks.forEach((chunk: any, index: number) => {
          log(`    チャンク ${index}: 枝番=${chunk.chunkIndex}, 更新日時=${chunk.lastUpdated}`);
        });
      } else {
        normalPages++;
        log(`  ✅ ページID ${pageId}: ${chunks.length}チャンク (正常)`);
      }
    }

    // 3. 重複統計
    log(`\n📊 重複統計:`);
    log(`  総ページ数: ${totalPages}`);
    log(`  総チャンク数: ${totalChunks}`);
    log(`  重複ページ数: ${duplicatePages}`);
    log(`  正常ページ数: ${normalPages}`);
    log(`  複数チャンクページ数: ${pagesWithMultipleChunks}`);
    log(`  平均チャンク数: ${(totalChunks / totalPages).toFixed(2)}`);

    // 4. 重複の詳細分析
    if (duplicatePages > 0) {
      log(`\n🔍 重複の詳細分析:`);
      for (const [pageId, chunks] of chunksByPageId) {
        const chunkIndexes = chunks.map((c: any) => c.chunkIndex);
        const uniqueIndexes = new Set(chunkIndexes);
        
        if (chunkIndexes.length !== uniqueIndexes.size) {
          log(`  ページID ${pageId} の重複パターン:`);
          const indexCounts = new Map<number, number>();
          chunkIndexes.forEach(index => {
            indexCounts.set(index, (indexCounts.get(index) || 0) + 1);
          });
          
          for (const [index, count] of indexCounts) {
            if (count > 1) {
              log(`    枝番 ${index}: ${count}個の重複`);
            }
          }
        }
      }
    }

    // 5. ハイブリッド検索のテスト
    log('\n🔍 ハイブリッド検索のテスト...');
    
    const testQueries = [
      '機能 要件 システム',
      '管理 フロー プロセス',
      'データベース 同期 更新',
      'API 連携 外部',
      'エラー 処理 例外'
    ];

    for (const query of testQueries) {
      log(`\n📝 検索クエリ: "${query}"`);
      const searchStartTime = Date.now();
      
      try {
        const searchResults = await searchEngine.search({ 
          query, 
          topK: 5 
        });
        
        const searchTime = Date.now() - searchStartTime;
        log(`  検索時間: ${searchTime}ms`);
        log(`  検索結果: ${searchResults.length}件`);
        
        if (searchResults.length > 0) {
          searchResults.slice(0, 3).forEach((result, index) => {
            log(`    ${index + 1}. ${result.title}`);
            log(`       PageID: ${result.pageId}, スコア: ${result.score}`);
            log(`       ソース: ${result.source || 'unknown'}`);
          });
        } else {
          log(`  ⚠️ 検索結果がありません`);
        }
      } catch (error) {
        log(`  ❌ 検索エラー: ${error}`);
      }
    }

    // 6. 検索パフォーマンステスト
    log('\n⚡ 検索パフォーマンステスト...');
    const performanceQueries = [
      'システム',
      '管理',
      'データ',
      'API',
      'エラー'
    ];

    const performanceResults = [];
    for (const query of performanceQueries) {
      const startTime = Date.now();
      try {
        const results = await searchEngine.search({ query, topK: 10 });
        const endTime = Date.now();
        performanceResults.push({
          query,
          time: endTime - startTime,
          results: results.length
        });
      } catch (error) {
        performanceResults.push({
          query,
          time: -1,
          results: 0,
          error: error
        });
      }
    }

    log(`\n📊 検索パフォーマンス結果:`);
    performanceResults.forEach(result => {
      if (result.time >= 0) {
        log(`  "${result.query}": ${result.time}ms, ${result.results}件`);
      } else {
        log(`  "${result.query}": エラー - ${result.error}`);
      }
    });

    const avgSearchTime = performanceResults
      .filter(r => r.time >= 0)
      .reduce((sum, r) => sum + r.time, 0) / performanceResults.filter(r => r.time >= 0).length;
    
    log(`\n📊 平均検索時間: ${avgSearchTime.toFixed(2)}ms`);

    // 7. データ品質チェック
    log('\n🔍 データ品質チェック...');
    let qualityIssues = 0;
    
    allChunks.forEach((chunk: any, index: number) => {
      const issues = [];
      
      if (!chunk.pageId || typeof chunk.pageId !== 'number') {
        issues.push('pageIdが無効');
      }
      if (!chunk.title || typeof chunk.title !== 'string') {
        issues.push('titleが無効');
      }
      if (!chunk.content || typeof chunk.content !== 'string') {
        issues.push('contentが無効');
      }
      if (!chunk.vector || !Array.isArray(chunk.vector) || chunk.vector.length !== 768) {
        issues.push('vectorが無効');
      }
      if (!chunk.labels || !Array.isArray(chunk.labels)) {
        issues.push('labelsが無効');
      }
      if (!chunk.lastUpdated || typeof chunk.lastUpdated !== 'string') {
        issues.push('lastUpdatedが無効');
      }
      
      if (issues.length > 0) {
        qualityIssues++;
        log(`  チャンク ${index}: ${issues.join(', ')}`);
      }
    });

    log(`\n📊 データ品質統計:`);
    log(`  総チャンク数: ${allChunks.length}`);
    log(`  品質問題チャンク数: ${qualityIssues}`);
    log(`  品質問題率: ${(qualityIssues / allChunks.length * 100).toFixed(2)}%`);

    // 8. 総合評価
    log('\n🎯 総合評価:');
    log('=' .repeat(50));
    
    const isNoDuplicates = duplicatePages === 0;
    const isSearchWorking = performanceResults.some(r => r.results > 0);
    const isDataQualityGood = qualityIssues / allChunks.length < 0.1; // 10%以下
    const isPerformanceGood = avgSearchTime < 1000; // 1秒以下
    
    log(`✅ 重複なし: ${isNoDuplicates ? 'Yes' : 'No'} (重複ページ: ${duplicatePages})`);
    log(`✅ 検索機能: ${isSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ データ品質: ${isDataQualityGood ? 'Yes' : 'No'} (問題率: ${(qualityIssues / allChunks.length * 100).toFixed(2)}%)`);
    log(`✅ 検索性能: ${isPerformanceGood ? 'Yes' : 'No'} (平均: ${avgSearchTime.toFixed(2)}ms)`);
    
    const overallScore = (isNoDuplicates ? 1 : 0) + (isSearchWorking ? 1 : 0) + 
                        (isDataQualityGood ? 1 : 0) + (isPerformanceGood ? 1 : 0);
    
    log(`\n🏆 総合スコア: ${overallScore}/4`);
    
    if (overallScore >= 3) {
      log(`🎉 システムは正常に動作しています！`);
    } else if (overallScore >= 2) {
      log(`👍 システムは概ね正常に動作しています。`);
    } else {
      log(`⚠️ システムに問題があります。`);
    }

    log('\n✅ 重複ファイルとハイブリッド検索の調査完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

investigateDuplicatesAndSearch().catch(console.error);
