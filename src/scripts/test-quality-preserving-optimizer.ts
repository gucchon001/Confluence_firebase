/**
 * 品質保持型パフォーマンス最適化のテスト
 * 既存の検索ロジックとの品質比較
 */

import 'dotenv/config';
import { qualityPreservingOptimizer } from '../lib/quality-preserving-optimizer';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function testQualityPreservingOptimizer() {
  console.log('🚀 品質保持型パフォーマンス最適化のテスト開始');
  console.log('=' .repeat(60));

  const testQueries = [
    '教室管理の詳細は',
    '要件定義',
    'ワークフロー',
    '機能要件',
    '権限',
    '帳票'
  ];

  try {
    // 品質保持型最適化サービスを初期化
    console.log('🔧 品質保持型最適化サービスを初期化中...');
    const initStartTime = performance.now();
    await qualityPreservingOptimizer.initialize();
    const initEndTime = performance.now();
    console.log(`✅ 初期化完了: ${(initEndTime - initStartTime).toFixed(2)}ms`);

    // 個別クエリテスト
    console.log('\n📋 個別クエリテスト');
    console.log('=' .repeat(40));

    for (const query of testQueries) {
      console.log(`\n🔍 テストクエリ: "${query}"`);
      console.log('-'.repeat(30));

      // 最適化された検索
      const optimizedStartTime = performance.now();
      const optimizedResults = await qualityPreservingOptimizer.search({
        query,
        topK: 10,
        labelFilters: {
          excludeArchived: true,
          excludeMeetingNotes: true
        },
        excludeTitlePatterns: ['xxx_*']
      });
      const optimizedEndTime = performance.now();
      const optimizedTime = optimizedEndTime - optimizedStartTime;

      // 既存の検索
      const originalStartTime = performance.now();
      const originalResults = await searchLanceDB({
        query,
        topK: 10,
        labelFilters: {
          excludeArchived: true,
          excludeMeetingNotes: true
        },
        excludeTitlePatterns: ['xxx_*']
      });
      const originalEndTime = performance.now();
      const originalTime = originalEndTime - originalStartTime;

      // 結果の比較
      console.log(`📊 結果比較:`);
      console.log(`  最適化版: ${optimizedResults.length}件, ${optimizedTime.toFixed(2)}ms`);
      console.log(`  既存版:   ${originalResults.length}件, ${originalTime.toFixed(2)}ms`);
      console.log(`  性能向上: ${((originalTime - optimizedTime) / originalTime * 100).toFixed(1)}%`);

      // 品質チェック
      const qualityCheck = checkQuality(optimizedResults, originalResults);
      console.log(`  品質チェック: ${qualityCheck.passed ? '✅' : '❌'} (${qualityCheck.score.toFixed(1)}%)`);

      // 上位3件の比較
      console.log(`📋 上位3件の比較:`);
      for (let i = 0; i < Math.min(3, Math.max(optimizedResults.length, originalResults.length)); i++) {
        const optimized = optimizedResults[i];
        const original = originalResults[i];
        const match = optimized && original && optimized.title === original.title;
        console.log(`  ${i + 1}. ${match ? '✅' : '❌'} ${optimized?.title || 'N/A'} | ${original?.title || 'N/A'}`);
      }
    }

    // バッチ検索テスト
    console.log('\n\n📋 バッチ検索テスト');
    console.log('=' .repeat(40));

    const batchStartTime = performance.now();
    const batchResults = await qualityPreservingOptimizer.batchSearch(testQueries, 5);
    const batchEndTime = performance.now();
    const batchTime = batchEndTime - batchStartTime;

    console.log(`\n📊 バッチ検索結果:`);
    console.log(`  総処理時間: ${batchTime.toFixed(2)}ms`);
    console.log(`  平均処理時間: ${(batchTime / testQueries.length).toFixed(2)}ms`);
    console.log(`  クエリ数: ${testQueries.length}件`);

    batchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. "${result.query}": ${result.results.length}件, ${result.time.toFixed(2)}ms`);
    });

    console.log('\n✅ テスト完了');

  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

function checkQuality(optimizedResults: any[], originalResults: any[]): { passed: boolean; score: number } {
  if (optimizedResults.length === 0 && originalResults.length === 0) {
    return { passed: true, score: 100 };
  }

  if (optimizedResults.length === 0 || originalResults.length === 0) {
    return { passed: false, score: 0 };
  }

  // 上位5件の重複率を計算
  const optimizedTitles = optimizedResults.slice(0, 5).map(r => r.title);
  const originalTitles = originalResults.slice(0, 5).map(r => r.title);
  
  const commonTitles = optimizedTitles.filter(title => originalTitles.includes(title));
  const score = (commonTitles.length / Math.max(optimizedTitles.length, originalTitles.length)) * 100;
  
  return { passed: score >= 80, score };
}

testQualityPreservingOptimizer().catch(console.error);
