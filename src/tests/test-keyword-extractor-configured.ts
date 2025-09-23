/**
 * 設定値化されたキーワード抽出のテスト
 */

import 'dotenv/config';
import { KeywordListsLoader } from '../lib/keyword-lists-loader';
import { extractKeywordsConfigured, analyzeKeywordExtraction, batchAnalyzeKeywordExtraction } from '../lib/keyword-extractor-configured';

async function testKeywordListsLoader() {
  console.log('=== キーワードリストローダーテスト ===');
  
  const loader = KeywordListsLoader.getInstance();
  
  try {
    // キーワードリストを読み込み
    const keywordLists = await loader.loadKeywordLists();
    console.log('✅ キーワードリストの読み込み成功');
    console.log('統計情報:', keywordLists.statistics);
    
    // テストクエリでのキーワード抽出
    const testQueries = [
      '教室管理の詳細は',
      '教室削除ができないのは何が原因ですか',
      '会員のログイン機能の詳細を教えて',
      'オファー機能の種類は？'
    ];
    
    for (const query of testQueries) {
      console.log(`\n--- クエリ: "${query}" ---`);
      const extractedKeywords = loader.extractKeywords(query);
      console.log('ドメイン名:', extractedKeywords.domainNames);
      console.log('機能名:', extractedKeywords.functionNames);
      console.log('操作名:', extractedKeywords.operationNames);
      console.log('システム項目:', extractedKeywords.systemFields.slice(0, 5)); // 最初の5個のみ表示
      console.log('システム用語:', extractedKeywords.systemTerms.slice(0, 5)); // 最初の5個のみ表示
      console.log('関連キーワード:', extractedKeywords.relatedKeywords.slice(0, 5)); // 最初の5個のみ表示
      console.log('全キーワード数:', extractedKeywords.allKeywords.length);
      
      // 各キーワードの詳細情報を確認
      for (const keyword of extractedKeywords.allKeywords.slice(0, 3)) { // 最初の3個のみ表示
        const info = loader.getKeywordInfo(keyword);
        console.log(`  ${keyword}: ${info.category} (${info.priority}優先度)`);
      }
    }
    
  } catch (error) {
    console.error('❌ キーワードリストの読み込みに失敗:', error);
  }
}

async function testConfiguredKeywordExtractor() {
  console.log('\n=== 設定値化キーワード抽出器テスト ===');
  
  const testCases = [
    {
      name: '教室管理',
      query: '教室管理の詳細は'
    },
    {
      name: '教室削除問題',
      query: '教室削除ができないのは何が原因ですか'
    },
    {
      name: '会員ログイン',
      query: '会員のログイン機能の詳細を教えて'
    },
    {
      name: 'オファー機能',
      query: 'オファー機能の種類は？'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- テストケース: ${testCase.name} ---`);
    console.log(`クエリ: "${testCase.query}"`);
    
    try {
      const result = await extractKeywordsConfigured(testCase.query);
      
      console.log('抽出されたキーワード:', result.keywords);
      console.log('最高優先度キーワード:', Array.from(result.criticalPriority));
      console.log('高優先度キーワード:', Array.from(result.highPriority));
      console.log('中優先度キーワード:', Array.from(result.mediumPriority));
      console.log('低優先度キーワード:', Array.from(result.lowPriority));
      console.log('処理時間:', result.metadata.processingTime + 'ms');
      console.log('キーワードソース:', result.metadata.keywordSource);
      console.log('統計情報:', result.metadata.statistics);
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

async function testKeywordAnalysis() {
  console.log('\n=== キーワード分析テスト ===');
  
  const testQueries = [
    '教室管理の詳細は',
    '教室削除ができないのは何が原因ですか',
    '会員のログイン機能の詳細を教えて'
  ];
  
  for (const query of testQueries) {
    console.log(`\n--- 分析対象: "${query}" ---`);
    
    try {
      const analysis = await analyzeKeywordExtraction(query);
      
      console.log('総キーワード数:', analysis.analysis.totalKeywords);
      console.log('最高優先度:', analysis.analysis.criticalCount);
      console.log('高優先度:', analysis.analysis.highCount);
      console.log('中優先度:', analysis.analysis.mediumCount);
      console.log('低優先度:', analysis.analysis.lowCount);
      console.log('ドメインキーワード有無:', analysis.analysis.hasDomainKeywords);
      console.log('機能キーワード有無:', analysis.analysis.hasFunctionKeywords);
      console.log('品質スコア:', analysis.analysis.qualityScore);
      console.log('カテゴリ別カバレッジ:', analysis.analysis.coverage);
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

async function testBatchAnalysis() {
  console.log('\n=== 一括分析テスト ===');
  
  const queries = [
    '教室管理の詳細は',
    '教室削除ができないのは何が原因ですか',
    '会員のログイン機能の詳細を教えて',
    'オファー機能の種類は？',
    '求人管理の機能について教えて',
    '企業管理の仕様を確認したい'
  ];
  
  try {
    const batchResult = await batchAnalyzeKeywordExtraction(queries);
    
    console.log('総クエリ数:', batchResult.summary.totalQueries);
    console.log('平均品質スコア:', batchResult.summary.averageQualityScore.toFixed(1));
    console.log('成功率:', batchResult.summary.successRate.toFixed(1) + '%');
    console.log('平均処理時間:', batchResult.summary.averageProcessingTime.toFixed(1) + 'ms');
    console.log('キーワードソース分布:', batchResult.summary.keywordSourceDistribution);
    
    console.log('\n--- 個別結果 ---');
    for (const result of batchResult.results) {
      console.log(`${result.query}: スコア${result.analysis.qualityScore}, キーワード${result.analysis.totalKeywords}個`);
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

async function testKeywordListsStatistics() {
  console.log('\n=== キーワードリスト統計情報テスト ===');
  
  const loader = KeywordListsLoader.getInstance();
  
  if (loader.isLoaded()) {
    const stats = loader.getStatistics();
    console.log('キーワードリスト統計:', stats);
    
    const lastLoaded = loader.getLastLoaded();
    console.log('最後に読み込まれた時刻:', lastLoaded);
    
    // 設定値として使用するための設定オブジェクトを生成
    const config = loader.generateConfig();
    console.log('設定値生成完了:');
    console.log('- ドメイン名:', config.domainNames.length + '個');
    console.log('- 機能名:', config.functionNames.length + '個');
    console.log('- 操作名:', config.operationNames.length + '個');
    console.log('- システム項目:', config.systemFields.length + '個');
    console.log('- システム用語:', config.systemTerms.length + '個');
    console.log('- 関連キーワード:', config.relatedKeywords.length + '個');
    
  } else {
    console.log('キーワードリストが読み込まれていません');
  }
}

// テスト実行
async function runAllTests() {
  await testKeywordListsLoader();
  await testConfiguredKeywordExtractor();
  await testKeywordAnalysis();
  await testBatchAnalysis();
  await testKeywordListsStatistics();
}

runAllTests().catch(console.error);
