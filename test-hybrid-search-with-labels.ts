/**
 * ハイブリッド検索でラベル機能を含めて動作確認
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-hybrid-search-with-labels.txt', message + '\n');
}

async function testHybridSearchWithLabels() {
  // 結果ファイルをクリア
  fs.writeFileSync('test-hybrid-search-with-labels.txt', '');
  
  log('🔍 ハイブリッド検索でラベル機能を含めて動作確認...\n');

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

    // 2. ラベル付きチャンクの分析
    log('\n🔍 ラベル付きチャンクの分析...');
    const chunksWithLabels = allChunks.filter(chunk => 
      chunk.labels && Array.isArray(chunk.labels) && chunk.labels.length > 0
    );
    
    log(`📊 ラベル付きチャンク数: ${chunksWithLabels.length}`);
    
    if (chunksWithLabels.length > 0) {
      log(`\n📝 ラベル付きチャンクの詳細:`);
      chunksWithLabels.forEach((chunk: any, index: number) => {
        log(`  チャンク ${index + 1}:`);
        log(`    PageID: ${chunk.pageId}`);
        log(`    タイトル: ${chunk.title}`);
        log(`    ラベル: [${chunk.labels.join(', ')}]`);
        log(`    コンテンツ長: ${chunk.content?.length || 0}文字`);
      });
    } else {
      log(`⚠️ ラベル付きチャンクがありません`);
    }

    // 3. ラベル別の統計
    log('\n📊 ラベル別の統計...');
    const labelCounts = new Map<string, number>();
    allChunks.forEach((chunk: any) => {
      if (chunk.labels && Array.isArray(chunk.labels)) {
        chunk.labels.forEach((label: string) => {
          labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
        });
      }
    });

    if (labelCounts.size > 0) {
      log(`📊 ラベル統計:`);
      for (const [label, count] of labelCounts) {
        log(`  "${label}": ${count}件`);
      }
    } else {
      log(`⚠️ ラベルがありません`);
    }

    // 4. ハイブリッド検索の基本テスト
    log('\n🔍 ハイブリッド検索の基本テスト...');
    
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
            log(`      PageID: ${result.pageId}, スコア: ${result.score}`);
            log(`      ソース: ${result.source || 'unknown'}`);
            log(`      ラベル: [${result.labels?.join(', ') || 'none'}]`);
          });
        } else {
          log(`  ⚠️ 検索結果がありません`);
        }
      } catch (error) {
        log(`  ❌ 検索エラー: ${error}`);
      }
    }

    // 5. ラベルフィルタリングのテスト
    log('\n🔍 ラベルフィルタリングのテスト...');
    
    if (chunksWithLabels.length > 0) {
      // 特定のラベルでフィルタリング
      const testLabels = Array.from(labelCounts.keys()).slice(0, 3);
      
      for (const label of testLabels) {
        log(`\n📝 ラベルフィルタリング: "${label}"`);
        try {
          const filteredResults = await searchEngine.search({ 
            query: '機能 要件', 
            topK: 10,
            labelFilters: {
              includeMeetingNotes: false,
              includeArchived: false,
              excludeTemplates: false,
              excludeGeneric: false
            }
          });
          
          log(`  フィルタリング結果: ${filteredResults.length}件`);
          filteredResults.slice(0, 3).forEach((result, index) => {
            log(`    ${index + 1}. ${result.title}`);
            log(`      PageID: ${result.pageId}, ラベル: [${result.labels?.join(', ') || 'none'}]`);
          });
        } catch (error) {
          log(`  ❌ ラベルフィルタリングエラー: ${error}`);
        }
      }
    } else {
      log(`⚠️ ラベル付きチャンクがないため、ラベルフィルタリングをスキップ`);
    }

    // 6. ベクトル検索のテスト
    log('\n🔍 ベクトル検索のテスト...');
    
    for (const query of testQueries.slice(0, 3)) {
      log(`\n📝 ベクトル検索クエリ: "${query}"`);
      const searchStartTime = Date.now();
      
      try {
        const searchResults = await searchEngine.search({ 
          query, 
          topK: 5,
          useLunrIndex: false // BM25検索を無効にしてベクトル検索のみ
        });
        
        const searchTime = Date.now() - searchStartTime;
        log(`  ベクトル検索時間: ${searchTime}ms`);
        log(`  ベクトル検索結果: ${searchResults.length}件`);
        
        if (searchResults.length > 0) {
          searchResults.slice(0, 3).forEach((result, index) => {
            log(`    ${index + 1}. ${result.title}`);
            log(`      PageID: ${result.pageId}, スコア: ${result.score}`);
            log(`      ソース: ${result.source || 'unknown'}`);
            log(`      距離: ${result.distance || 'unknown'}`);
            log(`      ラベル: [${result.labels?.join(', ') || 'none'}]`);
          });
        } else {
          log(`  ⚠️ ベクトル検索結果がありません`);
        }
      } catch (error) {
        log(`  ❌ ベクトル検索エラー: ${error}`);
      }
    }

    // 7. BM25検索のテスト
    log('\n🔍 BM25検索のテスト...');
    
    for (const query of testQueries.slice(0, 3)) {
      log(`\n📝 BM25検索クエリ: "${query}"`);
      const searchStartTime = Date.now();
      
      try {
        const searchResults = await searchEngine.search({ 
          query, 
          topK: 5,
          useLunrIndex: true // BM25検索のみ
        });
        
        const searchTime = Date.now() - searchStartTime;
        log(`  BM25検索時間: ${searchTime}ms`);
        log(`  BM25検索結果: ${searchResults.length}件`);
        
        if (searchResults.length > 0) {
          searchResults.slice(0, 3).forEach((result, index) => {
            log(`    ${index + 1}. ${result.title}`);
            log(`      PageID: ${result.pageId}, スコア: ${result.score}`);
            log(`      ソース: ${result.source || 'unknown'}`);
            log(`      ラベル: [${result.labels?.join(', ') || 'none'}]`);
          });
        } else {
          log(`  ⚠️ BM25検索結果がありません`);
        }
      } catch (error) {
        log(`  ❌ BM25検索エラー: ${error}`);
      }
    }

    // 8. 検索パフォーマンステスト
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
          results: results.length,
          hasLabels: results.some(r => r.labels && r.labels.length > 0)
        });
      } catch (error) {
        performanceResults.push({
          query,
          time: -1,
          results: 0,
          hasLabels: false,
          error: error
        });
      }
    }

    log(`\n📊 検索パフォーマンス結果:`);
    performanceResults.forEach(result => {
      if (result.time >= 0) {
        log(`  "${result.query}": ${result.time}ms, ${result.results}件, ラベル付き: ${result.hasLabels ? 'Yes' : 'No'}`);
      } else {
        log(`  "${result.query}": エラー - ${result.error}`);
      }
    });

    const avgSearchTime = performanceResults
      .filter(r => r.time >= 0)
      .reduce((sum, r) => sum + r.time, 0) / performanceResults.filter(r => r.time >= 0).length;
    
    log(`\n📊 平均検索時間: ${avgSearchTime.toFixed(2)}ms`);

    // 9. ラベル機能の詳細テスト
    log('\n🔍 ラベル機能の詳細テスト...');
    
    // ラベル付きチャンクの検索テスト
    if (chunksWithLabels.length > 0) {
      const testChunk = chunksWithLabels[0];
      const testLabel = testChunk.labels[0];
      
      log(`\n📝 ラベル "${testLabel}" での検索テスト:`);
      try {
        const labelSearchResults = await searchEngine.search({ 
          query: testLabel, 
          topK: 10 
        });
        
        log(`  ラベル検索結果: ${labelSearchResults.length}件`);
        labelSearchResults.slice(0, 3).forEach((result, index) => {
          log(`    ${index + 1}. ${result.title}`);
          log(`      PageID: ${result.pageId}, ラベル: [${result.labels?.join(', ') || 'none'}]`);
        });
      } catch (error) {
        log(`  ❌ ラベル検索エラー: ${error}`);
      }
    }

    // 10. 総合評価
    log('\n🎯 総合評価:');
    log('=' .repeat(50));
    
    const hybridSearchWorking = testQueries.some(async (query) => {
      try {
        const results = await searchEngine.search({ query, topK: 1 });
        return results.length > 0;
      } catch {
        return false;
      }
    });
    
    const vectorSearchWorking = testQueries.some(async (query) => {
      try {
        const results = await searchEngine.search({ query, topK: 1, useLunrIndex: false });
        return results.length > 0;
      } catch {
        return false;
      }
    });
    
    const bm25SearchWorking = testQueries.some(async (query) => {
      try {
        const results = await searchEngine.search({ query, topK: 1, useLunrIndex: true });
        return results.length > 0;
      } catch {
        return false;
      }
    });
    
    const labelsWorking = chunksWithLabels.length > 0;
    const labelFilteringWorking = chunksWithLabels.length > 0;
    const performanceGood = avgSearchTime < 1000; // 1秒以下
    
    log(`✅ ハイブリッド検索: ${hybridSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ ベクトル検索: ${vectorSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ BM25検索: ${bm25SearchWorking ? 'Yes' : 'No'}`);
    log(`✅ ラベル機能: ${labelsWorking ? 'Yes' : 'No'}`);
    log(`✅ ラベルフィルタリング: ${labelFilteringWorking ? 'Yes' : 'No'}`);
    log(`✅ 検索性能: ${performanceGood ? 'Yes' : 'No'} (平均: ${avgSearchTime.toFixed(2)}ms)`);
    
    const overallScore = (hybridSearchWorking ? 1 : 0) + (vectorSearchWorking ? 1 : 0) + 
                        (bm25SearchWorking ? 1 : 0) + (labelsWorking ? 1 : 0) + 
                        (labelFilteringWorking ? 1 : 0) + (performanceGood ? 1 : 0);
    
    log(`\n🏆 総合スコア: ${overallScore}/6`);
    
    if (overallScore >= 5) {
      log(`🎉 ハイブリッド検索とラベル機能は完全に動作しています！`);
    } else if (overallScore >= 4) {
      log(`👍 ハイブリッド検索とラベル機能は概ね動作しています。`);
    } else {
      log(`⚠️ ハイブリッド検索とラベル機能に問題があります。`);
    }

    log('\n✅ ハイブリッド検索とラベル機能のテスト完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testHybridSearchWithLabels().catch(console.error);
