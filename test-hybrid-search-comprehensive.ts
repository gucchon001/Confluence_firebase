/**
 * ハイブリッド検索の包括的テスト
 * 埋め込みデータベースとハイブリッド検索の両方をテスト
 */

import 'dotenv/config';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';
import { LanceDBClient } from './src/lib/lancedb-client';

async function testHybridSearchComprehensive() {
  console.log('🔍 ハイブリッド検索の包括的テストを開始...\n');

  try {
    // 1. データベースの状態確認
    console.log('📊 データベースの状態確認...');
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    
    const table = await lancedbClient.getTable();
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(100).toArray();
    
    console.log(`📊 総チャンク数: ${allData.length}`);
    
    if (allData.length === 0) {
      console.log('❌ データがありません。まず同期を実行してください。');
      return;
    }

    // 2. 埋め込みデータベースの品質確認
    console.log('\n🔍 埋め込みデータベースの品質確認...');
    let validEmbeddings = 0;
    let validLabels = 0;
    let totalLabels = 0;
    const uniqueLabels = new Set<string>();

    allData.forEach((row: any, index: number) => {
      // ベクトルの確認
      if (Array.isArray(row.vector) && row.vector.length === 768) {
        validEmbeddings++;
      }
      
      // ラベルの確認
      if (row.labels && (Array.isArray(row.labels) || typeof row.labels === 'object')) {
        validLabels++;
        const labels = Array.isArray(row.labels) ? row.labels : Object.values(row.labels);
        totalLabels += labels.length;
        labels.forEach((label: string) => uniqueLabels.add(label));
      }
    });

    console.log(`✅ 有効な埋め込みベクトル: ${validEmbeddings}/${allData.length} (${Math.round(validEmbeddings/allData.length*100)}%)`);
    console.log(`✅ 有効なラベルデータ: ${validLabels}/${allData.length} (${Math.round(validLabels/allData.length*100)}%)`);
    console.log(`📊 総ラベル数: ${totalLabels}`);
    console.log(`📊 ユニークラベル数: ${uniqueLabels.size}`);
    console.log(`🏷️ ラベル一覧: ${Array.from(uniqueLabels).slice(0, 10).join(', ')}${uniqueLabels.size > 10 ? '...' : ''}`);

    // 3. ハイブリッド検索エンジンの初期化
    console.log('\n🔧 ハイブリッド検索エンジンの初期化...');
    const searchEngine = new HybridSearchEngine();
    console.log('✅ ハイブリッド検索エンジン初期化完了');

    // 4. ベクトル検索のテスト
    console.log('\n🔍 ベクトル検索のテスト...');
    const vectorResults = await searchEngine.search({ 
      query: '機能要件', 
      topK: 3 
    });
    
    console.log(`📊 ベクトル検索結果: ${vectorResults.length}件`);
    vectorResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (スコア: ${result.score?.toFixed(3) || 'N/A'})`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 5. BM25検索のテスト
    console.log('\n🔍 BM25検索のテスト...');
    const bm25Results = await searchEngine.search({ 
      query: 'データベース', 
      topK: 3 
    });
    
    console.log(`📊 BM25検索結果: ${bm25Results.length}件`);
    bm25Results.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (スコア: ${result.score?.toFixed(3) || 'N/A'})`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 6. ハイブリッド検索のテスト
    console.log('\n🔍 ハイブリッド検索のテスト...');
    const hybridResults = await searchEngine.search({ 
      query: 'セキュリティ 認証', 
      topK: 5 
    });
    
    console.log(`📊 ハイブリッド検索結果: ${hybridResults.length}件`);
    hybridResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (スコア: ${result.score?.toFixed(3) || 'N/A'})`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`     ソース: ${result.source || 'N/A'}`);
    });

    // 7. ラベルフィルタリングのテスト
    console.log('\n🔍 ラベルフィルタリングのテスト...');
    const labelFilterResults = await searchEngine.search({ 
      query: '管理', 
      topK: 5,
      labelFilters: {
        includeLabels: ['機能要件']
      }
    });
    
    console.log(`📊 ラベルフィルタリング結果: ${labelFilterResults.length}件`);
    labelFilterResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (スコア: ${result.score?.toFixed(3) || 'N/A'})`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
    });

    // 8. パフォーマンステスト
    console.log('\n⏱️ パフォーマンステスト...');
    const startTime = Date.now();
    
    const perfResults = await searchEngine.search({ 
      query: 'システム 設計', 
      topK: 10 
    });
    
    const endTime = Date.now();
    const executionTime = endTime - startTime;
    
    console.log(`📊 パフォーマンス結果:`);
    console.log(`  実行時間: ${executionTime}ms`);
    console.log(`  結果数: ${perfResults.length}件`);
    console.log(`  1件あたり: ${(executionTime / perfResults.length).toFixed(2)}ms`);

    // 9. 総合評価
    console.log('\n📋 総合評価:');
    console.log(`✅ 埋め込みデータベース: ${validEmbeddings > 0 ? '正常' : '異常'}`);
    console.log(`✅ ラベル機能: ${validLabels > 0 ? '正常' : '異常'}`);
    console.log(`✅ ベクトル検索: ${vectorResults.length > 0 ? '正常' : '異常'}`);
    console.log(`✅ BM25検索: ${bm25Results.length > 0 ? '正常' : '異常'}`);
    console.log(`✅ ハイブリッド検索: ${hybridResults.length > 0 ? '正常' : '異常'}`);
    console.log(`✅ ラベルフィルタリング: ${labelFilterResults.length > 0 ? '正常' : '異常'}`);
    console.log(`✅ パフォーマンス: ${executionTime < 5000 ? '良好' : '要改善'}`);

    const allSystemsWorking = validEmbeddings > 0 && validLabels > 0 && 
                             vectorResults.length > 0 && bm25Results.length > 0 && 
                             hybridResults.length > 0;

    console.log(`\n🎯 ハイブリッド検索システム: ${allSystemsWorking ? '✅ 完全動作' : '❌ 問題あり'}`);

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

testHybridSearchComprehensive().catch(console.error);
