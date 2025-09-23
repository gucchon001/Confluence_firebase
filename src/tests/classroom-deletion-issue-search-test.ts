/**
 * 教室削除問題検索品質テスト
 * テスト仕様書: docs/case_classroom-deletion-issue-search-quality-test.md
 */

import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

interface TestResult {
  title: string;
  score: number;
  labels: string[];
  source: string;
  distance?: number;
}

interface QualityMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  averageScore: number;
  problemCauseCoverage: number;
  restrictionCoverage: number;
}

// 理想の抽出ページ（テスト仕様書より）
const IDEAL_PAGES = {
  // 主要な教室削除機能ページ（優先度：高）
  mainDeletionPages: [
    '164_【FIX】教室削除機能',
    '教室削除の制限条件',
    '教室削除エラー処理'
  ],
  
  // 求人関連制限ページ（優先度：高）
  jobRelatedPages: [
    '求人掲載状態管理',
    '求人非掲載機能',
    '教室と求人の紐づけ管理'
  ],
  
  // 応募情報関連制限ページ（優先度：高）
  applicationRelatedPages: [
    '【FIX】応募情報',
    '応募履歴管理',
    '採用ステータス管理',
    '採用決定日管理'
  ],
  
  // 削除制限条件ページ（優先度：中）
  restrictionPages: [
    '教室削除前チェック機能',
    '論理削除機能',
    '削除権限管理'
  ],
  
  // エラーハンドリングページ（優先度：中）
  errorHandlingPages: [
    '教室削除エラーメッセージ',
    '削除制限通知機能',
    '削除可能性チェック機能'
  ]
};

// 除外されるべきページ
const EXCLUDED_PAGES = {
  // フォルダラベルページ
  folderPages: [
    '■教室管理機能',
    '■削除機能',
    '■エラーハンドリング'
  ],
  
  // 関連性の低いページ
  lowRelevancePages: [
    '教室統計データ',
    '教室作成ログ',
    '【作成中】教室復元機能'
  ],
  
  // 物理削除関連ページ
  physicalDeletionPages: [
    '教室物理削除機能',
    'データ完全削除機能'
  ]
};

// 問題原因分類
const PROBLEM_CAUSES = {
  jobPublication: '求人掲載状態の問題',
  applicationInfo: '応募情報の問題',
  deletionRestrictions: '削除制限条件の問題',
  errorHandling: 'エラーハンドリングの問題'
};

// 制限条件
const RESTRICTIONS = [
  '求人掲載状態の制限',
  '応募情報の制限',
  '採用ステータスの制限',
  '採用決定日の制限',
  '削除前チェックの制限'
];

async function runClassroomDeletionTest(): Promise<void> {
  console.log('=== 教室削除問題検索品質テスト ===');
  console.log(`実行時刻: ${new Date().toISOString()}`);
  console.log(`Node.js バージョン: ${process.version}`);
  console.log(`作業ディレクトリ: ${process.cwd()}\n`);
  
  const query = '教室削除ができないのは何が原因ですか';
  console.log(`テストクエリ: "${query}"`);
  
  try {
    // 検索実行
    console.log('\n--- 検索実行 ---');
    const results = await searchLanceDB({
      query,
      topK: 20,
      useLunrIndex: true,
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });
    
    console.log(`検索結果数: ${results.length}`);
    
    // 結果を整形
    const testResults: TestResult[] = results.map(result => ({
      title: result.title,
      score: result.score || 0,
      labels: result.labels || [],
      source: result.source || 'unknown',
      distance: result.distance
    }));
    
    // テストケース実行
    console.log('\n--- テストケース実行 ---');
    
    // テストケース1: 基本検索テスト
    const test1Result = await runBasicSearchTest(testResults);
    console.log(`テストケース1 (基本検索): ${test1Result.passed ? '✅ 合格' : '❌ 不合格'}`);
    console.log(`  - 抽出ページ数: ${testResults.length}件`);
    console.log(`  - 主要な教室削除機能ページ: ${test1Result.mainDeletionPagesFound}件`);
    console.log(`  - 除外ページ数: ${test1Result.excludedPagesFound}件`);
    console.log(`  - 上位3件のスコア: ${test1Result.top3Scores.join(', ')}`);
    
    // テストケース2: キーワードマッチングテスト
    const test2Result = await runKeywordMatchingTest(testResults);
    console.log(`テストケース2 (キーワードマッチング): ${test2Result.passed ? '✅ 合格' : '❌ 不合格'}`);
    console.log(`  - キーワードスコア: ${test2Result.keywordScore}`);
    console.log(`  - タイトルマッチング: ${test2Result.titleMatching ? '✅' : '❌'}`);
    console.log(`  - 関連機能名含有: ${test2Result.functionNamesFound}件`);
    
    // テストケース3: スコアリングテスト
    const test3Result = await runScoringTest(testResults);
    console.log(`テストケース3 (スコアリング): ${test3Result.passed ? '✅ 合格' : '❌ 不合格'}`);
    console.log(`  - スコア分布: ${test3Result.scoreDistribution}`);
    console.log(`  - 期待値との差: ${test3Result.scoreDifference}`);
    
    // テストケース4: 問題原因分類テスト
    const test4Result = await runProblemCauseTest(testResults);
    console.log(`テストケース4 (問題原因分類): ${test4Result.passed ? '✅ 合格' : '❌ 不合格'}`);
    console.log(`  - 求人掲載状態問題: ${test4Result.jobPublicationPages}件`);
    console.log(`  - 応募情報問題: ${test4Result.applicationInfoPages}件`);
    console.log(`  - 削除制限条件問題: ${test4Result.deletionRestrictionPages}件`);
    console.log(`  - エラーハンドリング問題: ${test4Result.errorHandlingPages}件`);
    
    // テストケース5: 制限条件テスト
    const test5Result = await runRestrictionTest(testResults);
    console.log(`テストケース5 (制限条件): ${test5Result.passed ? '✅ 合格' : '❌ 不合格'}`);
    console.log(`  - 制限条件関連ページ: ${test5Result.restrictionPages}件`);
    console.log(`  - 制限条件カバレッジ: ${test5Result.coverage}%`);
    
    // 品質メトリクス計算
    console.log('\n--- 品質メトリクス ---');
    const metrics = calculateQualityMetrics(testResults);
    console.log(`検索精度 (Precision): ${metrics.precision.toFixed(3)} (目標: 0.8以上)`);
    console.log(`検索再現率 (Recall): ${metrics.recall.toFixed(3)} (目標: 0.7以上)`);
    console.log(`F1スコア: ${metrics.f1Score.toFixed(3)} (目標: 0.75以上)`);
    console.log(`平均スコア: ${metrics.averageScore.toFixed(1)} (目標: 80以上)`);
    console.log(`問題原因分類カバレッジ: ${metrics.problemCauseCoverage.toFixed(3)} (目標: 0.8以上)`);
    console.log(`制限条件カバレッジ: ${metrics.restrictionCoverage.toFixed(3)} (目標: 0.8以上)`);
    
    // 総合評価
    console.log('\n--- 総合評価 ---');
    const overallPassed = test1Result.passed && test2Result.passed && test3Result.passed && 
                         test4Result.passed && test5Result.passed;
    console.log(`総合評価: ${overallPassed ? '✅ 合格' : '❌ 不合格'}`);
    
    // 詳細結果表示
    console.log('\n--- 検索結果詳細 ---');
    testResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   - スコア: ${result.score}`);
      console.log(`   - ラベル: ${result.labels.join(', ')}`);
      console.log(`   - ソース: ${result.source}`);
      console.log(`   - 距離: ${result.distance || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('テスト実行エラー:', error);
    process.exit(1);
  }
}

async function runBasicSearchTest(results: TestResult[]): Promise<{
  passed: boolean;
  mainDeletionPagesFound: number;
  excludedPagesFound: number;
  top3Scores: number[];
}> {
  // 主要な教室削除機能ページの検索
  const allMainPages = [
    ...IDEAL_PAGES.mainDeletionPages,
    ...IDEAL_PAGES.jobRelatedPages,
    ...IDEAL_PAGES.applicationRelatedPages,
    ...IDEAL_PAGES.restrictionPages,
    ...IDEAL_PAGES.errorHandlingPages
  ];
  
  const mainDeletionPagesFound = results.filter(result => 
    allMainPages.some(page => result.title.includes(page))
  ).length;
  
  // 除外ページの検索
  const allExcludedPages = [
    ...EXCLUDED_PAGES.folderPages,
    ...EXCLUDED_PAGES.lowRelevancePages,
    ...EXCLUDED_PAGES.physicalDeletionPages
  ];
  
  const excludedPagesFound = results.filter(result => 
    allExcludedPages.some(page => result.title.includes(page))
  ).length;
  
  // 上位3件のスコア
  const top3Scores = results.slice(0, 3).map(r => r.score);
  
  // 合格基準
  const passed = mainDeletionPagesFound >= 3 && 
                 excludedPagesFound === 0 && 
                 top3Scores.every(score => score >= 80);
  
  return {
    passed,
    mainDeletionPagesFound,
    excludedPagesFound,
    top3Scores
  };
}

async function runKeywordMatchingTest(results: TestResult[]): Promise<{
  passed: boolean;
  keywordScore: number;
  titleMatching: boolean;
  functionNamesFound: number;
}> {
  // キーワードスコアの計算
  const keywordScore = results.reduce((sum, result) => sum + result.score, 0);
  
  // タイトルマッチングの確認
  const titleMatching = results.some(result => 
    result.title.includes('教室削除') || result.title.includes('削除機能')
  );
  
  // 関連機能名の含有確認
  const functionNames = ['教室削除', '削除機能', '削除エラー', '削除制限', '削除条件'];
  const functionNamesFound = results.filter(result => 
    functionNames.some(name => result.title.includes(name))
  ).length;
  
  // 合格基準
  const passed = keywordScore > 0 && titleMatching && functionNamesFound >= 3;
  
  return {
    passed,
    keywordScore,
    titleMatching,
    functionNamesFound
  };
}

async function runScoringTest(results: TestResult[]): Promise<{
  passed: boolean;
  scoreDistribution: string;
  scoreDifference: string;
}> {
  // スコア分布の計算
  const scores = results.map(r => r.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  
  const scoreDistribution = `${minScore}-${maxScore} (平均: ${avgScore.toFixed(1)})`;
  
  // 期待値との差
  const expectedScores = [85, 75, 80, 70, 65]; // 期待スコア
  const actualScores = results.slice(0, 5).map(r => r.score);
  const scoreDifference = actualScores.map((actual, index) => 
    `${actual} (期待: ${expectedScores[index]}, 差: ${actual - expectedScores[index]})`
  ).join(', ');
  
  // 合格基準
  const passed = actualScores.every((score, index) => 
    Math.abs(score - expectedScores[index]) <= 10
  );
  
  return {
    passed,
    scoreDistribution,
    scoreDifference
  };
}

async function runProblemCauseTest(results: TestResult[]): Promise<{
  passed: boolean;
  jobPublicationPages: number;
  applicationInfoPages: number;
  deletionRestrictionPages: number;
  errorHandlingPages: number;
}> {
  // 各問題原因分類のページ数
  const jobPublicationPages = results.filter(result => 
    result.title.includes('求人') || result.title.includes('掲載')
  ).length;
  
  const applicationInfoPages = results.filter(result => 
    result.title.includes('応募') || result.title.includes('採用')
  ).length;
  
  const deletionRestrictionPages = results.filter(result => 
    result.title.includes('削除') && (result.title.includes('制限') || result.title.includes('条件'))
  ).length;
  
  const errorHandlingPages = results.filter(result => 
    result.title.includes('エラー') || result.title.includes('エラーハンドリング')
  ).length;
  
  // 合格基準
  const passed = jobPublicationPages >= 2 && 
                 applicationInfoPages >= 3 && 
                 deletionRestrictionPages >= 2 && 
                 errorHandlingPages >= 1;
  
  return {
    passed,
    jobPublicationPages,
    applicationInfoPages,
    deletionRestrictionPages,
    errorHandlingPages
  };
}

async function runRestrictionTest(results: TestResult[]): Promise<{
  passed: boolean;
  restrictionPages: number;
  coverage: number;
}> {
  // 制限条件関連ページの検索
  const restrictionKeywords = ['制限', '条件', 'チェック', '権限', '制約'];
  const restrictionPages = results.filter(result => 
    restrictionKeywords.some(keyword => result.title.includes(keyword))
  ).length;
  
  // カバレッジの計算
  const coverage = (restrictionPages / RESTRICTIONS.length) * 100;
  
  // 合格基準
  const passed = restrictionPages >= 4 && coverage >= 80;
  
  return {
    passed,
    restrictionPages,
    coverage
  };
}

function calculateQualityMetrics(results: TestResult[]): QualityMetrics {
  // 関連ページの定義
  const allRelevantPages = [
    ...IDEAL_PAGES.mainDeletionPages,
    ...IDEAL_PAGES.jobRelatedPages,
    ...IDEAL_PAGES.applicationRelatedPages,
    ...IDEAL_PAGES.restrictionPages,
    ...IDEAL_PAGES.errorHandlingPages
  ];
  
  // 検索結果に含まれる関連ページ
  const relevantResults = results.filter(result => 
    allRelevantPages.some(page => result.title.includes(page))
  );
  
  // 検索精度 (Precision)
  const precision = relevantResults.length / results.length;
  
  // 検索再現率 (Recall)
  const recall = relevantResults.length / allRelevantPages.length;
  
  // F1スコア
  const f1Score = 2 * (precision * recall) / (precision + recall);
  
  // 平均スコア
  const averageScore = results.reduce((sum, result) => sum + result.score, 0) / results.length;
  
  // 問題原因分類カバレッジ
  const problemCauseCoverage = Math.min(1, relevantResults.length / 4);
  
  // 制限条件カバレッジ
  const restrictionCoverage = Math.min(1, relevantResults.length / 5);
  
  return {
    precision,
    recall,
    f1Score,
    averageScore,
    problemCauseCoverage,
    restrictionCoverage
  };
}

// テスト実行
if (require.main === module) {
  runClassroomDeletionTest().catch(console.error);
}
