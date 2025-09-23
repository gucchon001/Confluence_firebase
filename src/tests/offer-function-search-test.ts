/**
 * オファー機能検索品質テスト
 * case_offer-function-search-quality-test.md に基づくテスト
 */

import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';
import { extractKeywordsConfigured } from '../lib/keyword-extractor-configured';

// テスト対象クエリ
const TEST_QUERY = 'オファー機能の種類は？';

// 理想の抽出ページ（優先度：高）
const EXPECTED_HIGH_PRIORITY_PAGES = [
  '071_【FIX】オファー一覧閲覧機能',
  '【FIX】オファー履歴',
  '193_【FIX】オファー新規作成機能',
  '194_【FIX】自動オファー設定機能',
  '053_【FIX】スカウト・マッチ利用設定機能',
  '562_【FIX】自動オファー条件設定機能'
];

// パーソナルオファー管理ページ（優先度：高）
const EXPECTED_PERSONAL_OFFER_PAGES = [
  '542_【FIX】パーソナルオファー管理 - テンプレート新規作成機能',
  '543_【FIX】パーソナルオファー管理 - テンプレート編集機能'
];

// 自動オファー関連ページ（優先度：中）
const EXPECTED_AUTO_OFFER_PAGES = [
  '【FIX】オファー設定情報（自動オファー）',
  '742_【作成中】自動オファー送信バッチ'
];

// 通知関連ページ（優先度：中）
const EXPECTED_NOTIFICATION_PAGES = [
  'パーソナルオファー受信通知メール（会員宛）',
  '自動オファー受信通知メール（会員宛）'
];

// 除外されるべきページ
const EXCLUDED_PAGES = [
  '■オファー機能',
  '■オファー管理機能',
  '■会員管理機能',
  'オファー統計データ',
  'オファー送信ログ',
  '【作成中】オファー分析機能'
];

// 理想のキーワード抽出結果
const EXPECTED_KEYWORDS = [
  'オファー機能', 'オファー', 'スカウト', 'マッチ', 
  'パーソナルオファー', '自動オファー', 'オファー一覧', 
  'オファー履歴', 'オファー種類'
];

async function testBasicSearch() {
  console.log('=== テストケース1: 基本検索テスト ===');
  console.log(`クエリ: "${TEST_QUERY}"`);
  
  try {
    const searchResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 20,
      useLunrIndex: false
    });
    
    console.log(`\n検索結果数: ${searchResults.length}件`);
    
    // 上位10件の結果を表示
    console.log('\n--- 上位10件の検索結果 ---');
    searchResults.slice(0, 10).forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   スコア: ${result.score.toFixed(2)}`);
      console.log(`   ラベル: ${JSON.stringify(result.labels)}`);
      console.log('');
    });
    
    // 期待されるページの含有率をチェック
    const foundHighPriorityPages = searchResults.filter(result => 
      EXPECTED_HIGH_PRIORITY_PAGES.some(expected => 
        result.title.includes(expected) || expected.includes(result.title)
      )
    );
    
    const foundPersonalOfferPages = searchResults.filter(result => 
      EXPECTED_PERSONAL_OFFER_PAGES.some(expected => 
        result.title.includes(expected) || expected.includes(result.title)
      )
    );
    
    const foundAutoOfferPages = searchResults.filter(result => 
      EXPECTED_AUTO_OFFER_PAGES.some(expected => 
        result.title.includes(expected) || expected.includes(result.title)
      )
    );
    
    const foundNotificationPages = searchResults.filter(result => 
      EXPECTED_NOTIFICATION_PAGES.some(expected => 
        result.title.includes(expected) || expected.includes(result.title)
      )
    );
    
    // 除外ページのチェック
    const foundExcludedPages = searchResults.filter(result => 
      EXCLUDED_PAGES.some(excluded => 
        result.title.includes(excluded) || excluded.includes(result.title)
      )
    );
    
    console.log('\n--- 期待されるページの含有状況 ---');
    console.log(`主要なオファー機能ページ: ${foundHighPriorityPages.length}/${EXPECTED_HIGH_PRIORITY_PAGES.length}件`);
    console.log(`パーソナルオファー管理ページ: ${foundPersonalOfferPages.length}/${EXPECTED_PERSONAL_OFFER_PAGES.length}件`);
    console.log(`自動オファー関連ページ: ${foundAutoOfferPages.length}/${EXPECTED_AUTO_OFFER_PAGES.length}件`);
    console.log(`通知関連ページ: ${foundNotificationPages.length}/${EXPECTED_NOTIFICATION_PAGES.length}件`);
    console.log(`除外されるべきページ: ${foundExcludedPages.length}件`);
    
    // 上位3件のスコアチェック
    const top3Scores = searchResults.slice(0, 3).map(result => result.score);
    console.log(`\n上位3件のスコア: ${top3Scores.map(s => s.toFixed(2)).join(', ')}`);
    
    // 合格基準の評価
    const totalExpectedPages = EXPECTED_HIGH_PRIORITY_PAGES.length + EXPECTED_PERSONAL_OFFER_PAGES.length;
    const totalFoundPages = foundHighPriorityPages.length + foundPersonalOfferPages.length;
    const expectedPagesRatio = totalFoundPages / totalExpectedPages;
    
    console.log('\n--- 合格基準の評価 ---');
    console.log(`主要なオファー機能ページの含有率: ${(expectedPagesRatio * 100).toFixed(1)}% (目標: 62.5%以上)`);
    console.log(`除外ページの含有数: ${foundExcludedPages.length}件 (目標: 0件)`);
    console.log(`上位3件のスコア: ${top3Scores.every(s => s >= 70) ? '合格' : '不合格'} (目標: 70以上)`);
    
    return {
      searchResults,
      foundHighPriorityPages,
      foundPersonalOfferPages,
      foundAutoOfferPages,
      foundNotificationPages,
      foundExcludedPages,
      top3Scores,
      expectedPagesRatio
    };
    
  } catch (error) {
    console.error('基本検索テストでエラー:', error);
    return null;
  }
}

async function testKeywordMatching() {
  console.log('\n=== テストケース2: キーワードマッチングテスト ===');
  console.log(`クエリ: "${TEST_QUERY}"`);
  
  try {
    const keywordResult = await extractKeywordsConfigured(TEST_QUERY);
    
    console.log('\n--- 抽出されたキーワード ---');
    console.log(`総キーワード数: ${keywordResult.keywords.length}個`);
    console.log(`キーワード: ${JSON.stringify(keywordResult.keywords)}`);
    console.log(`最高優先度: ${JSON.stringify(Array.from(keywordResult.criticalPriority))}`);
    console.log(`高優先度: ${JSON.stringify(Array.from(keywordResult.highPriority))}`);
    console.log(`中優先度: ${JSON.stringify(Array.from(keywordResult.mediumPriority))}`);
    console.log(`低優先度: ${JSON.stringify(Array.from(keywordResult.lowPriority))}`);
    
    console.log('\n--- カテゴリ別抽出状況 ---');
    console.log(`ドメイン名: ${keywordResult.metadata.statistics.byCategory.domainNames}個`);
    console.log(`機能名: ${keywordResult.metadata.statistics.byCategory.functionNames}個`);
    console.log(`操作名: ${keywordResult.metadata.statistics.byCategory.operationNames}個`);
    console.log(`システム項目: ${keywordResult.metadata.statistics.byCategory.systemFields}個`);
    console.log(`システム用語: ${keywordResult.metadata.statistics.byCategory.systemTerms}個`);
    console.log(`関連キーワード: ${keywordResult.metadata.statistics.byCategory.relatedKeywords}個`);
    
    // 理想のキーワードとの比較
    const matchedKeywords = keywordResult.keywords.filter(keyword => 
      EXPECTED_KEYWORDS.some(expected => 
        keyword.includes(expected) || expected.includes(keyword)
      )
    );
    
    const matchRate = (matchedKeywords.length / EXPECTED_KEYWORDS.length) * 100;
    
    console.log('\n--- 理想のキーワードとの比較 ---');
    console.log(`一致したキーワード: ${JSON.stringify(matchedKeywords)}`);
    console.log(`一致率: ${matchRate.toFixed(1)}%`);
    
    // 合格基準の評価
    console.log('\n--- 合格基準の評価 ---');
    console.log(`キーワード数: ${keywordResult.keywords.length}個 (目標: 6個以上) ${keywordResult.keywords.length >= 6 ? '✅' : '❌'}`);
    console.log(`オファー機能関連キーワード: ${matchedKeywords.length}個 (目標: 3個以上) ${matchedKeywords.length >= 3 ? '✅' : '❌'}`);
    console.log(`キーワードソース: ${keywordResult.metadata.keywordSource} ${keywordResult.metadata.keywordSource === 'keyword-lists' ? '✅' : '❌'}`);
    
    return {
      keywordResult,
      matchedKeywords,
      matchRate
    };
    
  } catch (error) {
    console.error('キーワードマッチングテストでエラー:', error);
    return null;
  }
}

async function testScoring() {
  console.log('\n=== テストケース3: スコアリングテスト ===');
  console.log(`クエリ: "${TEST_QUERY}"`);
  
  try {
    const searchResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 20,
      useLunrIndex: false
    });
    
    // スコア分布の分析
    const scoreRanges = {
      '75-90': 0,
      '70-80': 0,
      '60-75': 0,
      '55-70': 0,
      '50以下': 0
    };
    
    searchResults.forEach(result => {
      const score = result.score;
      if (score >= 75 && score <= 90) scoreRanges['75-90']++;
      else if (score >= 70 && score < 75) scoreRanges['70-80']++;
      else if (score >= 60 && score < 70) scoreRanges['60-75']++;
      else if (score >= 55 && score < 60) scoreRanges['55-70']++;
      else scoreRanges['50以下']++;
    });
    
    console.log('\n--- スコア分布 ---');
    Object.entries(scoreRanges).forEach(([range, count]) => {
      console.log(`${range}: ${count}件`);
    });
    
    const averageScore = searchResults.reduce((sum, result) => sum + result.score, 0) / searchResults.length;
    console.log(`\n平均スコア: ${averageScore.toFixed(2)} (目標: 70以上)`);
    
    // 期待されるスコア範囲との比較
    const highScorePages = searchResults.filter(result => result.score >= 75);
    const mediumScorePages = searchResults.filter(result => result.score >= 60 && result.score < 75);
    
    console.log(`\n高スコアページ(75以上): ${highScorePages.length}件`);
    console.log(`中スコアページ(60-75): ${mediumScorePages.length}件`);
    
    return {
      searchResults,
      scoreRanges,
      averageScore,
      highScorePages,
      mediumScorePages
    };
    
  } catch (error) {
    console.error('スコアリングテストでエラー:', error);
    return null;
  }
}

async function testFunctionClassification() {
  console.log('\n=== テストケース4: 機能分類テスト ===');
  console.log(`クエリ: "${TEST_QUERY}"`);
  
  try {
    const searchResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 20,
      useLunrIndex: false
    });
    
    // 機能分類
    const scoutPages = searchResults.filter(result => 
      result.title.includes('パーソナルオファー') || 
      result.title.includes('スカウト') ||
      result.title.includes('オファー新規作成')
    );
    
    const matchPages = searchResults.filter(result => 
      result.title.includes('自動オファー') || 
      result.title.includes('マッチ') ||
      result.title.includes('オファー設定')
    );
    
    const commonPages = searchResults.filter(result => 
      result.title.includes('オファー一覧') || 
      result.title.includes('オファー履歴') ||
      result.title.includes('スカウト・マッチ利用設定')
    );
    
    console.log('\n--- 機能分類結果 ---');
    console.log(`スカウト（パーソナルオファー）関連ページ: ${scoutPages.length}件`);
    scoutPages.forEach(page => console.log(`  - ${page.title}`));
    
    console.log(`\nマッチ（自動オファー）関連ページ: ${matchPages.length}件`);
    matchPages.forEach(page => console.log(`  - ${page.title}`));
    
    console.log(`\n共通機能ページ: ${commonPages.length}件`);
    commonPages.forEach(page => console.log(`  - ${page.title}`));
    
    // 合格基準の評価
    console.log('\n--- 合格基準の評価 ---');
    console.log(`スカウト関連ページ: ${scoutPages.length}件 (目標: 3件以上) ${scoutPages.length >= 3 ? '✅' : '❌'}`);
    console.log(`マッチ関連ページ: ${matchPages.length}件 (目標: 3件以上) ${matchPages.length >= 3 ? '✅' : '❌'}`);
    console.log(`共通機能ページ: ${commonPages.length}件 (目標: 2件以上) ${commonPages.length >= 2 ? '✅' : '❌'}`);
    
    return {
      searchResults,
      scoutPages,
      matchPages,
      commonPages
    };
    
  } catch (error) {
    console.error('機能分類テストでエラー:', error);
    return null;
  }
}

async function calculateQualityMetrics() {
  console.log('\n=== 品質メトリクス計算 ===');
  
  try {
    const searchResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 20,
      useLunrIndex: false
    });
    
    // 関連ページの定義（理想の抽出ページ）
    const allExpectedPages = [
      ...EXPECTED_HIGH_PRIORITY_PAGES,
      ...EXPECTED_PERSONAL_OFFER_PAGES,
      ...EXPECTED_AUTO_OFFER_PAGES,
      ...EXPECTED_NOTIFICATION_PAGES
    ];
    
    // 関連するページの検索
    const relevantPages = searchResults.filter(result => 
      allExpectedPages.some(expected => 
        result.title.includes(expected) || expected.includes(result.title)
      )
    );
    
    // 除外ページの検索
    const excludedPages = searchResults.filter(result => 
      EXCLUDED_PAGES.some(excluded => 
        result.title.includes(excluded) || excluded.includes(result.title)
      )
    );
    
    // メトリクス計算
    const precision = relevantPages.length / searchResults.length;
    const recall = relevantPages.length / allExpectedPages.length;
    const f1Score = 2 * (precision * recall) / (precision + recall);
    const averageScore = searchResults.reduce((sum, result) => sum + result.score, 0) / searchResults.length;
    
    // 機能分類カバレッジ
    const scoutPages = searchResults.filter(result => 
      result.title.includes('パーソナルオファー') || 
      result.title.includes('スカウト')
    );
    const matchPages = searchResults.filter(result => 
      result.title.includes('自動オファー') || 
      result.title.includes('マッチ')
    );
    const commonPages = searchResults.filter(result => 
      result.title.includes('オファー一覧') || 
      result.title.includes('オファー履歴')
    );
    
    const coverage = (scoutPages.length > 0 ? 1 : 0) + (matchPages.length > 0 ? 1 : 0) + (commonPages.length > 0 ? 1 : 0);
    const coverageRatio = coverage / 3;
    
    console.log('\n--- 品質メトリクス ---');
    console.log(`検索精度（Precision）: ${precision.toFixed(3)} (目標: 0.8以上) ${precision >= 0.8 ? '✅' : '❌'}`);
    console.log(`検索再現率（Recall）: ${recall.toFixed(3)} (目標: 0.7以上) ${recall >= 0.7 ? '✅' : '❌'}`);
    console.log(`F1スコア: ${f1Score.toFixed(3)} (目標: 0.75以上) ${f1Score >= 0.75 ? '✅' : '❌'}`);
    console.log(`平均スコア: ${averageScore.toFixed(2)} (目標: 70以上) ${averageScore >= 70 ? '✅' : '❌'}`);
    console.log(`機能分類カバレッジ: ${coverageRatio.toFixed(3)} (目標: 0.8以上) ${coverageRatio >= 0.8 ? '✅' : '❌'}`);
    
    console.log('\n--- 詳細情報 ---');
    console.log(`検索結果総数: ${searchResults.length}件`);
    console.log(`関連ページ数: ${relevantPages.length}件`);
    console.log(`除外ページ数: ${excludedPages.length}件`);
    console.log(`理想の関連ページ総数: ${allExpectedPages.length}件`);
    
    return {
      precision,
      recall,
      f1Score,
      averageScore,
      coverageRatio,
      relevantPages,
      excludedPages
    };
    
  } catch (error) {
    console.error('品質メトリクス計算でエラー:', error);
    return null;
  }
}

// メインテスト実行
async function runAllTests() {
  console.log('=== オファー機能検索品質テスト ===');
  console.log(`テスト対象クエリ: "${TEST_QUERY}"`);
  console.log(`テスト実行時刻: ${new Date().toISOString()}`);
  
  const results = {
    basicSearch: await testBasicSearch(),
    keywordMatching: await testKeywordMatching(),
    scoring: await testScoring(),
    functionClassification: await testFunctionClassification(),
    qualityMetrics: await calculateQualityMetrics()
  };
  
  console.log('\n=== テスト結果サマリー ===');
  
  if (results.basicSearch) {
    console.log(`基本検索テスト: ${results.basicSearch.expectedPagesRatio >= 0.625 ? '✅ 合格' : '❌ 不合格'}`);
  }
  
  if (results.keywordMatching) {
    console.log(`キーワードマッチングテスト: ${results.keywordMatching.matchRate >= 30 ? '✅ 合格' : '❌ 不合格'}`);
  }
  
  if (results.scoring) {
    console.log(`スコアリングテスト: ${results.scoring.averageScore >= 70 ? '✅ 合格' : '❌ 不合格'}`);
  }
  
  if (results.functionClassification) {
    const { scoutPages, matchPages, commonPages } = results.functionClassification;
    const classificationPass = scoutPages.length >= 3 && matchPages.length >= 3 && commonPages.length >= 2;
    console.log(`機能分類テスト: ${classificationPass ? '✅ 合格' : '❌ 不合格'}`);
  }
  
  if (results.qualityMetrics) {
    const { precision, recall, f1Score, averageScore, coverageRatio } = results.qualityMetrics;
    const metricsPass = precision >= 0.8 && recall >= 0.7 && f1Score >= 0.75 && averageScore >= 70 && coverageRatio >= 0.8;
    console.log(`品質メトリクス: ${metricsPass ? '✅ 合格' : '❌ 不合格'}`);
  }
  
  return results;
}

// テスト実行
runAllTests().catch(console.error);
