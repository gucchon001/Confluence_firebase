/**
 * Performance Test Score Details Viewer
 * Shows detailed scores for each test case
 */

import { searchLanceDB } from '../src/lib/lancedb-search-client';

const testCases = [
  {
    id: 1,
    name: "Case 1: Classroom Deletion",
    query: "教室削除の条件について教えてください",
    expectedPage: "164_【FIX】教室削除機能"
  },
  {
    id: 2,
    name: "Case 2: Classroom Copy Error",
    query: "教室コピーでエラーが発生する条件を教えて",
    expectedPage: "168_【FIX】教室コピー機能"
  },
  {
    id: 3,
    name: "Case 3: Member Withdrawal",
    query: "会員の退会手続きを教えて",
    expectedPage: "046_【FIX】会員退会機能"
  },
  {
    id: 4,
    name: "Case 4: Job Application Rejection",
    query: "求人応募が却下される条件は？",
    expectedPage: "014_【FIX】求人応募機能"
  },
  {
    id: 5,
    name: "Case 5: Duplicate Application Period",
    query: "重複応募不可期間はいつからいつまでですか",
    expectedPage: "014_【FIX】求人応募機能"
  },
  {
    id: 6,
    name: "Case 6: Update Grade and Occupation",
    query: "塾講師プロフィールの学年・職業を更新する方法を教えてください",
    expectedPage: "721_【作成中】学年自動更新バッチ"
  }
];

async function main() {
  console.log('='.repeat(80));
  console.log('Performance Test - Detailed Score Analysis');
  console.log('='.repeat(80));
  console.log();

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expectedPage}`);
    console.log('='.repeat(80));

    try {
      const results = await searchLanceDB({
        query: testCase.query,
        topK: 50,
      });

      // Find the expected page
      const expectedIndex = results.findIndex(r => 
        r.title && r.title.includes(testCase.expectedPage.split('_')[0])
      );

      console.log(`\nSearch completed: ${results.length} results`);
      console.log(`Expected page found: ${expectedIndex >= 0 ? 'YES' : 'NO'}`);
      if (expectedIndex >= 0) {
        console.log(`Rank: #${expectedIndex + 1}`);
      }

      console.log(`\nTop 3 Results with Scores:`);
      console.log('-'.repeat(80));

      for (let i = 0; i < Math.min(3, results.length); i++) {
        const r = results[i];
        console.log(`\n${i + 1}. ${r.title}`);
        
        // Composite Score
        if (r._compositeScore !== undefined) {
          console.log(`   Composite Score: ${r._compositeScore.toFixed(4)}`);
        }
        
        // Score Breakdown
        if (r._scoreBreakdown) {
          const b = r._scoreBreakdown;
          console.log(`   Score Breakdown:`);
          console.log(`     - Vector:  ${(b.vectorContribution || 0).toFixed(4)} (${((b.vectorContribution || 0) * 100).toFixed(1)}%)`);
          console.log(`     - BM25:    ${(b.bm25Contribution || 0).toFixed(4)} (${((b.bm25Contribution || 0) * 100).toFixed(1)}%)`);
          console.log(`     - Title:   ${(b.titleContribution || 0).toFixed(4)} (${((b.titleContribution || 0) * 100).toFixed(1)}%)`);
          console.log(`     - Label:   ${(b.labelContribution || 0).toFixed(4)} (${((b.labelContribution || 0) * 100).toFixed(1)}%)`);
        }
        
        // Other scores
        if (r._distance !== undefined) {
          console.log(`   Vector Distance: ${r._distance.toFixed(4)}`);
        }
        if (r._bm25Score !== undefined) {
          console.log(`   BM25 Score: ${r._bm25Score.toFixed(2)}`);
        }
        if (r._titleMatchRatio !== undefined) {
          console.log(`   Title Match Ratio: ${(r._titleMatchRatio * 100).toFixed(1)}%`);
        }
        
        // StructuredLabel info
        if (r.structured_category || r.structured_domain) {
          console.log(`   StructuredLabel:`);
          if (r.structured_category) console.log(`     - Category: ${r.structured_category}`);
          if (r.structured_domain) console.log(`     - Domain: ${r.structured_domain}`);
          if (r.structured_feature) console.log(`     - Feature: ${r.structured_feature}`);
          if (r.structured_status) console.log(`     - Status: ${r.structured_status}`);
        }
      }

      // Expected page details
      if (expectedIndex >= 0 && expectedIndex < results.length) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`Expected Page Details (Rank #${expectedIndex + 1}):`);
        const r = results[expectedIndex];
        
        if (r._compositeScore !== undefined) {
          console.log(`Composite Score: ${r._compositeScore.toFixed(4)}`);
        }
        
        if (r._scoreBreakdown) {
          const b = r._scoreBreakdown;
          console.log(`Score Breakdown:`);
          console.log(`  - Vector:  ${(b.vectorContribution || 0).toFixed(4)} (${((b.vectorContribution || 0) * 100).toFixed(1)}%)`);
          console.log(`  - BM25:    ${(b.bm25Contribution || 0).toFixed(4)} (${((b.bm25Contribution || 0) * 100).toFixed(1)}%)`);
          console.log(`  - Title:   ${(b.titleContribution || 0).toFixed(4)} (${((b.titleContribution || 0) * 100).toFixed(1)}%)`);
          console.log(`  - Label:   ${(b.labelContribution || 0).toFixed(4)} (${((b.labelContribution || 0) * 100).toFixed(1)}%)`);
        }
      }

    } catch (error) {
      console.error(`Error in test case ${testCase.id}:`, error);
    }

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('Score Analysis Complete');
  console.log('='.repeat(80));
}

main().catch(console.error);

