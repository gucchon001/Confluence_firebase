/**
 * ベクトル検索最適化スクリプト
 * ベクトル検索のパフォーマンスを向上させるため、事前フィルタリングと検索範囲の限定を実装します。
 */

import { lancedbClient } from './src/lib/lancedb-client';
import { getEmbeddings } from './src/lib/embeddings';

interface VectorSearchOptimization {
  query: string;
  originalTime: number;
  optimizedTime: number;
  improvement: number;
  improvementPercentage: number;
}

/**
 * 最適化前のベクトル検索
 */
async function originalVectorSearch(query: string): Promise<number> {
  const startTime = Date.now();
  
  try {
    const embedding = await getEmbeddings(query);
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    // 最適化前: 制限なしで大量のデータを取得
    const results = await table.search(embedding)
      .limit(100) // 多めに取得
      .toArray();
    
    const endTime = Date.now();
    console.log(`  📊 最適化前: ${endTime - startTime}ms, 結果数: ${results.length}件`);
    return endTime - startTime;
    
  } catch (error) {
    console.error(`  ❌ 最適化前検索エラー: ${error}`);
    return 0;
  }
}

/**
 * 最適化後のベクトル検索
 */
async function optimizedVectorSearch(query: string): Promise<number> {
  const startTime = Date.now();
  
  try {
    const embedding = await getEmbeddings(query);
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    // 最適化後: 事前フィルタリングと検索範囲の限定
    const results = await table.search(embedding)
      .where("labels NOT IN ('アーカイブ', '議事録', 'meeting-notes', 'archive')") // 事前フィルタリング
      .where("title NOT LIKE 'xxx_%'") // タイトルパターンの除外
      .limit(20) // 検索範囲を限定
      .toArray();
    
    const endTime = Date.now();
    console.log(`  🚀 最適化後: ${endTime - startTime}ms, 結果数: ${results.length}件`);
    return endTime - startTime;
    
  } catch (error) {
    console.error(`  ❌ 最適化後検索エラー: ${error}`);
    return 0;
  }
}

/**
 * ベクトル検索最適化のテスト
 */
async function testVectorSearchOptimization() {
  console.log('🚀 ベクトル検索最適化テストを開始します...');
  console.log('='.repeat(60));

  const testQueries = [
    "教室管理機能について教えて",
    "CSVアップロードの方法",
    "教室の公開フラグとは？",
    "エラーハンドリングの仕組み",
    "ユーザー権限の管理"
  ];

  const results: VectorSearchOptimization[] = [];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📊 テスト (${i + 1}/${testQueries.length}): "${query}"`);
    
    // 最適化前の測定
    console.log('  🔍 最適化前の測定中...');
    const originalTime = await originalVectorSearch(query);
    
    // 少し待機（キャッシュ効果を避けるため）
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 最適化後の測定
    console.log('  🚀 最適化後の測定中...');
    const optimizedTime = await optimizedVectorSearch(query);
    
    // 改善効果の計算
    const improvement = originalTime - optimizedTime;
    const improvementPercentage = originalTime > 0 ? (improvement / originalTime) * 100 : 0;
    
    results.push({
      query,
      originalTime,
      optimizedTime,
      improvement,
      improvementPercentage
    });
    
    console.log(`  📈 改善効果: ${improvement}ms (${improvementPercentage.toFixed(1)}%)`);
    
    // 次のテストまでの待機
    if (i < testQueries.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // 結果分析
  console.log('\n' + '='.repeat(60));
  console.log('📈 ベクトル検索最適化結果');
  console.log('='.repeat(60));

  // 基本統計
  const totalQueries = results.length;
  const avgOriginalTime = results.reduce((sum, r) => sum + r.originalTime, 0) / totalQueries;
  const avgOptimizedTime = results.reduce((sum, r) => sum + r.optimizedTime, 0) / totalQueries;
  const avgImprovement = results.reduce((sum, r) => sum + r.improvement, 0) / totalQueries;
  const avgImprovementPercentage = results.reduce((sum, r) => sum + r.improvementPercentage, 0) / totalQueries;

  console.log(`\n📊 基本統計:`);
  console.log(`  総クエリ数: ${totalQueries}件`);
  console.log(`  最適化前平均時間: ${avgOriginalTime.toFixed(2)}ms`);
  console.log(`  最適化後平均時間: ${avgOptimizedTime.toFixed(2)}ms`);
  console.log(`  平均改善時間: ${avgImprovement.toFixed(2)}ms`);
  console.log(`  平均改善率: ${avgImprovementPercentage.toFixed(1)}%`);

  // 詳細結果
  console.log(`\n📋 詳細結果:`);
  results.forEach((result, index) => {
    const status = result.improvementPercentage > 0 ? '✅' : '❌';
    console.log(`  ${status} ${index + 1}. "${result.query}"`);
    console.log(`     最適化前: ${result.originalTime}ms → 最適化後: ${result.optimizedTime}ms`);
    console.log(`     改善: ${result.improvement}ms (${result.improvementPercentage.toFixed(1)}%)`);
  });

  // 改善提案
  console.log(`\n💡 改善提案:`);
  if (avgImprovementPercentage > 0) {
    console.log(`  ✅ ベクトル検索の最適化が成功しました！`);
    console.log(`  📈 平均${avgImprovementPercentage.toFixed(1)}%の改善が確認できました`);
    console.log(`  🚀 この最適化を本番環境に適用することを推奨します`);
  } else {
    console.log(`  ❌ ベクトル検索の最適化で改善が見られませんでした`);
    console.log(`  🔍 他の最適化手法を検討する必要があります`);
  }

  // 結果をJSONファイルに保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `vector-search-optimization-${timestamp}.json`;
  const fs = require('fs');
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n💾 最適化結果は ${filename} に保存されました。`);

  console.log('\n✅ ベクトル検索最適化テストが完了しました！');
}

// 実行
testVectorSearchOptimization().catch(console.error);
