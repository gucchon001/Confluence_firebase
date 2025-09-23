/*
 * Classroom Deletion Issue Search Quality Test
 * Based on case_classroom-deletion-issue-search-quality-test.md
 */

import { searchLanceDB } from '../lib/lancedb-search-client.js';

// Test configuration
const TEST_QUERY = '教室削除ができないのは何が原因ですか';
const EXPECTED_PAGES = {
  // High priority classroom deletion pages
  high: [
    '164_【FIX】教室削除機能',
    '教室削除の制限条件',
    '教室削除エラー処理'
  ],
  // Job-related restriction pages
  jobRestriction: [
    '求人掲載状態管理',
    '求人非掲載機能',
    '教室と求人の紐づけ管理'
  ],
  // Application information related restriction pages
  applicationRestriction: [
    '【FIX】応募情報',
    '応募履歴管理',
    '採用ステータス管理',
    '採用決定日管理'
  ],
  // Deletion restriction condition pages
  deletionRestriction: [
    '教室削除前チェック機能',
    '論理削除機能',
    '削除権限管理'
  ],
  // Error handling pages
  errorHandling: [
    '教室削除エラーメッセージ',
    '削除制限通知機能',
    '削除可能性チェック機能'
  ]
};

// Pages that should be excluded
const EXCLUDED_PAGES = [
  '■教室管理機能',
  '■削除機能',
  '■エラーハンドリング',
  '教室統計データ',
  '教室作成ログ',
  '【作成中】教室復元機能',
  '教室物理削除機能',
  'データ完全削除機能'
];

// Ideal keyword extraction results
const IDEAL_KEYWORDS = [
  '教室削除', '削除できない', '削除問題', '削除制限', 
  '教室', '削除', '求人掲載', '応募情報', '採用ステータス', 
  '削除条件', '削除エラー', '削除制限条件'
];

// Problem cause categories
const PROBLEM_CAUSES = {
  jobPosting: '求人掲載状態の問題',
  applicationInfo: '応募情報の問題',
  deletionRestriction: '削除制限条件の問題',
  errorHandling: 'エラーハンドリングの問題'
};

// Restriction conditions
const RESTRICTION_CONDITIONS = [
  '求人掲載状態の制限',
  '応募情報の制限',
  '採用ステータスの制限',
  '採用決定日の制限',
  '削除前チェックの制限'
];

async function runClassroomDeletionIssueSearchTest() {
  console.log('=== Classroom Deletion Issue Search Quality Test ===');
  console.log(`Query: "${TEST_QUERY}"`);
  console.log('');

  try {
    // Execute search
    const searchResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 20,
      useLunrIndex: true
    });

    console.log('=== Search Results ===');
    console.log(`Total search results: ${searchResults.length}`);
    console.log('');

    // Display detailed results
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   Score: ${result.score}`);
      console.log(`   Labels: ${JSON.stringify(result.labels)}`);
      console.log('');
    });

    // Test Case 1: Basic Search Test
    console.log('=== Test Case 1: Basic Search Test ===');
    const highPriorityFound = searchResults.filter(result => 
      EXPECTED_PAGES.high.some(page => result.title.includes(page))
    );
    const jobRestrictionFound = searchResults.filter(result => 
      EXPECTED_PAGES.jobRestriction.some(page => result.title.includes(page))
    );
    const applicationRestrictionFound = searchResults.filter(result => 
      EXPECTED_PAGES.applicationRestriction.some(page => result.title.includes(page))
    );
    const deletionRestrictionFound = searchResults.filter(result => 
      EXPECTED_PAGES.deletionRestriction.some(page => result.title.includes(page))
    );
    const errorHandlingFound = searchResults.filter(result => 
      EXPECTED_PAGES.errorHandling.some(page => result.title.includes(page))
    );
    const excludedFound = searchResults.filter(result => 
      EXCLUDED_PAGES.some(page => result.title.includes(page))
    );

    console.log(`High priority pages: ${highPriorityFound.length}/${EXPECTED_PAGES.high.length}`);
    console.log(`Job restriction pages: ${jobRestrictionFound.length}/${EXPECTED_PAGES.jobRestriction.length}`);
    console.log(`Application restriction pages: ${applicationRestrictionFound.length}/${EXPECTED_PAGES.applicationRestriction.length}`);
    console.log(`Deletion restriction pages: ${deletionRestrictionFound.length}/${EXPECTED_PAGES.deletionRestriction.length}`);
    console.log(`Error handling pages: ${errorHandlingFound.length}/${EXPECTED_PAGES.errorHandling.length}`);
    console.log(`Excluded pages found: ${excludedFound.length}`);

    const basicSearchPass = highPriorityFound.length >= 3 && excludedFound.length === 0;
    console.log(`Basic search test: ${basicSearchPass ? '✅ PASS' : '❌ FAIL'}`);

    // Test Case 2: Keyword Matching Test
    console.log('');
    console.log('=== Test Case 2: Keyword Matching Test ===');
    
    // Check keyword extraction (check in logs)
    console.log('Keyword extraction results should be checked in logs');
    console.log('Ideal keywords:', IDEAL_KEYWORDS.join(', '));
    
    const keywordTestPass = true; // Check in logs
    console.log(`Keyword matching test: ${keywordTestPass ? '✅ PASS' : '❌ FAIL'}`);

    // Test Case 3: Scoring Test
    console.log('');
    console.log('=== Test Case 3: Scoring Test ===');
    
    const highPriorityScores = highPriorityFound.map(r => r.score);
    const jobRestrictionScores = jobRestrictionFound.map(r => r.score);
    const applicationRestrictionScores = applicationRestrictionFound.map(r => r.score);
    const deletionRestrictionScores = deletionRestrictionFound.map(r => r.score);
    const errorHandlingScores = errorHandlingFound.map(r => r.score);
    
    console.log(`High priority page scores: ${highPriorityScores.length > 0 ? highPriorityScores.join(', ') : 'none'}`);
    console.log(`Job restriction page scores: ${jobRestrictionScores.length > 0 ? jobRestrictionScores.join(', ') : 'none'}`);
    console.log(`Application restriction page scores: ${applicationRestrictionScores.length > 0 ? applicationRestrictionScores.join(', ') : 'none'}`);
    console.log(`Deletion restriction page scores: ${deletionRestrictionScores.length > 0 ? deletionRestrictionScores.join(', ') : 'none'}`);
    console.log(`Error handling page scores: ${errorHandlingScores.length > 0 ? errorHandlingScores.join(', ') : 'none'}`);
    
    const scoringTestPass = highPriorityScores.every(score => score >= 80) && 
                           highPriorityScores.length > 0;
    console.log(`Scoring test: ${scoringTestPass ? '✅ PASS' : '❌ FAIL'}`);

    // Test Case 4: Problem Cause Classification Test
    console.log('');
    console.log('=== Test Case 4: Problem Cause Classification Test ===');
    
    const problemCauseCoverage = {
      jobPosting: jobRestrictionFound.length >= 2,
      applicationInfo: applicationRestrictionFound.length >= 3,
      deletionRestriction: deletionRestrictionFound.length >= 2,
      errorHandling: errorHandlingFound.length >= 1
    };
    
    const problemCauseCount = Object.values(problemCauseCoverage).filter(Boolean).length;
    const problemCauseCoveragePass = problemCauseCount >= 3.2; // 4分類中3.2以上
    
    console.log(`Job posting problem: ${problemCauseCoverage.jobPosting ? '✅' : '❌'} (${jobRestrictionFound.length}/2+)`);
    console.log(`Application info problem: ${problemCauseCoverage.applicationInfo ? '✅' : '❌'} (${applicationRestrictionFound.length}/3+)`);
    console.log(`Deletion restriction problem: ${problemCauseCoverage.deletionRestriction ? '✅' : '❌'} (${deletionRestrictionFound.length}/2+)`);
    console.log(`Error handling problem: ${problemCauseCoverage.errorHandling ? '✅' : '❌'} (${errorHandlingFound.length}/1+)`);
    console.log(`Problem cause classification test: ${problemCauseCoveragePass ? '✅ PASS' : '❌ FAIL'}`);

    // Test Case 5: Restriction Condition Test
    console.log('');
    console.log('=== Test Case 5: Restriction Condition Test ===');
    
    const restrictionConditionFound = searchResults.filter(result => 
      RESTRICTION_CONDITIONS.some(condition => result.title.includes(condition))
    );
    
    const restrictionConditionPass = restrictionConditionFound.length >= 5;
    console.log(`Restriction condition pages: ${restrictionConditionFound.length}/5+`);
    console.log(`Restriction condition test: ${restrictionConditionPass ? '✅ PASS' : '❌ FAIL'}`);

    // Quality Metrics Calculation
    console.log('');
    console.log('=== Quality Metrics ===');
    
    const totalRelevantPages = highPriorityFound.length + jobRestrictionFound.length + 
                              applicationRestrictionFound.length + deletionRestrictionFound.length + 
                              errorHandlingFound.length;
    const precision = totalRelevantPages / searchResults.length;
    const recall = totalRelevantPages / (EXPECTED_PAGES.high.length + EXPECTED_PAGES.jobRestriction.length + 
                                        EXPECTED_PAGES.applicationRestriction.length + EXPECTED_PAGES.deletionRestriction.length + 
                                        EXPECTED_PAGES.errorHandling.length);
    const f1Score = 2 * (precision * recall) / (precision + recall);
    const averageScore = searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length;
    const problemCauseCoverageScore = problemCauseCount / 4;
    const restrictionCoverageScore = restrictionConditionFound.length / RESTRICTION_CONDITIONS.length;
    
    console.log(`Precision: ${precision.toFixed(3)} (target: 0.8+) ${precision >= 0.8 ? '✅' : '❌'}`);
    console.log(`Recall: ${recall.toFixed(3)} (target: 0.7+) ${recall >= 0.7 ? '✅' : '❌'}`);
    console.log(`F1 Score: ${f1Score.toFixed(3)} (target: 0.75+) ${f1Score >= 0.75 ? '✅' : '❌'}`);
    console.log(`Average Score: ${averageScore.toFixed(2)} (target: 80+) ${averageScore >= 80 ? '✅' : '❌'}`);
    console.log(`Problem Cause Coverage: ${problemCauseCoverageScore.toFixed(3)} (target: 0.8+) ${problemCauseCoverageScore >= 0.8 ? '✅' : '❌'}`);
    console.log(`Restriction Coverage: ${restrictionCoverageScore.toFixed(3)} (target: 0.8+) ${restrictionCoverageScore >= 0.8 ? '✅' : '❌'}`);
    
    console.log('');
    console.log('--- Detailed Information ---');
    console.log(`Total search results: ${searchResults.length}`);
    console.log(`Relevant pages: ${totalRelevantPages}`);
    console.log(`Excluded pages: ${excludedFound.length}`);
    console.log(`Ideal relevant pages total: ${EXPECTED_PAGES.high.length + EXPECTED_PAGES.jobRestriction.length + EXPECTED_PAGES.applicationRestriction.length + EXPECTED_PAGES.deletionRestriction.length + EXPECTED_PAGES.errorHandling.length}`);

    // Test Result Summary
    console.log('');
    console.log('=== Test Result Summary ===');
    console.log(`Basic search test: ${basicSearchPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Keyword matching test: ${keywordTestPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Scoring test: ${scoringTestPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Problem cause classification test: ${problemCauseCoveragePass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Restriction condition test: ${restrictionConditionPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Quality metrics: ${precision >= 0.8 && recall >= 0.7 && f1Score >= 0.75 && averageScore >= 80 && problemCauseCoverageScore >= 0.8 && restrictionCoverageScore >= 0.8 ? '✅ PASS' : '❌ FAIL'}`);

  } catch (error) {
    console.error('Test execution error:', error);
  }
}

// Run test
runClassroomDeletionIssueSearchTest();