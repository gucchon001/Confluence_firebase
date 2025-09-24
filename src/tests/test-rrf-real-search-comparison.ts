/**
 * 実際の検索結果でのRRF品質比較テスト
 * 本番データでRRF有効/無効の品質を比較
 */

import { searchLanceDB } from '../lib/lancedb-search-client';
import { unifiedSearchResultProcessor } from '../lib/unified-search-result-processor';

async function testRRFRealSearchComparison() {
  console.log('🔍 実際の検索結果でのRRF品質比較テスト');
  console.log('=' .repeat(60));

  const testQuery = '教室管理の詳細は';
  
  try {
    console.log(`\n📊 テストクエリ: "${testQuery}"`);

    // 1. 既存の検索（RRF有効）
    console.log('\n1️⃣ 既存の検索（RRF有効）');
    const startTime1 = Date.now();
    const existingResults = await searchLanceDB({
      query: testQuery,
      topK: 5,
      tableName: 'confluence'
    });
    const existingTime = Date.now() - startTime1;

    console.log(`⏱️  処理時間: ${existingTime}ms`);
    console.log(`📊 結果数: ${existingResults.length}件`);

    // 2. RRF無効での処理（統一サービス）
    console.log('\n2️⃣ RRF無効での処理（統一サービス）');
    
    // 生データを取得（簡略化のため既存結果を変換）
    const rawResults = existingResults.map(result => ({
      id: result.id,
      pageId: result.pageId,
      title: result.title,
      content: result.content,
      _distance: result.distance,
      _bm25Score: result.scoreRaw || 0,
      _keywordScore: result.scoreRaw || 0,
      _labelScore: 0,
      _sourceType: result.source || 'vector',
      space_key: result.space_key,
      labels: result.labels,
      url: result.url,
      lastUpdated: result.lastUpdated
    }));

    const startTime2 = Date.now();
    const resultsWithoutRRF = unifiedSearchResultProcessor.processSearchResults(rawResults, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: false
    });
    const timeWithoutRRF = Date.now() - startTime2;

    console.log(`⏱️  処理時間: ${timeWithoutRRF}ms`);
    console.log(`📊 結果数: ${resultsWithoutRRF.length}件`);

    // 結果比較
    console.log(`\n📊 処理時間比較:`);
    console.log(`   既存（RRF有効）: ${existingTime}ms`);
    console.log(`   統一（RRF無効）: ${timeWithoutRRF}ms`);
    console.log(`   時間差: ${Math.abs(existingTime - timeWithoutRRF)}ms`);

    // 結果の詳細比較
    console.log(`\n📋 結果詳細比較:`);
    console.log('\n   既存（RRF有効）:');
    existingResults.forEach((result, index) => {
      console.log(`     ${index + 1}. ${result.title}`);
      console.log(`        スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
      console.log(`        ソース: ${result.source}`);
    });

    console.log('\n   統一（RRF無効）:');
    resultsWithoutRRF.forEach((result, index) => {
      console.log(`     ${index + 1}. ${result.title}`);
      console.log(`        スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
      console.log(`        ソース: ${result.source}`);
    });

    // 順位の変化分析
    console.log(`\n🎯 順位変化分析:`);
    const rankChanges = analyzeRankChanges(existingResults, resultsWithoutRRF);
    rankChanges.forEach(change => {
      console.log(`   ${change.title}: ${change.withRRF}位 → ${change.withoutRRF}位 (${change.change > 0 ? '+' : ''}${change.change})`);
    });

    // スコア分布の比較
    console.log(`\n📈 スコア分布比較:`);
    const scoresWithRRF = existingResults.map(r => r.score);
    const scoresWithoutRRF = resultsWithoutRRF.map(r => r.score);
    
    const avgWithRRF = scoresWithRRF.reduce((a, b) => a + b, 0) / scoresWithRRF.length;
    const avgWithoutRRF = scoresWithoutRRF.reduce((a, b) => a + b, 0) / scoresWithoutRRF.length;
    
    console.log(`   平均スコア（RRF有効）: ${avgWithRRF.toFixed(2)}`);
    console.log(`   平均スコア（RRF無効）: ${avgWithoutRRF.toFixed(2)}`);
    console.log(`   スコア差: ${Math.abs(avgWithRRF - avgWithoutRRF).toFixed(2)}`);

    // 品質評価
    console.log(`\n✅ 品質評価:`);
    if (Math.abs(avgWithRRF - avgWithoutRRF) < 5) {
      console.log('   スコア一貫性: 良好（差 < 5点）');
    } else {
      console.log('   スコア一貫性: 注意（差 >= 5点）');
    }

    const rankConsistency = calculateRankConsistency(existingResults, resultsWithoutRRF);
    if (rankConsistency > 80) {
      console.log('   順位一貫性: 良好（一致度 > 80%）');
    } else if (rankConsistency > 60) {
      console.log('   順位一貫性: 中程度（一致度 60-80%）');
    } else {
      console.log('   順位一貫性: 注意（一致度 < 60%）');
    }

    // 最終判定
    console.log(`\n🎯 最終判定:`);
    if (rankConsistency > 80 && Math.abs(avgWithRRF - avgWithoutRRF) < 5) {
      console.log('   ✅ RRF無効化でも品質は維持される');
      console.log('   ✅ パフォーマンス向上のメリットが大きい');
    } else if (rankConsistency > 60) {
      console.log('   ⚠️  RRF無効化で若干の品質変化あり');
      console.log('   ⚠️  パフォーマンスと品質のバランスを検討');
    } else {
      console.log('   ❌ RRF無効化で品質低下が懸念される');
      console.log('   ❌ RRF有効の維持を推奨');
    }

    console.log('\n✅ 実際の検索結果でのRRF品質比較テスト完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    throw error;
  }
}

/**
 * 順位の変化を分析
 */
function analyzeRankChanges(resultsWithRRF: any[], resultsWithoutRRF: any[]) {
  const changes = [];
  
  for (let i = 0; i < resultsWithRRF.length; i++) {
    const withRRF = resultsWithRRF[i];
    const withoutRRFIndex = resultsWithoutRRF.findIndex(r => r.id === withRRF.id);
    
    if (withoutRRFIndex !== -1) {
      changes.push({
        title: withRRF.title,
        withRRF: i + 1,
        withoutRRF: withoutRRFIndex + 1,
        change: withoutRRFIndex - i
      });
    }
  }
  
  return changes;
}

/**
 * 順位の一致度を計算
 */
function calculateRankConsistency(resultsWithRRF: any[], resultsWithoutRRF: any[]): number {
  if (resultsWithRRF.length === 0 || resultsWithoutRRF.length === 0) return 0;
  
  const minLength = Math.min(resultsWithRRF.length, resultsWithoutRRF.length);
  let matches = 0;
  
  for (let i = 0; i < minLength; i++) {
    if (resultsWithRRF[i].id === resultsWithoutRRF[i].id) {
      matches++;
    }
  }
  
  return (matches / minLength) * 100;
}

// テスト実行
testRRFRealSearchComparison().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
