/**
 * RRF融合の直接比較テスト
 * 同じ検索結果に対してRRF有効/無効で処理を比較
 */

import { unifiedSearchResultProcessor } from '../lib/unified-search-result-processor';

async function testRRFDirectComparison() {
  console.log('🔍 RRF融合直接比較テスト');
  console.log('=' .repeat(60));

  // テスト用の生データ（実際の検索結果を模擬）
  const mockRawResults = [
    {
      id: 'test-1',
      pageId: 123,
      title: '教室管理機能の詳細',
      content: '教室管理に関する詳細な説明...',
      _distance: 0.3,
      _bm25Score: 15.5,
      _keywordScore: 12,
      _labelScore: 2,
      _sourceType: 'bm25',
      space_key: 'TEST',
      labels: '["教室管理", "機能"]',
      url: 'https://example.com/page1',
      lastUpdated: '2024-01-01'
    },
    {
      id: 'test-2',
      pageId: 456,
      title: '教室管理一覧機能',
      content: '教室管理一覧の実装詳細...',
      _distance: 0.5,
      _bm25Score: 12.3,
      _keywordScore: 10,
      _labelScore: 1,
      _sourceType: 'bm25',
      space_key: 'TEST',
      labels: '["教室管理", "一覧"]',
      url: 'https://example.com/page2',
      lastUpdated: '2024-01-02'
    },
    {
      id: 'test-3',
      pageId: 789,
      title: 'ログイン機能について',
      content: 'ログイン機能の実装詳細...',
      _distance: 0.7,
      _bm25Score: 8.2,
      _keywordScore: 6,
      _labelScore: 0,
      _sourceType: 'hybrid',
      space_key: 'TEST',
      labels: '["ログイン", "認証"]',
      url: 'https://example.com/page3',
      lastUpdated: '2024-01-03'
    },
    {
      id: 'test-4',
      pageId: 101,
      title: 'オファー管理システム',
      content: 'オファー管理の機能説明...',
      _distance: 0.8,
      _bm25Score: 5.1,
      _keywordScore: 4,
      _labelScore: 0,
      _sourceType: 'vector',
      space_key: 'TEST',
      labels: '["オファー", "管理"]',
      url: 'https://example.com/page4',
      lastUpdated: '2024-01-04'
    },
    {
      id: 'test-5',
      pageId: 202,
      title: 'ユーザー管理機能',
      content: 'ユーザー管理の実装詳細...',
      _distance: 0.9,
      _bm25Score: 3.2,
      _keywordScore: 2,
      _labelScore: 0,
      _sourceType: 'vector',
      space_key: 'TEST',
      labels: '["ユーザー", "管理"]',
      url: 'https://example.com/page5',
      lastUpdated: '2024-01-05'
    }
  ];

  try {
    console.log('\n📊 テストデータ: 5件の検索結果');
    console.log('   1. 教室管理機能の詳細 (BM25: 15.5)');
    console.log('   2. 教室管理一覧機能 (BM25: 12.3)');
    console.log('   3. ログイン機能について (Hybrid)');
    console.log('   4. オファー管理システム (Vector)');
    console.log('   5. ユーザー管理機能 (Vector)');

    // 1. RRF有効での処理
    console.log('\n1️⃣ RRF有効での処理');
    const startTime1 = Date.now();
    const resultsWithRRF = unifiedSearchResultProcessor.processSearchResults(mockRawResults, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: true
    });
    const timeWithRRF = Date.now() - startTime1;

    // 2. RRF無効での処理
    console.log('\n2️⃣ RRF無効での処理');
    const startTime2 = Date.now();
    const resultsWithoutRRF = unifiedSearchResultProcessor.processSearchResults(mockRawResults, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: false
    });
    const timeWithoutRRF = Date.now() - startTime2;

    // 結果比較
    console.log(`\n📊 処理時間比較:`);
    console.log(`   RRF有効: ${timeWithRRF}ms`);
    console.log(`   RRF無効: ${timeWithoutRRF}ms`);
    console.log(`   時間差: ${Math.abs(timeWithRRF - timeWithoutRRF)}ms`);

    // 結果の詳細比較
    console.log(`\n📋 結果詳細比較:`);
    console.log('\n   RRF有効:');
    resultsWithRRF.forEach((result, index) => {
      console.log(`     ${index + 1}. ${result.title}`);
      console.log(`        スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
      console.log(`        RRFスコア: ${result.rrfScore?.toFixed(4)}`);
      console.log(`        ソース: ${result.source}`);
    });

    console.log('\n   RRF無効:');
    resultsWithoutRRF.forEach((result, index) => {
      console.log(`     ${index + 1}. ${result.title}`);
      console.log(`        スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
      console.log(`        RRFスコア: ${result.rrfScore?.toFixed(4)}`);
      console.log(`        ソース: ${result.source}`);
    });

    // 順位の変化分析
    console.log(`\n🎯 順位変化分析:`);
    const rankChanges = analyzeRankChanges(resultsWithRRF, resultsWithoutRRF);
    rankChanges.forEach(change => {
      console.log(`   ${change.title}: ${change.withRRF}位 → ${change.withoutRRF}位 (${change.change > 0 ? '+' : ''}${change.change})`);
    });

    // スコア分布の比較
    console.log(`\n📈 スコア分布比較:`);
    const scoresWithRRF = resultsWithRRF.map(r => r.score);
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

    const rankConsistency = calculateRankConsistency(resultsWithRRF, resultsWithoutRRF);
    if (rankConsistency > 80) {
      console.log('   順位一貫性: 良好（一致度 > 80%）');
    } else if (rankConsistency > 60) {
      console.log('   順位一貫性: 中程度（一致度 60-80%）');
    } else {
      console.log('   順位一貫性: 注意（一致度 < 60%）');
    }

    console.log('\n✅ RRF融合直接比較テスト完了');

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
testRRFDirectComparison().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
