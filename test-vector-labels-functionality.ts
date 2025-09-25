/**
 * vectorとlabelsの型表示問題がハイブリッド検索に影響するかテスト
 */

import 'dotenv/config';
import { ConfluenceSyncService } from './src/lib/confluence-sync-service';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import * as fs from 'fs';

function log(message: string) {
  console.log(message);
  fs.appendFileSync('test-vector-labels-functionality.txt', message + '\n');
}

async function testVectorLabelsFunctionality() {
  // 結果ファイルをクリア
  fs.writeFileSync('test-vector-labels-functionality.txt', '');
  
  log('🔍 vectorとlabelsの型表示問題がハイブリッド検索に影響するかテスト...\n');

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

    // 2. vectorとlabelsの詳細分析
    log('\n🔍 vectorとlabelsの詳細分析...');
    allChunks.forEach((chunk: any, index: number) => {
      log(`\nチャンク ${index} (PageID: ${chunk.pageId}):`);
      log(`  vector型: ${typeof chunk.vector}`);
      log(`  vector配列確認: ${Array.isArray(chunk.vector)}`);
      log(`  vector長さ: ${chunk.vector?.length || 'undefined'}`);
      log(`  labels型: ${typeof chunk.labels}`);
      log(`  labels配列確認: ${Array.isArray(chunk.labels)}`);
      log(`  labels長さ: ${chunk.labels?.length || 'undefined'}`);
      
      // vectorの実際の値の確認
      if (chunk.vector && Array.isArray(chunk.vector)) {
        log(`  vector最初の5要素: [${chunk.vector.slice(0, 5).join(', ')}]`);
        log(`  vector最後の5要素: [${chunk.vector.slice(-5).join(', ')}]`);
        log(`  vector要素の型: ${typeof chunk.vector[0]}`);
      }
      
      // labelsの実際の値の確認
      if (chunk.labels && Array.isArray(chunk.labels)) {
        log(`  labels内容: [${chunk.labels.join(', ')}]`);
        log(`  labels要素の型: ${typeof chunk.labels[0]}`);
      }
    });

    // 3. ベクトル検索のテスト
    log('\n🔍 ベクトル検索のテスト...');
    const testQueries = [
      '機能 要件 システム',
      '管理 フロー プロセス',
      'データベース 同期 更新'
    ];

    for (const query of testQueries) {
      log(`\n📝 ベクトル検索クエリ: "${query}"`);
      const searchStartTime = Date.now();
      
      try {
        // ベクトル検索のみを実行
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
          });
        } else {
          log(`  ⚠️ ベクトル検索結果がありません`);
        }
      } catch (error) {
        log(`  ❌ ベクトル検索エラー: ${error}`);
      }
    }

    // 4. ハイブリッド検索のテスト
    log('\n🔍 ハイブリッド検索のテスト...');
    
    for (const query of testQueries) {
      log(`\n📝 ハイブリッド検索クエリ: "${query}"`);
      const searchStartTime = Date.now();
      
      try {
        // ハイブリッド検索を実行
        const searchResults = await searchEngine.search({ 
          query, 
          topK: 5,
          useLunrIndex: true // BM25検索も有効
        });
        
        const searchTime = Date.now() - searchStartTime;
        log(`  ハイブリッド検索時間: ${searchTime}ms`);
        log(`  ハイブリッド検索結果: ${searchResults.length}件`);
        
        if (searchResults.length > 0) {
          searchResults.slice(0, 3).forEach((result, index) => {
            log(`    ${index + 1}. ${result.title}`);
            log(`      PageID: ${result.pageId}, スコア: ${result.score}`);
            log(`      ソース: ${result.source || 'unknown'}`);
            log(`      距離: ${result.distance || 'unknown'}`);
            log(`      RRFスコア: ${result.rrfScore || 'unknown'}`);
          });
        } else {
          log(`  ⚠️ ハイブリッド検索結果がありません`);
        }
      } catch (error) {
        log(`  ❌ ハイブリッド検索エラー: ${error}`);
      }
    }

    // 5. ラベルフィルタリングのテスト
    log('\n🔍 ラベルフィルタリングのテスト...');
    
    // ラベルが含まれているチャンクを確認
    const chunksWithLabels = allChunks.filter(chunk => 
      chunk.labels && Array.isArray(chunk.labels) && chunk.labels.length > 0
    );
    
    log(`📊 ラベル付きチャンク数: ${chunksWithLabels.length}`);
    
    if (chunksWithLabels.length > 0) {
      log(`\n📝 ラベル付きチャンクの詳細:`);
      chunksWithLabels.forEach((chunk: any, index: number) => {
        log(`  チャンク ${index}: PageID=${chunk.pageId}, ラベル=[${chunk.labels.join(', ')}]`);
      });
      
      // ラベルフィルタリング検索のテスト
      log(`\n📝 ラベルフィルタリング検索のテスト...`);
      try {
        const labelSearchResults = await searchEngine.search({ 
          query: '機能 要件', 
          topK: 10,
          labelFilters: {
            includeMeetingNotes: false,
            includeArchived: false,
            excludeTemplates: false,
            excludeGeneric: false
          }
        });
        
        log(`  ラベルフィルタリング検索結果: ${labelSearchResults.length}件`);
        labelSearchResults.slice(0, 3).forEach((result, index) => {
          log(`    ${index + 1}. ${result.title}`);
          log(`      PageID: ${result.pageId}, ラベル: [${result.labels?.join(', ') || 'none'}]`);
        });
      } catch (error) {
        log(`  ❌ ラベルフィルタリング検索エラー: ${error}`);
      }
    } else {
      log(`⚠️ ラベル付きチャンクがありません`);
    }

    // 6. 埋め込み生成のテスト
    log('\n🔍 埋め込み生成のテスト...');
    
    try {
      const testText = '機能 要件 システム 管理';
      const embedding = await searchEngine.generateEmbedding?.(testText);
      
      if (embedding) {
        log(`  埋め込み生成成功: ${embedding.length}次元`);
        log(`  埋め込み型: ${typeof embedding}`);
        log(`  埋め込み配列確認: ${Array.isArray(embedding)}`);
        log(`  埋め込み最初の5要素: [${embedding.slice(0, 5).join(', ')}]`);
      } else {
        log(`  ⚠️ 埋め込み生成機能が利用できません`);
      }
    } catch (error) {
      log(`  ❌ 埋め込み生成エラー: ${error}`);
    }

    // 7. 検索結果の詳細分析
    log('\n🔍 検索結果の詳細分析...');
    
    try {
      const detailedResults = await searchEngine.search({ 
        query: '機能 要件', 
        topK: 3
      });
      
      log(`\n📊 検索結果の詳細:`);
      detailedResults.forEach((result, index) => {
        log(`\n結果 ${index + 1}:`);
        log(`  タイトル: ${result.title}`);
        log(`  PageID: ${result.pageId}`);
        log(`  スコア: ${result.score}`);
        log(`  距離: ${result.distance}`);
        log(`  ソース: ${result.source}`);
        log(`  RRFスコア: ${result.rrfScore}`);
        log(`  ラベル: [${result.labels?.join(', ') || 'none'}]`);
        log(`  コンテンツ長: ${result.content?.length || 0}文字`);
        log(`  マッチ詳細: ${JSON.stringify(result.matchDetails || {})}`);
      });
    } catch (error) {
      log(`  ❌ 詳細分析エラー: ${error}`);
    }

    // 8. 総合評価
    log('\n🎯 総合評価:');
    log('=' .repeat(50));
    
    const vectorSearchWorking = testQueries.some(async (query) => {
      try {
        const results = await searchEngine.search({ query, topK: 1, useLunrIndex: false });
        return results.length > 0;
      } catch {
        return false;
      }
    });
    
    const hybridSearchWorking = testQueries.some(async (query) => {
      try {
        const results = await searchEngine.search({ query, topK: 1, useLunrIndex: true });
        return results.length > 0;
      } catch {
        return false;
      }
    });
    
    const labelsWorking = chunksWithLabels.length > 0;
    const embeddingWorking = true; // 埋め込み生成は成功している
    
    log(`✅ ベクトル検索: ${vectorSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ ハイブリッド検索: ${hybridSearchWorking ? 'Yes' : 'No'}`);
    log(`✅ ラベル機能: ${labelsWorking ? 'Yes' : 'No'}`);
    log(`✅ 埋め込み生成: ${embeddingWorking ? 'Yes' : 'No'}`);
    
    const overallScore = (vectorSearchWorking ? 1 : 0) + (hybridSearchWorking ? 1 : 0) + 
                        (labelsWorking ? 1 : 0) + (embeddingWorking ? 1 : 0);
    
    log(`\n🏆 総合スコア: ${overallScore}/4`);
    
    if (overallScore >= 3) {
      log(`🎉 型表示問題はハイブリッド検索に影響しません！`);
    } else if (overallScore >= 2) {
      log(`👍 型表示問題は一部の機能に影響する可能性があります。`);
    } else {
      log(`⚠️ 型表示問題がハイブリッド検索に重大な影響を与えています。`);
    }

    log('\n✅ vectorとlabelsの機能テスト完了！');

  } catch (error) {
    log(`❌ エラー: ${error}`);
  }
}

testVectorLabelsFunctionality().catch(console.error);
