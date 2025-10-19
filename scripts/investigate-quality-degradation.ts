/**
 * 品質デグレード原因調査スクリプト
 * Phase 3時点での問題を詳細に分析
 */

import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import * as fs from 'fs';
import { config } from 'dotenv';

config();

const testCases = [
  {
    id: "1",
    query: "会員の退会手続きを教えて",
    expectedPage: "046_【FIX】会員退会機能"
  },
  {
    id: "2",
    query: "教室削除ができないのは何が原因ですか",
    expectedPage: "164_【FIX】教室削除機能"
  },
  {
    id: "3",
    query: "教室をコピーする方法を教えてください",
    expectedPage: "168_【FIX】教室コピー機能"
  },
  {
    id: "4",
    query: "重複応募不可期間はいつからいつまでですか",
    expectedPage: "014_【FIX】求人応募機能"
  },
  {
    id: "5",
    query: "求人に応募できる期間はいつまでですか",
    expectedPage: "014_【FIX】求人応募機能"
  },
  {
    id: "6",
    query: "塾講師プロフィールの学年・職業を更新する方法を教えてください",
    expectedPage: "721_【作成中】学年自動更新バッチ"
  }
];

interface InvestigationResult {
  caseId: string;
  query: string;
  expectedPage: string;
  
  // 検索結果分析
  totalResults: number;
  expectedPageRank: number;
  topResultTitle: string;
  
  // Top 5分析
  top5Titles: string[];
  top5ContainsExpected: boolean;
  
  // 期待ページの詳細
  expectedPageContent: string;
  expectedPageContentLength: number;
  expectedPageHasRelevantInfo: boolean;
  
  // スコア分析
  expectedPageCompositeScore: number;
  expectedPageVectorScore: number;
  expectedPageBm25Score: number;
  expectedPageTitleScore: number;
  
  // Top 1との比較
  top1CompositeScore: number;
  scoreDifference: number;
  
  // コンテキスト分析
  top5ContainsKeywords: boolean;
  top5TotalContentLength: number;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       品質デグレード原因調査（ステップバイステップ）                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  const results: InvestigationResult[] = [];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(100)}`);
    console.log(`事例 ${testCase.id}: ${testCase.query}`);
    console.log(`期待ページ: ${testCase.expectedPage}`);
    console.log('='.repeat(100));

    try {
      // Step 1: 検索実行
      console.log('\n[Step 1] 検索実行中...');
      const searchResults = await searchLanceDB({
        query: testCase.query,
        topK: 150,
        labelFilters: { includeMeetingNotes: false }
      });

      console.log(`   ✅ 検索結果: ${searchResults.length}件\n`);

      // Step 2: 期待ページの位置を確認
      console.log('[Step 2] 期待ページの位置確認...');
      const expectedIndex = searchResults.findIndex(r => r.title === testCase.expectedPage);
      const found = expectedIndex >= 0;
      const rank = found ? expectedIndex + 1 : -1;

      if (found) {
        console.log(`   ✅ 期待ページ発見: #${rank}`);
      } else {
        console.log(`   ❌ 期待ページ未発見`);
      }

      // Step 3: Top 5の内容を確認
      console.log('\n[Step 3] Top 5の内容確認...');
      const top5 = searchResults.slice(0, 5);
      const top5Titles = top5.map(r => r.title);
      const top5ContainsExpected = top5Titles.includes(testCase.expectedPage);

      console.log('   Top 5:');
      top5.forEach((r, i) => {
        const isExpected = r.title === testCase.expectedPage ? ' ⭐ [期待ページ]' : '';
        console.log(`   ${i + 1}. ${r.title}${isExpected}`);
        console.log(`      Composite: ${(r._compositeScore ?? 0).toFixed(4)}`);
        console.log(`      Content length: ${r.content?.length || 0} chars`);
      });

      if (top5ContainsExpected) {
        console.log('\n   ✅ 期待ページはTop 5に含まれています');
      } else {
        console.log('\n   ❌ 期待ページはTop 5に含まれていません');
      }

      // Step 4: 期待ページの詳細分析
      console.log('\n[Step 4] 期待ページの詳細分析...');
      let expectedPageResult = null;
      let expectedPageContent = '';
      let expectedPageContentLength = 0;
      let expectedPageCompositeScore = 0;
      let expectedPageVectorScore = 0;
      let expectedPageBm25Score = 0;
      let expectedPageTitleScore = 0;

      if (found) {
        expectedPageResult = searchResults[expectedIndex];
        expectedPageContent = expectedPageResult.content || '';
        expectedPageContentLength = expectedPageContent.length;
        expectedPageCompositeScore = expectedPageResult._compositeScore ?? 0;
        expectedPageVectorScore = expectedPageResult._scoreBreakdown?.vectorContribution ?? 0;
        expectedPageBm25Score = expectedPageResult._scoreBreakdown?.bm25Contribution ?? 0;
        expectedPageTitleScore = expectedPageResult._scoreBreakdown?.titleContribution ?? 0;

        console.log(`   タイトル: ${expectedPageResult.title}`);
        console.log(`   コンテンツ長: ${expectedPageContentLength}文字`);
        console.log(`   Composite Score: ${expectedPageCompositeScore.toFixed(4)}`);
        console.log(`   ├─ Vector: ${expectedPageVectorScore.toFixed(4)}`);
        console.log(`   ├─ BM25: ${expectedPageBm25Score.toFixed(4)}`);
        console.log(`   └─ Title: ${expectedPageTitleScore.toFixed(4)}`);

        // クエリとの関連性をチェック
        const queryKeywords = testCase.query.match(/[一-龯ぁ-んァ-ヶー]+/g) || [];
        const relevantKeywords = queryKeywords.filter(kw => 
          expectedPageContent.toLowerCase().includes(kw.toLowerCase())
        );

        console.log(`\n   クエリキーワード: [${queryKeywords.join(', ')}]`);
        console.log(`   一致キーワード: [${relevantKeywords.join(', ')}] (${relevantKeywords.length}/${queryKeywords.length})`);
        
        const hasRelevantInfo = relevantKeywords.length / queryKeywords.length >= 0.5;
        console.log(`   関連情報の有無: ${hasRelevantInfo ? '✅ あり' : '❌ なし'}`);

        // コンテンツのプレビュー
        console.log(`\n   コンテンツプレビュー（最初の300文字）:`);
        console.log(`   ${expectedPageContent.substring(0, 300)}...`);
      }

      // Step 5: Top 1との比較
      console.log('\n[Step 5] Top 1との比較...');
      const top1 = searchResults[0];
      const top1CompositeScore = top1._compositeScore ?? 0;
      const scoreDifference = top1CompositeScore - expectedPageCompositeScore;

      console.log(`   Top 1: ${top1.title}`);
      console.log(`   ├─ Composite Score: ${top1CompositeScore.toFixed(4)}`);
      console.log(`   ├─ Vector: ${(top1._scoreBreakdown?.vectorContribution ?? 0).toFixed(4)}`);
      console.log(`   ├─ BM25: ${(top1._scoreBreakdown?.bm25Contribution ?? 0).toFixed(4)}`);
      console.log(`   └─ Title: ${(top1._scoreBreakdown?.titleContribution ?? 0).toFixed(4)}`);
      
      if (found) {
        console.log(`\n   期待ページ: ${testCase.expectedPage}`);
        console.log(`   ├─ Composite Score: ${expectedPageCompositeScore.toFixed(4)}`);
        console.log(`   └─ スコア差: ${scoreDifference.toFixed(4)} (Top 1の方が高い)`);
        
        if (scoreDifference > 0.1) {
          console.log(`   ⚠️ Top 1との大きなスコア差が発見されました`);
        }
      }

      // Step 6: Top 5のコンテキスト分析
      console.log('\n[Step 6] Top 5のコンテキスト分析...');
      const top5TotalContentLength = top5.reduce((sum, r) => sum + (r.content?.length || 0), 0);
      const queryKeywords = testCase.query.match(/[一-龯ぁ-んァ-ヶー]+/g) || [];
      
      console.log(`   Top 5コンテンツ合計長: ${top5TotalContentLength}文字`);
      console.log(`   クエリキーワード: [${queryKeywords.join(', ')}]`);
      
      let top5KeywordMatchCount = 0;
      top5.forEach((r, i) => {
        const content = (r.title + ' ' + r.content).toLowerCase();
        const matchedKeywords = queryKeywords.filter(kw => 
          content.includes(kw.toLowerCase())
        );
        console.log(`   ${i + 1}. ${r.title}`);
        console.log(`      一致キーワード: [${matchedKeywords.join(', ')}] (${matchedKeywords.length}/${queryKeywords.length})`);
        
        if (matchedKeywords.length > 0) {
          top5KeywordMatchCount++;
        }
      });

      const top5ContainsKeywords = top5KeywordMatchCount > 0;
      console.log(`\n   Top 5のキーワードカバレッジ: ${top5KeywordMatchCount}/5件`);

      // Step 7: Geminiに渡されるコンテキストをシミュレート
      console.log('\n[Step 7] Geminiに渡されるコンテキストのシミュレート...');
      const context = top5.map((r, i) => 
        `[Document ${i + 1}] Title: ${r.title}\nContent: ${r.content.substring(0, 500)}...`
      ).join('\n\n');

      console.log(`   コンテキスト総文字数: ${context.length}文字`);
      console.log(`   期待ページが含まれる: ${top5ContainsExpected ? '✅ はい' : '❌ いいえ'}`);

      // 結果を保存
      results.push({
        caseId: testCase.id,
        query: testCase.query,
        expectedPage: testCase.expectedPage,
        totalResults: searchResults.length,
        expectedPageRank: rank,
        topResultTitle: top1.title,
        top5Titles: top5Titles,
        top5ContainsExpected: top5ContainsExpected,
        expectedPageContent: expectedPageContent,
        expectedPageContentLength: expectedPageContentLength,
        expectedPageHasRelevantInfo: found && relevantKeywords.length / queryKeywords.length >= 0.5,
        expectedPageCompositeScore: expectedPageCompositeScore,
        expectedPageVectorScore: expectedPageVectorScore,
        expectedPageBm25Score: expectedPageBm25Score,
        expectedPageTitleScore: expectedPageTitleScore,
        top1CompositeScore: top1CompositeScore,
        scoreDifference: scoreDifference,
        top5ContainsKeywords: top5ContainsKeywords,
        top5TotalContentLength: top5TotalContentLength,
      });

    } catch (error: any) {
      console.error(`\n❌ エラー: ${error.message}`);
    } finally {
      OptimizedLanceDBClient.getInstance().resetConnection();
      await OptimizedLanceDBClient.getInstance().disconnect();
    }
  }

  // 総合分析レポート
  console.log('\n\n' + '='.repeat(100));
  console.log('総合分析レポート');
  console.log('='.repeat(100));

  console.log('\n📊 基本統計:');
  const avgRank = results.reduce((sum, r) => sum + r.expectedPageRank, 0) / results.length;
  const top5Count = results.filter(r => r.top5ContainsExpected).length;
  const top10Count = results.filter(r => r.expectedPageRank <= 10).length;
  const top20Count = results.filter(r => r.expectedPageRank <= 20).length;

  console.log(`   平均順位: ${avgRank.toFixed(1)}`);
  console.log(`   Top 5に含まれる: ${top5Count}/6件 (${(top5Count / 6 * 100).toFixed(1)}%)`);
  console.log(`   Top 10に含まれる: ${top10Count}/6件 (${(top10Count / 6 * 100).toFixed(1)}%)`);
  console.log(`   Top 20に含まれる: ${top20Count}/6件 (${(top20Count / 6 * 100).toFixed(1)}%)`);

  console.log('\n📋 順位分布:');
  results.forEach(r => {
    console.log(`   事例${r.caseId}: #${r.expectedPageRank}`);
  });

  console.log('\n🔍 根本原因分析:');
  
  // 原因1: 順位の問題
  if (top5Count === 0) {
    console.log('\n❌ 原因1: 期待ページがTop 5に入っていない');
    console.log(`   → Geminiに期待ページのコンテンツが渡されていない`);
    console.log(`   → Geminiは「記載されていません」と回答せざるを得ない`);
  }

  // 原因2: スコアリングの問題
  const avgScoreDiff = results.reduce((sum, r) => sum + r.scoreDifference, 0) / results.length;
  if (avgScoreDiff > 0.1) {
    console.log('\n⚠️ 原因2: Top 1と期待ページのスコア差が大きい');
    console.log(`   平均スコア差: ${avgScoreDiff.toFixed(4)}`);
    console.log(`   → 複合スコアリングが期待ページを正しく評価していない可能性`);
  }

  // 原因3: コンテンツの問題
  const noRelevantInfo = results.filter(r => !r.expectedPageHasRelevantInfo).length;
  if (noRelevantInfo > 0) {
    console.log('\n⚠️ 原因3: 期待ページに関連情報が不足');
    console.log(`   関連情報なし: ${noRelevantInfo}/6件`);
    console.log(`   → 期待ページ自体に問題がある可能性`);
  }

  // 原因4: Top 5のキーワードカバレッジ
  const top5WithoutKeywords = results.filter(r => !r.top5ContainsKeywords).length;
  if (top5WithoutKeywords > 0) {
    console.log('\n⚠️ 原因4: Top 5がクエリキーワードをカバーしていない');
    console.log(`   キーワードなし: ${top5WithoutKeywords}/6件`);
    console.log(`   → 検索システムが関連性の低いページを上位にランクしている`);
  }

  console.log('\n\n📝 詳細レポート:');
  console.log('─'.repeat(100));
  console.log('事例 | 順位 | Top5 | 関連情報 | スコア差 | Top5キーワード | 判定');
  console.log('─'.repeat(100));

  results.forEach(r => {
    const top5Status = r.top5ContainsExpected ? '✅' : '❌';
    const relevantStatus = r.expectedPageHasRelevantInfo ? '✅' : '❌';
    const scoreDiffStatus = r.scoreDifference < 0.1 ? '✅' : '⚠️';
    const keywordStatus = r.top5ContainsKeywords ? '✅' : '❌';
    
    let overallJudgment = '✅ 良好';
    if (!r.top5ContainsExpected) {
      overallJudgment = '❌ 順位低い';
    } else if (!r.expectedPageHasRelevantInfo) {
      overallJudgment = '⚠️ 情報不足';
    } else if (r.scoreDifference > 0.2) {
      overallJudgment = '⚠️ スコア低い';
    }

    console.log(
      `${r.caseId.padEnd(4)} | ` +
      `#${String(r.expectedPageRank).padEnd(3)} | ` +
      `${top5Status.padEnd(4)} | ` +
      `${relevantStatus.padEnd(8)} | ` +
      `${r.scoreDifference.toFixed(4).padEnd(8)} ${scoreDiffStatus} | ` +
      `${keywordStatus.padEnd(14)} | ` +
      `${overallJudgment}`
    );
  });

  console.log('─'.repeat(100));

  // 結論
  console.log('\n\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       結論                                                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  if (top5Count === 0) {
    console.log('🔴 主要原因: 期待ページがTop 5に入っていない');
    console.log('\n推奨アクション:');
    console.log('   1. スコアリングアルゴリズムの改善（タイトル重視度を上げる）');
    console.log('   2. Phase 4実装（KG早期統合）で期待ページを上位に');
    console.log('   3. 一時対策: Geminiに渡すページ数を増やす（Top 5 → Top 50）');
  } else if (avgScoreDiff > 0.1) {
    console.log('🟡 主要原因: スコアリングの重み配分が不適切');
    console.log('\n推奨アクション:');
    console.log('   1. タイトルマッチの重みを増やす（20% → 40%）');
    console.log('   2. BM25の重みを調整（40% → 30%）');
  } else {
    console.log('🟢 順位・スコアリングは概ね良好');
    console.log('\n他の原因を調査:');
    console.log('   1. 期待ページのコンテンツ品質');
    console.log('   2. Geminiのプロンプト設計');
    console.log('   3. コンテキスト長の制限');
  }

  // JSONに保存
  const reportPath = 'quality-degradation-investigation.json';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n💾 詳細レポート保存: ${reportPath}`);

  console.log('\n' + '='.repeat(100));
  console.log('調査完了');
  console.log('='.repeat(100));
}

main();


