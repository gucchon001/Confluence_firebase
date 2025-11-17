/**
 * ハイブリッド検索コンポーネントテスト
 * 
 * このテストは以下の項目を検証します：
 * 1. ベクトル検索が正しく動作しているか
 * 2. BM25検索が正しく動作しているか
 * 3. RRF（Reciprocal Rank Fusion）が正しく機能しているか
 * 4. 各検索アプローチの統合が正しく動作しているか
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from './test-helpers/env-loader';
loadTestEnv();

interface TestQuery {
  query: string;
  description: string;
  expectedMinResults: number;
}

const TEST_QUERIES: TestQuery[] = [
  {
    query: '教室管理の詳細は',
    description: '教室管理機能の検索',
    expectedMinResults: 5
  },
  {
    query: '教室削除ができないのは何が原因ですか',
    description: '教室削除問題の検索',
    expectedMinResults: 3
  },
  {
    query: 'オファー機能の種類は？',
    description: 'オファー機能の検索',
    expectedMinResults: 3
  }
];

interface SearchResultAnalysis {
  query: string;
  vectorResults: {
    count: number;
    avgDistance: number;
    minDistance: number;
    maxDistance: number;
    topResults: Array<{ title: string; distance: number; score?: number }>;
  };
  bm25Results: {
    count: number;
    avgScore: number;
    minScore: number;
    maxScore: number;
    topResults: Array<{ title: string; score: number; _bm25Score?: number }>;
  };
  hybridResults: {
    count: number;
    vectorOnly: number;
    bm25Only: number;
    both: number;
    avgRRFScore: number;
    minRRFScore: number;
    maxRRFScore: number;
    topResults: Array<{ title: string; rrfScore: number; source: string; distance?: number; bm25Score?: number }>;
  };
  rrfAnalysis: {
    hasRRFScore: boolean;
    rrfScoresValid: boolean;
    rankingConsistency: boolean;
    topResultHasHighRRF: boolean;
  };
}

/**
 * ベクトル検索のみを実行
 */
async function testVectorSearchOnly(query: string): Promise<any[]> {
  const { searchLanceDB } = await import('../lib/lancedb-search-client.js');
  
  const results = await searchLanceDB({
    query: query,
    topK: 20,
    useLunrIndex: false, // BM25検索を無効化
    labelFilters: {
      includeMeetingNotes: false,
      includeArchived: false,
      includeFolders: false
    }
  });
  
  return results;
}

/**
 * BM25検索のみを実行
 */
async function testBM25SearchOnly(query: string): Promise<any[]> {
  const { LunrSearchClient } = await import('../lib/lunr-search-client.js');
  const lunrClient = LunrSearchClient.getInstance();
  
  // BM25検索を実行
  const results = await lunrClient.searchWithFilters(
    query,
    {
      excludeLabels: ['議事録', 'アーカイブ']
    },
    20,
    'confluence'
  );
  
  return results;
}

/**
 * ハイブリッド検索を実行（ベクトル + BM25 + RRF）
 */
async function testHybridSearch(query: string): Promise<any[]> {
  const { searchLanceDB } = await import('../lib/lancedb-search-client.js');
  
  const results = await searchLanceDB({
    query: query,
    topK: 20,
    useLunrIndex: true, // BM25検索を有効化
    labelFilters: {
      includeMeetingNotes: false,
      includeArchived: false,
      includeFolders: false
    }
  });
  
  return results;
}

/**
 * 単一クエリの分析を実行
 */
async function analyzeQuery(testQuery: TestQuery): Promise<SearchResultAnalysis> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔍 テストクエリ: "${testQuery.query}"`);
  console.log(`📝 説明: ${testQuery.description}`);
  console.log('='.repeat(70));

  // 1. ベクトル検索のみ
  console.log('\n📊 1. ベクトル検索のみの実行...');
  const vectorResults = await testVectorSearchOnly(testQuery.query);
  
  const vectorDistances = vectorResults.map(r => r.distance ?? 1).filter(d => d !== undefined);
  const vectorAnalysis = {
    count: vectorResults.length,
    avgDistance: vectorDistances.length > 0 
      ? vectorDistances.reduce((sum, d) => sum + d, 0) / vectorDistances.length 
      : 0,
    minDistance: vectorDistances.length > 0 ? Math.min(...vectorDistances) : 0,
    maxDistance: vectorDistances.length > 0 ? Math.max(...vectorDistances) : 0,
    topResults: vectorResults.slice(0, 5).map(r => ({
      title: r.title,
      distance: r.distance ?? 1,
      score: r.score
    }))
  };

  console.log(`   ✅ 結果数: ${vectorAnalysis.count}件`);
  console.log(`   📈 平均距離: ${vectorAnalysis.avgDistance.toFixed(4)}`);
  console.log(`   📉 最小距離: ${vectorAnalysis.minDistance.toFixed(4)}`);
  console.log(`   📊 最大距離: ${vectorAnalysis.maxDistance.toFixed(4)}`);

  // 2. BM25検索のみ
  console.log('\n📊 2. BM25検索のみの実行...');
  let bm25Results: any[] = [];
  let bm25Analysis = {
    count: 0,
    avgScore: 0,
    minScore: 0,
    maxScore: 0,
    topResults: [] as Array<{ title: string; score: number; _bm25Score?: number }>
  };

  try {
    bm25Results = await testBM25SearchOnly(testQuery.query);
    
    const bm25Scores = bm25Results.map(r => r.score ?? 0).filter(s => s > 0);
    bm25Analysis = {
      count: bm25Results.length,
      avgScore: bm25Scores.length > 0 
        ? bm25Scores.reduce((sum, s) => sum + s, 0) / bm25Scores.length 
        : 0,
      minScore: bm25Scores.length > 0 ? Math.min(...bm25Scores) : 0,
      maxScore: bm25Scores.length > 0 ? Math.max(...bm25Scores) : 0,
      topResults: bm25Results.slice(0, 5).map(r => ({
        title: r.title,
        score: r.score ?? 0,
        _bm25Score: (r as any)._bm25Score
      }))
    };

    console.log(`   ✅ 結果数: ${bm25Analysis.count}件`);
    console.log(`   📈 平均スコア: ${bm25Analysis.avgScore.toFixed(4)}`);
    console.log(`   📉 最小スコア: ${bm25Analysis.minScore.toFixed(4)}`);
    console.log(`   📊 最大スコア: ${bm25Analysis.maxScore.toFixed(4)}`);
  } catch (error) {
    console.log(`   ⚠️  BM25検索エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // 3. ハイブリッド検索（ベクトル + BM25 + RRF）
  console.log('\n📊 3. ハイブリッド検索（ベクトル + BM25 + RRF）の実行...');
  const hybridResults = await testHybridSearch(testQuery.query);
  
  // ソースタイプ別の集計
  const vectorOnly = hybridResults.filter(r => (r as any)._sourceType === 'vector').length;
  const bm25Only = hybridResults.filter(r => (r as any)._sourceType === 'bm25').length;
  const both = hybridResults.filter(r => (r as any)._sourceType === 'hybrid').length;
  
  // RRFスコアの分析
  const rrfScores = hybridResults
    .map(r => (r as any)._rrfScore ?? 0)
    .filter(s => s > 0);
  
  const hybridAnalysis = {
    count: hybridResults.length,
    vectorOnly,
    bm25Only,
    both,
    avgRRFScore: rrfScores.length > 0 
      ? rrfScores.reduce((sum, s) => sum + s, 0) / rrfScores.length 
      : 0,
    minRRFScore: rrfScores.length > 0 ? Math.min(...rrfScores) : 0,
    maxRRFScore: rrfScores.length > 0 ? Math.max(...rrfScores) : 0,
    topResults: hybridResults.slice(0, 10).map(r => ({
      title: r.title,
      rrfScore: (r as any)._rrfScore ?? 0,
      source: (r as any)._sourceType ?? 'unknown',
      distance: r.distance,
      bm25Score: (r as any)._bm25Score
    }))
  };

  console.log(`   ✅ 結果数: ${hybridAnalysis.count}件`);
  console.log(`   🔵 ベクトルのみ: ${hybridAnalysis.vectorOnly}件`);
  console.log(`   🟢 BM25のみ: ${hybridAnalysis.bm25Only}件`);
  console.log(`   🟣 両方（ハイブリッド）: ${hybridAnalysis.both}件`);
  console.log(`   📈 平均RRFスコア: ${hybridAnalysis.avgRRFScore.toFixed(4)}`);
  console.log(`   📉 最小RRFスコア: ${hybridAnalysis.minRRFScore.toFixed(4)}`);
  console.log(`   📊 最大RRFスコア: ${hybridAnalysis.maxRRFScore.toFixed(4)}`);

  // 4. RRFの動作検証
  console.log('\n📊 4. RRFの動作検証...');
  
  const hasRRFScore = hybridResults.some(r => (r as any)._rrfScore !== undefined && (r as any)._rrfScore > 0);
  const rrfScoresValid = rrfScores.every(s => s > 0 && isFinite(s) && !isNaN(s));
  
  // ランキングの一貫性チェック（RRFスコアが高い順に並んでいるか）
  const sortedByRRF = [...hybridResults].sort((a, b) => 
    ((b as any)._rrfScore ?? 0) - ((a as any)._rrfScore ?? 0)
  );
  const rankingConsistency = sortedByRRF.slice(0, 5).every((r, idx) => {
    const originalIdx = hybridResults.findIndex(orig => orig.id === r.id);
    // 上位5件は元の順序と一致しているか、またはRRFスコアが高い順になっているか
    return originalIdx <= idx + 2; // 多少の順序の変動は許容
  });
  
  // トップ結果が高いRRFスコアを持っているか
  const topResultHasHighRRF = hybridResults.length > 0 && 
    ((hybridResults[0] as any)._rrfScore ?? 0) > hybridAnalysis.avgRRFScore;

  const rrfAnalysis = {
    hasRRFScore,
    rrfScoresValid,
    rankingConsistency,
    topResultHasHighRRF
  };

  console.log(`   ${hasRRFScore ? '✅' : '❌'} RRFスコアが設定されている: ${hasRRFScore}`);
  console.log(`   ${rrfScoresValid ? '✅' : '❌'} RRFスコアが有効: ${rrfScoresValid}`);
  console.log(`   ${rankingConsistency ? '✅' : '❌'} ランキングの一貫性: ${rankingConsistency}`);
  console.log(`   ${topResultHasHighRRF ? '✅' : '❌'} トップ結果が高いRRFスコア: ${topResultHasHighRRF}`);

  // 5. 詳細な結果表示
  console.log('\n📋 5. ハイブリッド検索結果（上位10件）:');
  hybridAnalysis.topResults.forEach((result, index) => {
    console.log(`\n   ${index + 1}. ${result.title}`);
    console.log(`      ソース: ${result.source}`);
    console.log(`      RRFスコア: ${result.rrfScore.toFixed(4)}`);
    if (result.distance !== undefined) {
      console.log(`      ベクトル距離: ${result.distance.toFixed(4)}`);
    }
    if (result.bm25Score !== undefined) {
      console.log(`      BM25スコア: ${result.bm25Score.toFixed(4)}`);
    }
  });

  return {
    query: testQuery.query,
    vectorResults: vectorAnalysis,
    bm25Results: bm25Analysis,
    hybridResults: hybridAnalysis,
    rrfAnalysis
  };
}

/**
 * メインテスト実行
 */
async function runHybridSearchComponentsTest(): Promise<void> {
  console.log('\n' + '='.repeat(70));
  console.log('🚀 ハイブリッド検索コンポーネントテスト開始');
  console.log('='.repeat(70));
  console.log(`全${TEST_QUERIES.length}個のクエリでテストを実行します...\n`);

  const analyses: SearchResultAnalysis[] = [];
  let allTestsPassed = true;

  for (const testQuery of TEST_QUERIES) {
    try {
      const analysis = await analyzeQuery(testQuery);
      analyses.push(analysis);

      // テスト結果の評価
      const vectorTestPassed = analysis.vectorResults.count >= testQuery.expectedMinResults;
      const bm25TestPassed = analysis.bm25Results.count > 0; // BM25が動作していればOK
      const hybridTestPassed = analysis.hybridResults.count >= testQuery.expectedMinResults;
      const rrfTestPassed = analysis.rrfAnalysis.hasRRFScore && 
                           analysis.rrfAnalysis.rrfScoresValid &&
                           analysis.rrfAnalysis.topResultHasHighRRF;

      console.log(`\n📊 テスト結果評価:`);
      console.log(`   ${vectorTestPassed ? '✅' : '❌'} ベクトル検索: ${vectorTestPassed ? 'PASS' : 'FAIL'} (${analysis.vectorResults.count}件)`);
      console.log(`   ${bm25TestPassed ? '✅' : '❌'} BM25検索: ${bm25TestPassed ? 'PASS' : 'FAIL'} (${analysis.bm25Results.count}件)`);
      console.log(`   ${hybridTestPassed ? '✅' : '❌'} ハイブリッド検索: ${hybridTestPassed ? 'PASS' : 'FAIL'} (${analysis.hybridResults.count}件)`);
      console.log(`   ${rrfTestPassed ? '✅' : '❌'} RRF動作: ${rrfTestPassed ? 'PASS' : 'FAIL'}`);

      if (!vectorTestPassed || !bm25TestPassed || !hybridTestPassed || !rrfTestPassed) {
        allTestsPassed = false;
      }

      // テスト間隔
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ テスト実行エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
      allTestsPassed = false;
    }
  }

  // 全体サマリー
  console.log('\n' + '='.repeat(70));
  console.log('📊 全体サマリー');
  console.log('='.repeat(70));

  const totalVectorResults = analyses.reduce((sum, a) => sum + a.vectorResults.count, 0);
  const totalBM25Results = analyses.reduce((sum, a) => sum + a.bm25Results.count, 0);
  const totalHybridResults = analyses.reduce((sum, a) => sum + a.hybridResults.count, 0);
  const avgRRFScore = analyses.reduce((sum, a) => sum + a.hybridResults.avgRRFScore, 0) / analyses.length;
  
  const allHaveRRF = analyses.every(a => a.rrfAnalysis.hasRRFScore);
  const allRRFValid = analyses.every(a => a.rrfAnalysis.rrfScoresValid);
  const allRankingConsistent = analyses.every(a => a.rrfAnalysis.rankingConsistency);

  console.log(`\n📈 検索結果統計:`);
  console.log(`   ベクトル検索: 平均 ${(totalVectorResults / analyses.length).toFixed(1)}件/クエリ`);
  console.log(`   BM25検索: 平均 ${(totalBM25Results / analyses.length).toFixed(1)}件/クエリ`);
  console.log(`   ハイブリッド検索: 平均 ${(totalHybridResults / analyses.length).toFixed(1)}件/クエリ`);
  console.log(`   平均RRFスコア: ${avgRRFScore.toFixed(4)}`);

  console.log(`\n🎯 RRF動作検証:`);
  console.log(`   ${allHaveRRF ? '✅' : '❌'} すべてのクエリでRRFスコアが設定されている: ${allHaveRRF}`);
  console.log(`   ${allRRFValid ? '✅' : '❌'} すべてのRRFスコアが有効: ${allRRFValid}`);
  console.log(`   ${allRankingConsistent ? '✅' : '❌'} ランキングの一貫性: ${allRankingConsistent}`);

  console.log(`\n🎯 最終判定:`);
  if (allTestsPassed && allHaveRRF && allRRFValid) {
    console.log('   🎉 すべてのテストが成功しました');
    console.log('   ✅ ベクトル検索: 正常動作');
    console.log('   ✅ BM25検索: 正常動作');
    console.log('   ✅ ハイブリッド検索: 正常動作');
    console.log('   ✅ RRF: 正常動作');
    process.exit(0);
  } else {
    console.log('   ⚠️  一部のテストが失敗しました');
    if (!allHaveRRF) {
      console.log('   ❌ RRFスコアが設定されていないクエリがあります');
    }
    if (!allRRFValid) {
      console.log('   ❌ 無効なRRFスコアがあります');
    }
    if (!allRankingConsistent) {
      console.log('   ❌ ランキングの一貫性に問題があります');
    }
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runHybridSearchComponentsTest()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

export { runHybridSearchComponentsTest };

