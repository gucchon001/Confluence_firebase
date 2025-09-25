/**
 * 最適化された検索サービスのテスト
 * パフォーマンス比較と動作確認
 */

import 'dotenv/config';
import { performance } from 'perf_hooks';
import { optimizedSearchService } from '../lib/optimized-search-service';
import { searchLanceDB } from '../lib/lancedb-search-client';

interface PerformanceTest {
  query: string;
  originalTime: number;
  optimizedTime: number;
  improvement: number;
  originalResults: number;
  optimizedResults: number;
}

class OptimizedSearchTester {
  private testQueries = [
    '要件定義',
    'ワークフロー',
    '機能要件',
    '権限',
    '帳票'
  ];

  /**
   * 最適化された検索サービスのテスト
   */
  async testOptimizedSearch(): Promise<void> {
    console.log('🚀 最適化された検索サービスのテスト開始');
    console.log('=' .repeat(60));

    // 初期化
    console.log('🔧 サービス初期化中...');
    const initStart = performance.now();
    await optimizedSearchService.initialize();
    const initEnd = performance.now();
    console.log(`✅ 初期化完了: ${(initEnd - initStart).toFixed(2)}ms`);

    // サービス状態確認
    const status = optimizedSearchService.getStatus();
    console.log('📊 サービス状態:');
    console.log(`  初期化済み: ${status.isInitialized}`);
    console.log(`  LanceDB: ${status.services.lancedb ? '✅' : '❌'}`);
    console.log(`  Lunr: ${status.services.lunr ? '✅' : '❌'}`);
    console.log(`  キーワード: ${status.services.keyword ? '✅' : '❌'}`);
    console.log(`  プロセッサ: ${status.services.processor ? '✅' : '❌'}`);

    // 検索テスト
    console.log('\n🔍 検索テスト開始');
    console.log('-' .repeat(40));

    for (const query of this.testQueries) {
      console.log(`\n📝 クエリ: "${query}"`);
      
      try {
        const startTime = performance.now();
        const results = await optimizedSearchService.search({
          query,
          limit: 10,
          labelFilters: {
            excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
          }
        });
        const endTime = performance.now();

        const duration = endTime - startTime;
        console.log(`  結果数: ${results.length}件`);
        console.log(`  処理時間: ${duration.toFixed(2)}ms`);
        
        // 結果の詳細表示（最初の3件）
        results.slice(0, 3).forEach((result, index) => {
          console.log(`    [${index + 1}] ${result.title} (スコア: ${result.score?.toFixed(3) || 'N/A'})`);
        });

      } catch (error) {
        console.error(`❌ クエリ "${query}" のエラー:`, error);
      }
    }
  }

  /**
   * パフォーマンス比較テスト
   */
  async comparePerformance(): Promise<PerformanceTest[]> {
    console.log('\n📊 パフォーマンス比較テスト');
    console.log('=' .repeat(60));

    const results: PerformanceTest[] = [];

    for (const query of this.testQueries) {
      console.log(`\n🔍 比較テスト: "${query}"`);

      // 元の検索処理
      console.log('  元の検索処理を実行中...');
      const originalStart = performance.now();
      const originalResults = await searchLanceDB({
        query,
        limit: 10,
        labelFilters: {
          excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
        }
      });
      const originalEnd = performance.now();
      const originalTime = originalEnd - originalStart;

      // 最適化された検索処理
      console.log('  最適化された検索処理を実行中...');
      const optimizedStart = performance.now();
      const optimizedResults = await optimizedSearchService.search({
        query,
        limit: 10,
        labelFilters: {
          excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
        }
      });
      const optimizedEnd = performance.now();
      const optimizedTime = optimizedEnd - optimizedStart;

      const improvement = ((originalTime - optimizedTime) / originalTime) * 100;

      const testResult: PerformanceTest = {
        query,
        originalTime,
        optimizedTime,
        improvement,
        originalResults: originalResults.length,
        optimizedResults: optimizedResults.length
      };

      results.push(testResult);

      console.log(`  元の処理時間: ${originalTime.toFixed(2)}ms`);
      console.log(`  最適化処理時間: ${optimizedTime.toFixed(2)}ms`);
      console.log(`  改善率: ${improvement.toFixed(1)}%`);
      console.log(`  元の結果数: ${originalResults.length}件`);
      console.log(`  最適化結果数: ${optimizedResults.length}件`);
    }

    return results;
  }

  /**
   * 比較結果のサマリーを生成
   */
  generateComparisonSummary(results: PerformanceTest[]): void {
    console.log('\n📈 パフォーマンス比較サマリー');
    console.log('=' .repeat(60));

    const avgOriginalTime = results.reduce((sum, r) => sum + r.originalTime, 0) / results.length;
    const avgOptimizedTime = results.reduce((sum, r) => sum + r.optimizedTime, 0) / results.length;
    const avgImprovement = results.reduce((sum, r) => sum + r.improvement, 0) / results.length;

    console.log(`📊 平均処理時間:`);
    console.log(`  元の処理: ${avgOriginalTime.toFixed(2)}ms`);
    console.log(`  最適化処理: ${avgOptimizedTime.toFixed(2)}ms`);
    console.log(`  平均改善率: ${avgImprovement.toFixed(1)}%`);

    console.log(`\n📋 詳細結果:`);
    results.forEach(result => {
      console.log(`  ${result.query}: ${result.originalTime.toFixed(2)}ms → ${result.optimizedTime.toFixed(2)}ms (${result.improvement.toFixed(1)}%改善)`);
    });

    // 改善率の統計
    const improvements = results.map(r => r.improvement);
    const maxImprovement = Math.max(...improvements);
    const minImprovement = Math.min(...improvements);

    console.log(`\n📈 改善率統計:`);
    console.log(`  最大改善率: ${maxImprovement.toFixed(1)}%`);
    console.log(`  最小改善率: ${minImprovement.toFixed(1)}%`);
    console.log(`  改善率のばらつき: ${(maxImprovement - minImprovement).toFixed(1)}%`);

    // 結果数の比較
    const resultCountMatches = results.filter(r => r.originalResults === r.optimizedResults).length;
    console.log(`\n🎯 結果品質:`);
    console.log(`  結果数一致: ${resultCountMatches}/${results.length} (${((resultCountMatches/results.length)*100).toFixed(1)}%)`);
  }
}

// メイン実行
async function runOptimizedSearchTest() {
  const tester = new OptimizedSearchTester();

  try {
    // 最適化された検索サービスのテスト
    await tester.testOptimizedSearch();

    // パフォーマンス比較テスト
    const comparisonResults = await tester.comparePerformance();

    // 比較結果のサマリー
    tester.generateComparisonSummary(comparisonResults);

    console.log('\n✅ 最適化された検索サービスのテスト完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

runOptimizedSearchTest().catch(console.error);
