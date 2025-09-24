/**
 * 複数のクエリでベクトル検索の一貫性をテストするスクリプト
 * 
 * このテストは以下の項目を評価します：
 * 1. 複数クエリでの検索結果の一貫性
 * 2. スコア分布の一貫性
 * 3. ランキングの一貫性
 * 4. 距離分布の一貫性
 * 5. 検索品質の安定性
 */

import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

interface ConsistencyTestQuery {
  query: string;
  category: string;
  expectedMinResults: number;
  expectedMaxResults: number;
  description: string;
}

interface ConsistencyResult {
  query: string;
  category: string;
  totalResults: number;
  averageScore: number;
  scoreStdDev: number;
  topScore: number;
  bottomScore: number;
  scoreRange: number;
  results: Array<{
    title: string;
    score: number;
    rank: number;
  }>;
}

interface ConsistencyAnalysis {
  category: string;
  queries: ConsistencyResult[];
  avgResultsCount: number;
  avgScore: number;
  scoreConsistency: number;
  rankingConsistency: number;
  overallConsistency: number;
}

const CONSISTENCY_TEST_QUERIES: ConsistencyTestQuery[] = [
  // 教室管理関連クエリ
  {
    query: '教室管理の詳細は',
    category: '教室管理',
    expectedMinResults: 5,
    expectedMaxResults: 15,
    description: '教室管理機能の詳細仕様'
  },
  {
    query: '教室管理機能について',
    category: '教室管理',
    expectedMinResults: 5,
    expectedMaxResults: 15,
    description: '教室管理機能の概要'
  },
  {
    query: '教室一覧機能の仕様',
    category: '教室管理',
    expectedMinResults: 3,
    expectedMaxResults: 10,
    description: '教室一覧機能の詳細'
  },
  {
    query: '教室登録機能の詳細',
    category: '教室管理',
    expectedMinResults: 3,
    expectedMaxResults: 10,
    description: '教室登録機能の詳細'
  },
  {
    query: '教室編集機能の仕様',
    category: '教室管理',
    expectedMinResults: 3,
    expectedMaxResults: 10,
    description: '教室編集機能の詳細'
  },
  
  // 教室コピー関連クエリ
  {
    query: '教室コピー機能でコピー可能な項目は？',
    category: '教室コピー',
    expectedMinResults: 8,
    expectedMaxResults: 20,
    description: '教室コピー機能のコピー可能項目'
  },
  {
    query: '教室コピー機能の仕様',
    category: '教室コピー',
    expectedMinResults: 5,
    expectedMaxResults: 15,
    description: '教室コピー機能の詳細仕様'
  },
  {
    query: '教室コピー処理の詳細',
    category: '教室コピー',
    expectedMinResults: 3,
    expectedMaxResults: 10,
    description: '教室コピー処理の詳細'
  },
  {
    query: '教室コピー制限事項',
    category: '教室コピー',
    expectedMinResults: 2,
    expectedMaxResults: 8,
    description: '教室コピー制限事項'
  },
  
  // オファー機能関連クエリ
  {
    query: 'オファー機能の種類と使い方は？',
    category: 'オファー機能',
    expectedMinResults: 5,
    expectedMaxResults: 15,
    description: 'オファー機能の種類と使用方法'
  },
  {
    query: 'スカウトオファー機能について',
    category: 'オファー機能',
    expectedMinResults: 3,
    expectedMaxResults: 10,
    description: 'スカウトオファー機能の詳細'
  },
  {
    query: 'マッチオファー機能の仕様',
    category: 'オファー機能',
    expectedMinResults: 3,
    expectedMaxResults: 10,
    description: 'マッチオファー機能の詳細'
  },
  {
    query: 'オファー通知機能の詳細',
    category: 'オファー機能',
    expectedMinResults: 2,
    expectedMaxResults: 8,
    description: 'オファー通知機能の詳細'
  }
];

/**
 * 単一クエリでの一貫性テストを実行する
 */
async function testQueryConsistency(testQuery: ConsistencyTestQuery): Promise<ConsistencyResult> {
  console.log(`\n=== 一貫性テスト: "${testQuery.query}" ===`);
  console.log(`カテゴリ: ${testQuery.category}`);
  console.log(`説明: ${testQuery.description}`);
  
  try {
    // ベクトル検索を実行
    const searchResults = await searchLanceDB({
      query: testQuery.query,
      topK: 20,
      useLunrIndex: false, // ベクトル検索のみを使用
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });
    
    console.log(`検索結果数: ${searchResults.length}件`);
    
    // スコアの統計を計算
    const scores = searchResults.map(r => r.score || 0);
    const averageScore = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
    const topScore = scores.length > 0 ? Math.max(...scores) : 0;
    const bottomScore = scores.length > 0 ? Math.min(...scores) : 0;
    const scoreRange = topScore - bottomScore;
    
    // スコアの標準偏差を計算
    const variance = scores.length > 0 ? 
      scores.reduce((sum, s) => sum + Math.pow(s - averageScore, 2), 0) / scores.length : 0;
    const scoreStdDev = Math.sqrt(variance);
    
    console.log(`平均スコア: ${averageScore.toFixed(2)}`);
    console.log(`最高スコア: ${topScore.toFixed(2)}`);
    console.log(`最低スコア: ${bottomScore.toFixed(2)}`);
    console.log(`スコア範囲: ${scoreRange.toFixed(2)}`);
    console.log(`スコア標準偏差: ${scoreStdDev.toFixed(2)}`);
    
    // 結果数を期待値と比較
    const resultsCount = searchResults.length;
    if (resultsCount < testQuery.expectedMinResults) {
      console.log(`⚠️ 結果数が少ない: ${resultsCount} < ${testQuery.expectedMinResults}`);
    } else if (resultsCount > testQuery.expectedMaxResults) {
      console.log(`⚠️ 結果数が多い: ${resultsCount} > ${testQuery.expectedMaxResults}`);
    } else {
      console.log(`✅ 結果数は期待範囲内: ${resultsCount}`);
    }
    
    // 上位結果を表示
    console.log(`\n--- 上位5件の検索結果 ---`);
    const topResults = searchResults.slice(0, 5).map((result, index) => ({
      title: result.title,
      score: result.score || 0,
      rank: index + 1
    }));
    
    topResults.forEach(result => {
      console.log(`${result.rank}. ${result.title} (スコア: ${result.score.toFixed(2)})`);
    });
    
    return {
      query: testQuery.query,
      category: testQuery.category,
      totalResults: resultsCount,
      averageScore,
      scoreStdDev,
      topScore,
      bottomScore,
      scoreRange,
      results: searchResults.map((result, index) => ({
        title: result.title,
        score: result.score || 0,
        rank: index + 1
      }))
    };
    
  } catch (error) {
    console.error(`一貫性テストエラー: ${error}`);
    return {
      query: testQuery.query,
      category: testQuery.category,
      totalResults: 0,
      averageScore: 0,
      scoreStdDev: 0,
      topScore: 0,
      bottomScore: 0,
      scoreRange: 0,
      results: []
    };
  }
}

/**
 * カテゴリ別の一貫性分析を実行する
 */
async function analyzeCategoryConsistency(category: string, results: ConsistencyResult[]): Promise<ConsistencyAnalysis> {
  console.log(`\n=== カテゴリ別一貫性分析: ${category} ===`);
  
  const categoryResults = results.filter(r => r.category === category);
  
  if (categoryResults.length === 0) {
    console.log('該当するクエリがありません');
    return {
      category,
      queries: [],
      avgResultsCount: 0,
      avgScore: 0,
      scoreConsistency: 0,
      rankingConsistency: 0,
      overallConsistency: 0
    };
  }
  
  // 結果数の統計
  const resultsCounts = categoryResults.map(r => r.totalResults);
  const avgResultsCount = resultsCounts.reduce((sum, c) => sum + c, 0) / resultsCounts.length;
  const resultsStdDev = Math.sqrt(
    resultsCounts.reduce((sum, c) => sum + Math.pow(c - avgResultsCount, 2), 0) / resultsCounts.length
  );
  
  // スコアの統計
  const avgScores = categoryResults.map(r => r.averageScore);
  const overallAvgScore = avgScores.reduce((sum, s) => sum + s, 0) / avgScores.length;
  const scoreStdDev = Math.sqrt(
    avgScores.reduce((sum, s) => sum + Math.pow(s - overallAvgScore, 2), 0) / avgScores.length
  );
  
  // スコアの一貫性を計算（標準偏差が小さいほど一貫性が高い）
  const scoreConsistency = Math.max(0, 1 - (scoreStdDev / overallAvgScore));
  
  // ランキングの一貫性を計算（共通のページのランキング順序の一致度）
  let rankingConsistency = 0;
  if (categoryResults.length >= 2) {
    const commonPages = findCommonPages(categoryResults);
    if (commonPages.length > 0) {
      rankingConsistency = calculateRankingConsistency(categoryResults, commonPages);
    }
  }
  
  // 全体の一貫性スコア
  const overallConsistency = (scoreConsistency + rankingConsistency) / 2;
  
  console.log(`クエリ数: ${categoryResults.length}件`);
  console.log(`平均結果数: ${avgResultsCount.toFixed(1)}件`);
  console.log(`結果数の標準偏差: ${resultsStdDev.toFixed(2)}`);
  console.log(`平均スコア: ${overallAvgScore.toFixed(2)}`);
  console.log(`スコアの標準偏差: ${scoreStdDev.toFixed(2)}`);
  console.log(`スコア一貫性: ${scoreConsistency.toFixed(3)}`);
  console.log(`ランキング一貫性: ${rankingConsistency.toFixed(3)}`);
  console.log(`全体一貫性: ${overallConsistency.toFixed(3)}`);
  
  // 一貫性の評価
  if (overallConsistency > 0.8) {
    console.log('✅ 一貫性: 良好');
  } else if (overallConsistency > 0.6) {
    console.log('⚠️ 一貫性: 普通');
  } else {
    console.log('❌ 一貫性: 低い');
  }
  
  return {
    category,
    queries: categoryResults,
    avgResultsCount,
    avgScore: overallAvgScore,
    scoreConsistency,
    rankingConsistency,
    overallConsistency
  };
}

/**
 * 共通のページを見つける
 */
function findCommonPages(results: ConsistencyResult[]): string[] {
  if (results.length < 2) return [];
  
  const pageCounts = new Map<string, number>();
  
  // 各クエリの結果でページの出現回数をカウント
  results.forEach(result => {
    result.results.forEach(page => {
      const count = pageCounts.get(page.title) || 0;
      pageCounts.set(page.title, count + 1);
    });
  });
  
  // 2つ以上のクエリで出現するページを返す
  return Array.from(pageCounts.entries())
    .filter(([, count]) => count >= 2)
    .map(([title]) => title);
}

/**
 * ランキングの一貫性を計算する
 */
function calculateRankingConsistency(results: ConsistencyResult[], commonPages: string[]): number {
  if (commonPages.length < 2) return 0;
  
  let totalConsistency = 0;
  let comparisonCount = 0;
  
  // 各ページペアについて、ランキング順序の一致度を計算
  for (let i = 0; i < commonPages.length; i++) {
    for (let j = i + 1; j < commonPages.length; j++) {
      const page1 = commonPages[i];
      const page2 = commonPages[j];
      
      let consistentComparisons = 0;
      let totalComparisons = 0;
      
      // 各クエリでページのランキングを比較
      for (const result of results) {
        const rank1 = result.results.find(r => r.title === page1)?.rank;
        const rank2 = result.results.find(r => r.title === page2)?.rank;
        
        if (rank1 && rank2) {
          totalComparisons++;
          // 他のクエリでも同じ順序かチェック
          const otherResults = results.filter(r => r !== result);
          const consistentWithOthers = otherResults.every(otherResult => {
            const otherRank1 = otherResult.results.find(r => r.title === page1)?.rank;
            const otherRank2 = otherResult.results.find(r => r.title === page2)?.rank;
            
            if (otherRank1 && otherRank2) {
              return (rank1 < rank2) === (otherRank1 < otherRank2);
            }
            return true;
          });
          
          if (consistentWithOthers) {
            consistentComparisons++;
          }
        }
      }
      
      if (totalComparisons > 0) {
        totalConsistency += consistentComparisons / totalComparisons;
        comparisonCount++;
      }
    }
  }
  
  return comparisonCount > 0 ? totalConsistency / comparisonCount : 0;
}

/**
 * 全体の一貫性分析を実行する
 */
async function runOverallConsistencyAnalysis(): Promise<void> {
  console.log('\n=== 全体の一貫性分析 ===');
  
  // 全クエリの一貫性テストを実行
  const allResults: ConsistencyResult[] = [];
  for (const testQuery of CONSISTENCY_TEST_QUERIES) {
    const result = await testQueryConsistency(testQuery);
    allResults.push(result);
  }
  
  // カテゴリ別の分析
  const categories = [...new Set(CONSISTENCY_TEST_QUERIES.map(q => q.category))];
  const categoryAnalyses: ConsistencyAnalysis[] = [];
  
  for (const category of categories) {
    const analysis = await analyzeCategoryConsistency(category, allResults);
    categoryAnalyses.push(analysis);
  }
  
  // 全体の統計
  console.log(`\n--- 全体統計 ---`);
  const overallAvgConsistency = categoryAnalyses.reduce((sum, a) => sum + a.overallConsistency, 0) / categoryAnalyses.length;
  const overallAvgScore = allResults.reduce((sum, r) => sum + r.averageScore, 0) / allResults.length;
  const overallAvgResults = allResults.reduce((sum, r) => sum + r.totalResults, 0) / allResults.length;
  
  console.log(`総クエリ数: ${allResults.length}件`);
  console.log(`総カテゴリ数: ${categories.length}件`);
  console.log(`全体平均一貫性: ${overallAvgConsistency.toFixed(3)}`);
  console.log(`全体平均スコア: ${overallAvgScore.toFixed(2)}`);
  console.log(`全体平均結果数: ${overallAvgResults.toFixed(1)}件`);
  
  // カテゴリ別の一貫性評価
  console.log(`\n--- カテゴリ別一貫性評価 ---`);
  categoryAnalyses.forEach(analysis => {
    const status = analysis.overallConsistency > 0.8 ? '✅' : 
                  analysis.overallConsistency > 0.6 ? '⚠️' : '❌';
    console.log(`${status} ${analysis.category}: ${analysis.overallConsistency.toFixed(3)}`);
  });
  
  // 推奨改善点
  console.log(`\n--- 推奨改善点 ---`);
  const lowConsistencyCategories = categoryAnalyses.filter(a => a.overallConsistency < 0.6);
  if (lowConsistencyCategories.length > 0) {
    console.log('一貫性が低いカテゴリ:');
    lowConsistencyCategories.forEach(category => {
      console.log(`  - ${category.category}: ${category.overallConsistency.toFixed(3)}`);
    });
  } else {
    console.log('✅ 全カテゴリで良好な一貫性を維持');
  }
}

/**
 * メインテスト実行関数
 */
async function runVectorSearchConsistencyTest(): Promise<void> {
  console.log('🚀 ベクトル検索一貫性テスト開始');
  console.log('='.repeat(60));
  console.log(`テスト実行時刻: ${new Date().toISOString()}`);
  
  try {
    // 全体の一貫性分析
    await runOverallConsistencyAnalysis();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ベクトル検索一貫性テスト完了');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runVectorSearchConsistencyTest();
}

export { runVectorSearchConsistencyTest, testQueryConsistency, analyzeCategoryConsistency };
