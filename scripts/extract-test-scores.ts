/**
 * Extract Test Scores Summary
 * 各テストケースのTop 3スコアを抽出
 */

import { searchLanceDB } from '../src/lib/lancedb-search-client';

const testCases = [
  {
    id: 1,
    name: "事例1: 教室削除条件",
    query: "教室削除の条件について教えてください",
    expectedPage: "164_【FIX】教室削除機能"
  },
  {
    id: 2,
    name: "事例2: 教室コピーエラー",
    query: "教室コピーでエラーが発生する条件を教えて",
    expectedPage: "168_【FIX】教室コピー機能"
  },
  {
    id: 3,
    name: "事例3: 会員退会",
    query: "会員の退会手続きを教えて",
    expectedPage: "046_【FIX】会員退会機能"
  },
  {
    id: 4,
    name: "事例4: 求人応募却下",
    query: "求人応募が却下される条件は？",
    expectedPage: "014_【FIX】求人応募機能"
  },
  {
    id: 5,
    name: "事例5: 重複応募不可期間",
    query: "重複応募不可期間はいつからいつまでですか",
    expectedPage: "014_【FIX】求人応募機能"
  },
  {
    id: 6,
    name: "事例6: 学年・職業更新",
    query: "塾講師プロフィールの学年・職業を更新する方法を教えてください",
    expectedPage: "721_【作成中】学年自動更新バッチ"
  }
];

async function main() {
  console.log('='.repeat(100));
  console.log('Test Score Summary Report - Phase 0A-2');
  console.log('='.repeat(100));
  console.log();

  const summaryTable: any[] = [];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`${testCase.name}`);
    console.log(`Query: "${testCase.query}"`);
    console.log(`Expected: ${testCase.expectedPage}`);
    console.log('='.repeat(100));

    try {
      const startTime = Date.now();
      const results = await searchLanceDB({
        query: testCase.query,
        topK: 50,
      });
      const searchTime = Date.now() - startTime;

      // Find the expected page
      const expectedIndex = results.findIndex(r => 
        r.title && r.title.includes(testCase.expectedPage.split('_')[1] || testCase.expectedPage)
      );

      console.log(`\nSearch Time: ${searchTime}ms`);
      console.log(`Results: ${results.length} pages`);
      console.log(`Expected Page Found: ${expectedIndex >= 0 ? 'YES' : 'NO'}`);
      if (expectedIndex >= 0) {
        console.log(`Expected Page Rank: #${expectedIndex + 1}`);
      }

      console.log(`\n${'─'.repeat(100)}`);
      console.log('Top 3 Results with Detailed Scores:');
      console.log('─'.repeat(100));

      for (let i = 0; i < Math.min(3, results.length); i++) {
        const r = results[i];
        console.log(`\n[Rank ${i + 1}] ${r.title}`);
        console.log(`  Source Type: ${r._sourceType || 'unknown'}`);
        
        // Composite Score
        if (r._compositeScore !== undefined) {
          console.log(`  Composite Score: ${r._compositeScore.toFixed(4)}`);
        }
        
        // Score Breakdown
        if (r._scoreBreakdown) {
          const b = r._scoreBreakdown;
          console.log(`  Score Breakdown:`);
          console.log(`    Vector:  ${(b.vectorContribution || 0).toFixed(4)} (weight: 30%)`);
          console.log(`    BM25:    ${(b.bm25Contribution || 0).toFixed(4)} (weight: 40%)`);
          console.log(`    Title:   ${(b.titleContribution || 0).toFixed(4)} (weight: 20%)`);
          console.log(`    Label:   ${(b.labelContribution || 0).toFixed(4)} (weight: 10%)`);
          console.log(`    Total:   ${((b.vectorContribution || 0) + (b.bm25Contribution || 0) + (b.titleContribution || 0) + (b.labelContribution || 0)).toFixed(4)}`);
        }
        
        // Other metrics
        if (r._distance !== undefined) {
          console.log(`  Vector Distance: ${r._distance.toFixed(4)}`);
        }
        if (r._bm25Score !== undefined) {
          console.log(`  BM25 Raw Score: ${r._bm25Score.toFixed(2)}`);
        }
        if (r._titleMatchRatio !== undefined) {
          console.log(`  Title Match Ratio: ${(r._titleMatchRatio * 100).toFixed(1)}%`);
        }
        
        // StructuredLabel info
        if (r.structured_category || r.structured_domain) {
          console.log(`  StructuredLabel:`);
          if (r.structured_category) console.log(`    Category: ${r.structured_category}`);
          if (r.structured_domain) console.log(`    Domain: ${r.structured_domain}`);
          if (r.structured_feature) console.log(`    Feature: ${r.structured_feature}`);
          if (r.structured_status) console.log(`    Status: ${r.structured_status}`);
          if (r.structured_confidence) console.log(`    Confidence: ${r.structured_confidence.toFixed(2)}`);
        }
      }

      // Summary table entry
      const top1 = results[0];
      summaryTable.push({
        case: testCase.id,
        name: testCase.name,
        searchTime,
        found: expectedIndex >= 0 ? 'YES' : 'NO',
        rank: expectedIndex >= 0 ? expectedIndex + 1 : '-',
        pageTitle: top1?.title?.substring(0, 40) || '',
        top1Composite: top1?._compositeScore?.toFixed(4) || 'N/A',
        top1Vector: top1?._scoreBreakdown?.vectorContribution?.toFixed(4) || 'N/A',
        top1BM25: top1?._scoreBreakdown?.bm25Contribution?.toFixed(4) || 'N/A',
        top1TitleScore: top1?._scoreBreakdown?.titleContribution?.toFixed(4) || 'N/A',
        top1Label: top1?._scoreBreakdown?.labelContribution?.toFixed(4) || 'N/A',
      });

    } catch (error: any) {
      console.error(`\nError in ${testCase.name}:`, error.message);
    }

    // Wait between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Print summary table
  console.log(`\n\n${'='.repeat(100)}`);
  console.log('SUMMARY TABLE - Top 1 Scores for Each Case');
  console.log('='.repeat(100));
  console.log();

  console.log('Case | Search Time | Found | Rank | Composite | Vector | BM25   | Title  | Label  |');
  console.log('-----|-------------|-------|------|-----------|--------|--------|--------|--------|');
  
  for (const row of summaryTable) {
    console.log(
      `${String(row.case).padEnd(4)} | ` +
      `${String(row.searchTime + 'ms').padEnd(11)} | ` +
      `${String(row.found).padEnd(5)} | ` +
      `${String(row.rank).padEnd(4)} | ` +
      `${String(row.top1Composite).padEnd(9)} | ` +
      `${String(row.top1Vector).padEnd(6)} | ` +
      `${String(row.top1BM25).padEnd(6)} | ` +
      `${String(row.top1TitleScore).padEnd(6)} | ` +
      `${String(row.top1Label).padEnd(6)} |`
    );
  }
  
  console.log();
  console.log('Note:');
  console.log('- Composite = Vector + BM25 + Title + Label (weighted sum)');
  console.log('- Weights: Vector 30%, BM25 40%, Title 20%, Label 10%');
  console.log('- Label contribution comes from StructuredLabel matching (domain, feature, tags, etc.)');
  console.log('- L:0.03 means StructuredLabel contributed 0.03 to the final score');

  console.log(`\n${'='.repeat(100)}`);
  console.log('Report Complete');
  console.log('='.repeat(100));
}

main().catch(console.error);

