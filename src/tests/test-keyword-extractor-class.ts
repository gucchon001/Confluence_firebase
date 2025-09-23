/**
 * クラスベースキーワード抽出のテストスクリプト
 */

import 'dotenv/config';
import { KeywordExtractor, ConfigManager } from '../lib/keyword-extractor-class';

async function testKeywordExtractorClass() {
  console.log('=== クラスベースキーワード抽出テスト ===');
  
  // 本番設定でテスト
  const productionConfig = ConfigManager.getProductionConfig();
  const extractor = new KeywordExtractor(productionConfig);
  
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
      const result = await extractor.extract(testCase.query);
      
      console.log('抽出されたキーワード:', result.keywords);
      console.log('高優先度キーワード:', Array.from(result.highPriority));
      console.log('低優先度キーワード:', Array.from(result.lowPriority));
      console.log('品質スコア:', result.quality.score);
      console.log('品質評価:', result.quality.isValid ? '✅ 良好' : '❌ 改善必要');
      console.log('処理時間:', result.metadata.processingTime + 'ms');
      
      if (result.quality.issues.length > 0) {
        console.log('問題点:', result.quality.issues);
      }
      
      console.log('品質詳細:', result.quality.breakdown);
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

async function testIndividualComponents() {
  console.log('\n=== 個別コンポーネントテスト ===');
  
  const query = '教室管理の詳細は';
  
  // 基本キーワード抽出テスト
  console.log('\n--- 基本キーワード抽出 ---');
  const { BasicKeywordExtractor } = await import('../lib/keyword-extractor-class');
  const basicExtractor = new BasicKeywordExtractor();
  const basicKeywords = basicExtractor.extract(query);
  console.log('基本キーワード:', basicKeywords);
  
  // ドメインキーワード抽出テスト
  console.log('\n--- ドメインキーワード抽出 ---');
  const { DomainKeywordExtractor } = await import('../lib/keyword-extractor-class');
  const domainExtractor = new DomainKeywordExtractor();
  const domainKeywords = domainExtractor.extract(query);
  console.log('ドメインキーワード:', domainKeywords);
  
  // 機能キーワード抽出テスト
  console.log('\n--- 機能キーワード抽出 ---');
  const { FunctionKeywordExtractor } = await import('../lib/keyword-extractor-class');
  const functionExtractor = new FunctionKeywordExtractor();
  const functionKeywords = functionExtractor.extract(query);
  console.log('機能キーワード:', functionKeywords);
  
  // 品質検証テスト
  console.log('\n--- 品質検証 ---');
  const { KeywordQualityValidator } = await import('../lib/keyword-extractor-class');
  const qualityValidator = new KeywordQualityValidator();
  const allKeywords = [...basicKeywords, ...domainKeywords, ...functionKeywords];
  const quality = qualityValidator.validate(allKeywords);
  console.log('品質結果:', quality);
}

async function testConfigurationManagement() {
  console.log('\n=== 設定管理テスト ===');
  
  // 本番設定
  console.log('\n--- 本番設定 ---');
  const productionConfig = ConfigManager.getProductionConfig();
  console.log('LLM有効:', productionConfig.llm?.enabled);
  console.log('最大キーワード数:', productionConfig.selector?.maxKeywords);
  
  // テスト設定
  console.log('\n--- テスト設定 ---');
  const testConfig = ConfigManager.getTestConfig();
  console.log('LLM有効:', testConfig.llm?.enabled);
  console.log('最小キーワード数:', testConfig.quality?.minKeywordCount);
  
  // カスタム設定でのテスト
  console.log('\n--- カスタム設定テスト ---');
  const customConfig = {
    ...productionConfig,
    basic: {
      ...productionConfig.basic,
      stopwords: new Set(['カスタム', 'テスト'])
    },
    llm: { enabled: false }
  };
  
  const customExtractor = new KeywordExtractor(customConfig);
  const result = await customExtractor.extract('教室管理の詳細は');
  console.log('カスタム設定での結果:', result.keywords);
}

// テスト実行
async function runAllTests() {
  await testKeywordExtractorClass();
  await testIndividualComponents();
  await testConfigurationManagement();
}

runAllTests().catch(console.error);
