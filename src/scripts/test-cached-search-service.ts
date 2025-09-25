/**
 * キャッシュ統合型検索サービスのテスト
 * キャッシュの効果を測定
 */

import 'dotenv/config';
import { cachedSearchService } from '../lib/cached-search-service';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function testCachedSearchService() {
  console.log('🚀 キャッシュ統合型検索サービスのテスト開始');
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
    // キャッシュ統合型検索サービスを初期化
    console.log('🔧 キャッシュ統合型検索サービスを初期化中...');
    const initStartTime = performance.now();
    await cachedSearchService.initialize();
    const initEndTime = performance.now();
    console.log(`✅ 初期化完了: ${(initEndTime - initStartTime).toFixed(2)}ms`);

    // 初回検索（キャッシュミス）
    console.log('\n📋 初回検索テスト（キャッシュミス）');
    console.log('=' .repeat(40));

    for (const query of testQueries.slice(0, 3)) { // 最初の3件のみ
      console.log(`\n🔍 初回検索: "${query}"`);
      console.log('-'.repeat(30));

      const startTime = performance.now();
      const results = await cachedSearchService.search({
        query,
        topK: 10,
        labelFilters: { excludeMeetingNotes: true, excludeArchived: true },
        excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'],
        excludeTitlePatterns: ['xxx_*']
      });
      const endTime = performance.now();

      console.log(`📊 初回検索結果:`);
      console.log(`  結果数: ${results.length}件`);
      console.log(`  処理時間: ${(endTime - startTime).toFixed(2)}ms`);
    }

    // 2回目検索（キャッシュヒット）
    console.log('\n\n📋 2回目検索テスト（キャッシュヒット）');
    console.log('=' .repeat(40));

    for (const query of testQueries.slice(0, 3)) { // 最初の3件のみ
      console.log(`\n🔍 2回目検索: "${query}"`);
      console.log('-'.repeat(30));

      const startTime = performance.now();
      const results = await cachedSearchService.search({
        query,
        topK: 10,
        labelFilters: { excludeMeetingNotes: true, excludeArchived: true },
        excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'],
        excludeTitlePatterns: ['xxx_*']
      });
      const endTime = performance.now();

      console.log(`📊 2回目検索結果:`);
      console.log(`  結果数: ${results.length}件`);
      console.log(`  処理時間: ${(endTime - startTime).toFixed(2)}ms`);
    }

    // バッチ検索テスト
    console.log('\n\n📋 バッチ検索テスト');
    console.log('=' .repeat(40));

    const batchStartTime = performance.now();
    const batchResults = await cachedSearchService.batchSearch(testQueries, 5);
    const batchEndTime = performance.now();
    const batchTime = batchEndTime - batchStartTime;

    console.log(`\n📊 バッチ検索結果:`);
    console.log(`  総処理時間: ${batchTime.toFixed(2)}ms`);
    console.log(`  平均処理時間: ${(batchTime / testQueries.length).toFixed(2)}ms`);
    console.log(`  クエリ数: ${testQueries.length}件`);

    batchResults.forEach((result, index) => {
      const cacheStatus = result.fromCache ? '✅ キャッシュ' : '❌ 新規';
      console.log(`  ${index + 1}. "${result.query}": ${result.results.length}件, ${result.time.toFixed(2)}ms ${cacheStatus}`);
    });

    // キャッシュ統計を表示
    console.log('\n\n📊 キャッシュ統計');
    console.log('=' .repeat(40));
    const cacheStats = cachedSearchService.getCacheStats();
    console.log(`キャッシュサイズ: ${cacheStats.size}/${cacheStats.maxSize}`);
    console.log(`キャッシュエントリ数: ${cacheStats.entries.length}`);

    // 既存の検索との比較
    console.log('\n\n📊 既存検索との比較テスト');
    console.log('=' .repeat(40));

    const comparisonQuery = '教室管理の詳細は';
    
    // 既存の検索
    console.log(`\n🔍 既存検索: "${comparisonQuery}"`);
    const originalStartTime = performance.now();
    const originalResults = await searchLanceDB({
      query: comparisonQuery,
      topK: 10,
      labelFilters: { excludeMeetingNotes: true, excludeArchived: true },
      excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'],
      excludeTitlePatterns: ['xxx_*']
    });
    const originalEndTime = performance.now();
    const originalTime = originalEndTime - originalStartTime;

    // キャッシュ統合型検索（初回）
    console.log(`\n🔍 キャッシュ統合型検索（初回）: "${comparisonQuery}"`);
    const cachedStartTime = performance.now();
    const cachedResults = await cachedSearchService.search({
      query: comparisonQuery,
      topK: 10,
      labelFilters: { excludeMeetingNotes: true, excludeArchived: true },
      excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'],
      excludeTitlePatterns: ['xxx_*']
    });
    const cachedEndTime = performance.now();
    const cachedTime = cachedEndTime - cachedStartTime;

    // キャッシュ統合型検索（2回目）
    console.log(`\n🔍 キャッシュ統合型検索（2回目）: "${comparisonQuery}"`);
    const cached2StartTime = performance.now();
    const cached2Results = await cachedSearchService.search({
      query: comparisonQuery,
      topK: 10,
      labelFilters: { excludeMeetingNotes: true, excludeArchived: true },
      excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive'],
      excludeTitlePatterns: ['xxx_*']
    });
    const cached2EndTime = performance.now();
    const cached2Time = cached2EndTime - cached2StartTime;

    console.log(`\n📊 比較結果:`);
    console.log(`  既存検索: ${originalTime.toFixed(2)}ms, ${originalResults.length}件`);
    console.log(`  キャッシュ統合型（初回）: ${cachedTime.toFixed(2)}ms, ${cachedResults.length}件`);
    console.log(`  キャッシュ統合型（2回目）: ${cached2Time.toFixed(2)}ms, ${cached2Results.length}件`);
    
    const improvement1 = ((originalTime - cachedTime) / originalTime * 100).toFixed(1);
    const improvement2 = ((originalTime - cached2Time) / originalTime * 100).toFixed(1);
    console.log(`  初回改善率: ${improvement1}%`);
    console.log(`  2回目改善率: ${improvement2}%`);

    // 品質チェック
    const qualityCheck = checkQuality(cachedResults, originalResults);
    console.log(`  品質チェック: ${qualityCheck.passed ? '✅' : '❌'} (${qualityCheck.score.toFixed(1)}%)`);

    console.log('\n✅ テスト完了');

  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
}

function checkQuality(cachedResults: any[], originalResults: any[]): { passed: boolean; score: number } {
  if (cachedResults.length === 0 && originalResults.length === 0) {
    return { passed: true, score: 100 };
  }

  if (cachedResults.length === 0 || originalResults.length === 0) {
    return { passed: false, score: 0 };
  }

  // 上位5件の重複率を計算
  const cachedTitles = cachedResults.slice(0, 5).map(r => r.title);
  const originalTitles = originalResults.slice(0, 5).map(r => r.title);
  
  const commonTitles = cachedTitles.filter(title => originalTitles.includes(title));
  const score = (commonTitles.length / Math.max(cachedTitles.length, originalTitles.length)) * 100;
  
  return { passed: score >= 80, score };
}

testCachedSearchService().catch(console.error);
