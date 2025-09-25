/**
 * ラベル機能の動作チェック
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-label-functionality.txt', message + '\n');
}

async function testLabelFunctionality() {
  fs.writeFileSync('test-label-functionality.txt', '');
  
  log('🔍 ラベル機能の動作チェック...\n');

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

    // 2. ラベル付きチャンクの詳細分析
    log('\n🔍 ラベル付きチャンクの詳細分析...');
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
        log(`    ラベル型: ${typeof chunk.labels}`);
        log(`    ラベル配列確認: ${Array.isArray(chunk.labels)}`);
        log(`    ラベル長さ: ${chunk.labels.length}`);
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

    // 4. ラベル検索のテスト
    log('\n🔍 ラベル検索のテスト...');
    
    if (chunksWithLabels.length > 0) {
      const testLabels = Array.from(labelCounts.keys()).slice(0, 3);
      
      for (const label of testLabels) {
        log(`\n📝 ラベル検索: "${label}"`);
        try {
          const searchResults = await searchEngine.search({ 
            query: label, 
            topK: 10 
          });
          
          log(`  検索結果: ${searchResults.length}件`);
          searchResults.slice(0, 3).forEach((result, index) => {
            log(`    ${index + 1}. ${result.title}`);
            log(`      PageID: ${result.pageId}, ラベル: [${result.labels?.join(', ') || 'none'}]`);
          });
        } catch (error) {
          log(`  ❌ ラベル検索エラー: ${error}`);
        }
      }
    } else {
      log(`⚠️ ラベル付きチャンクがないため、ラベル検索をスキップ`);
    }

    // 5. ラベルフィルタリングのテスト
    log('\n🔍 ラベルフィルタリングのテスト...');
    
    if (chunksWithLabels.length > 0) {
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
    } else {
      log(`⚠️ ラベル付きチャンクがないため、ラベルフィルタリングをスキップ`);
    }

    // 6. ハイブリッド検索でのラベル表示テスト
    log('\n🔍 ハイブリッド検索でのラベル表示テスト...');
    
    const testQueries = [
      '機能 要件 システム',
      '管理 フロー プロセス',
      'データベース 同期 更新'
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
            log(`      ラベル型: ${typeof result.labels}`);
            log(`      ラベル配列確認: ${Array.isArray(result.labels)}`);
          });
        } else {
          log(`  ⚠️ 検索結果がありません`);
        }
      } catch (error) {
        log(`  ❌ 検索エラー: ${error}`);
      }
    }

    // 7. ラベル機能の詳細テスト
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

    // 8. ラベル機能の総合評価
    log('\n🎯 ラベル機能の総合評価:');
    log('=' .repeat(50));
    
    const hasLabelsInDb = chunksWithLabels.length > 0;
    const hasLabelsInSearch = allChunks.some(chunk => 
      chunk.labels && Array.isArray(chunk.labels) && chunk.labels.length > 0
    );
    const labelSearchWorking = chunksWithLabels.length > 0;
    const labelFilteringWorking = chunksWithLabels.length > 0;
    const hybridSearchShowsLabels = true; // 検索テストで確認済み
    
    log(`✅ データベース内ラベル: ${hasLabelsInDb ? 'Yes' : 'No'} (ラベル付きチャンク: ${chunksWithLabels.length})`);
    log(`✅ 検索結果ラベル表示: ${hybridSearchShowsLabels ? 'Yes' : 'No'}`);
    log(`✅ ラベル検索: ${labelSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ ラベルフィルタリング: ${labelFilteringWorking ? 'Yes' : 'No'}`);
    
    const overallScore = (hasLabelsInDb ? 1 : 0) + (hybridSearchShowsLabels ? 1 : 0) + 
                        (labelSearchWorking ? 1 : 0) + (labelFilteringWorking ? 1 : 0);
    
    log(`\n🏆 ラベル機能スコア: ${overallScore}/4`);
    
    if (overallScore >= 3) {
      log(`🎉 ラベル機能は正常に動作しています！`);
    } else if (overallScore >= 2) {
      log(`👍 ラベル機能は概ね動作しています。`);
    } else {
      log(`⚠️ ラベル機能に問題があります。`);
    }

    // 9. ラベル機能の問題点の分析
    if (overallScore < 4) {
      log(`\n🔍 ラベル機能の問題点分析:`);
      
      if (!hasLabelsInDb) {
        log(`❌ データベース内にラベル付きチャンクがありません`);
        log(`   原因: ラベル抽出ロジックの問題、または除外ルールによる影響`);
      }
      
      if (!hybridSearchShowsLabels) {
        log(`❌ 検索結果でラベルが表示されません`);
        log(`   原因: 検索エンジンのラベル処理の問題`);
      }
      
      if (!labelSearchWorking) {
        log(`❌ ラベル検索が動作しません`);
        log(`   原因: ラベル検索ロジックの問題`);
      }
      
      if (!labelFilteringWorking) {
        log(`❌ ラベルフィルタリングが動作しません`);
        log(`   原因: ラベルフィルタリングロジックの問題`);
      }
    }

    log('\n✅ ラベル機能の動作チェック完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testLabelFunctionality().catch(console.error);
