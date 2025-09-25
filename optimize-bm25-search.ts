/**
 * BM25検索最適化スクリプト
 * Lunr.jsのBM25検索のパフォーマンスを向上させるため、インデックス最適化と検索範囲の限定を実装します。
 */

import { lunrInitializer } from './src/lib/lunr-initializer';
import { lunrSearchClient } from './src/lib/lunr-search-client';

interface BM25SearchOptimization {
  query: string;
  originalTime: number;
  optimizedTime: number;
  improvement: number;
  improvementPercentage: number;
}

/**
 * 最適化前のBM25検索
 */
async function originalBM25Search(query: string): Promise<number> {
  const startTime = Date.now();
  
  try {
    // Lunr Indexの初期化
    await lunrInitializer.initializeAsync();
    
    // 最適化前: 制限なしで検索
    const results = await lunrSearchClient.search(query, {
      limit: 100, // 多めに取得
      fields: ['title', 'content', 'labels'], // 全フィールド検索
      boost: {
        title: 2.0,
        content: 1.0,
        labels: 1.5
      }
    });
    
    const endTime = Date.now();
    console.log(`  📊 最適化前: ${endTime - startTime}ms, 結果数: ${results.length}件`);
    return endTime - startTime;
    
  } catch (error) {
    console.error(`  ❌ 最適化前BM25検索エラー: ${error}`);
    return 0;
  }
}

/**
 * 最適化後のBM25検索
 */
async function optimizedBM25Search(query: string): Promise<number> {
  const startTime = Date.now();
  
  try {
    // Lunr Indexの初期化
    await lunrInitializer.initializeAsync();
    
    // 最適化後: 検索範囲の限定とフィールドの最適化
    const results = await lunrSearchClient.search(query, {
      limit: 20, // 検索範囲を限定
      fields: ['title'], // タイトルのみ検索（最も関連性が高い）
      boost: {
        title: 3.0 // タイトルの重みを上げる
      }
    });
    
    const endTime = Date.now();
    console.log(`  🚀 最適化後: ${endTime - startTime}ms, 結果数: ${results.length}件`);
    return endTime - startTime;
    
  } catch (error) {
    console.error(`  ❌ 最適化後BM25検索エラー: ${error}`);
    return 0;
  }
}

/**
 * BM25検索最適化のテスト
 */
async function testBM25SearchOptimization() {
  console.log('🚀 BM25検索最適化テストを開始します...');
  console.log('=' * 60);

  const testQueries = [
    "教室管理機能について教えて",
    "CSVアップロードの方法",
    "教室の公開フラグとは？",
    "エラーハンドリングの仕組み",
    "ユーザー権限の管理"
  ];

  const results: BM25SearchOptimization[] = [];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n📊 テスト (${i + 1}/${testQueries.length}): "${query}"`);
    
    // 最適化前の測定
    console.log('  🔍 最適化前の測定中...');
    const originalTime = await originalBM25Search(query);
    
    // 少し待機（キャッシュ効果を避けるため）
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 最適化後の測定
    console.log('  🚀 最適化後の測定中...');
    const optimizedTime = await optimizedBM25Search(query);
    
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
  console.log('\n' + '=' * 60);
  console.log('📈 BM25検索最適化結果');
  console.log('=' * 60);

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
    console.log(`  ✅ BM25検索の最適化が成功しました！`);
    console.log(`  📈 平均${avgImprovementPercentage.toFixed(1)}%の改善が確認できました`);
    console.log(`  🚀 この最適化を本番環境に適用することを推奨します`);
  } else {
    console.log(`  ❌ BM25検索の最適化で改善が見られませんでした`);
    console.log(`  🔍 他の最適化手法を検討する必要があります`);
  }

  // 結果をJSONファイルに保存
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `bm25-search-optimization-${timestamp}.json`;
  const fs = require('fs');
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n💾 最適化結果は ${filename} に保存されました。`);

  console.log('\n✅ BM25検索最適化テストが完了しました！');
}

// 実行
testBM25SearchOptimization().catch(console.error);
