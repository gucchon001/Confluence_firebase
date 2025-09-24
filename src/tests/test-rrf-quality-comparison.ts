/**
 * RRF融合有効 vs 無効の品質比較テスト
 * 検索結果の品質に与える影響を詳細分析
 */

import { searchLanceDB } from '../lib/lancedb-search-client';
import { unifiedSearchResultProcessor } from '../lib/unified-search-result-processor';

async function testRRFQualityComparison() {
  console.log('🔍 RRF融合品質比較テスト');
  console.log('=' .repeat(60));

  const testQueries = [
    '教室管理の詳細は',
    'ログイン機能について',
    'オファー管理の機能'
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n[${i + 1}/${testQueries.length}] テストクエリ: "${query}"`);

    try {
      // 1. RRF有効での検索
      console.log('\n1️⃣ RRF有効での検索');
      const startTime1 = Date.now();
      const resultsWithRRF = await searchLanceDB({
        query,
        topK: 5,
        tableName: 'confluence'
      });
      const timeWithRRF = Date.now() - startTime1;

      // 2. RRF無効での検索（統一サービスで直接処理）
      console.log('\n2️⃣ RRF無効での検索');
      const startTime2 = Date.now();
      
      // 既存の検索ロジックを実行して生データを取得
      const rawResults = await getRawSearchResults(query);
      
      // 統一サービスでRRF無効で処理
      const resultsWithoutRRF = unifiedSearchResultProcessor.processSearchResults(rawResults, {
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

      // 結果数比較
      console.log(`\n📊 結果数比較:`);
      console.log(`   RRF有効: ${resultsWithRRF.length}件`);
      console.log(`   RRF無効: ${resultsWithoutRRF.length}件`);

      // スコア比較
      if (resultsWithRRF.length > 0 && resultsWithoutRRF.length > 0) {
        console.log(`\n📈 スコア比較:`);
        
        const scoresWithRRF = resultsWithRRF.map(r => r.score);
        const scoresWithoutRRF = resultsWithoutRRF.map(r => r.score);
        
        const avgWithRRF = scoresWithRRF.reduce((a, b) => a + b, 0) / scoresWithRRF.length;
        const avgWithoutRRF = scoresWithoutRRF.reduce((a, b) => a + b, 0) / scoresWithoutRRF.length;
        
        console.log(`   平均スコア（RRF有効）: ${avgWithRRF.toFixed(2)}`);
        console.log(`   平均スコア（RRF無効）: ${avgWithoutRRF.toFixed(2)}`);
        console.log(`   スコア差: ${Math.abs(avgWithRRF - avgWithoutRRF).toFixed(2)}`);

        // 結果の順位比較
        console.log(`\n📋 結果順位比較:`);
        console.log('   RRF有効:');
        resultsWithRRF.forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.title} (Score: ${result.score})`);
        });
        
        console.log('   RRF無効:');
        resultsWithoutRRF.forEach((result, index) => {
          console.log(`     ${index + 1}. ${result.title} (Score: ${result.score})`);
        });

        // 順位の一致度分析
        const rankConsistency = analyzeRankConsistency(resultsWithRRF, resultsWithoutRRF);
        console.log(`\n🎯 順位一致度: ${rankConsistency.toFixed(2)}%`);

        // 品質評価
        if (rankConsistency > 80) {
          console.log('✅ 高品質維持');
        } else if (rankConsistency > 60) {
          console.log('⚠️  中品質維持');
        } else {
          console.log('❌ 品質低下');
        }
      }

    } catch (error) {
      console.error(`❌ エラー: ${error}`);
    }
  }

  console.log('\n✅ RRF融合品質比較テスト完了');
}

/**
 * 生の検索結果を取得（RRF処理前）
 */
async function getRawSearchResults(query: string) {
  // この関数は実際の実装では、lancedb-search-client.tsの内部ロジックを
  // 呼び出してRRF処理前の生データを取得する必要があります
  // 現在は簡略化のため、既存の検索結果をモックとして使用
  const results = await searchLanceDB({
    query,
    topK: 5,
    tableName: 'confluence'
  });

  // 既存の結果を生データ形式に変換
  return results.map(result => ({
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
}

/**
 * 順位の一致度を分析
 */
function analyzeRankConsistency(results1: any[], results2: any[]): number {
  if (results1.length === 0 || results2.length === 0) return 0;
  
  const minLength = Math.min(results1.length, results2.length);
  let matches = 0;
  
  for (let i = 0; i < minLength; i++) {
    if (results1[i].id === results2[i].id) {
      matches++;
    }
  }
  
  return (matches / minLength) * 100;
}

// テスト実行
testRRFQualityComparison().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
