/**
 * ドメイン知識統合テスト
 */

import 'dotenv/config';
import { DomainKnowledgeLoader } from '../lib/domain-knowledge-loader';
import { extractKeywordsHybrid } from '../lib/keyword-extractor-production';
import { KeywordExtractor } from '../lib/keyword-extractor-class';

async function testDomainKnowledgeLoader() {
  console.log('=== ドメイン知識ローダーテスト ===');
  
  const loader = DomainKnowledgeLoader.getInstance();
  
  try {
    // ドメイン知識を読み込み
    const domainKnowledge = await loader.loadDomainKnowledge();
    console.log('✅ ドメイン知識の読み込み成功');
    console.log('統計情報:', domainKnowledge.statistics);
    
    // テストクエリでのキーワード抽出
    const testQueries = [
      '教室管理の詳細は',
      '教室削除ができないのは何が原因ですか',
      '会員のログイン機能の詳細を教えて',
      'オファー機能の種類は？'
    ];
    
    for (const query of testQueries) {
      console.log(`\n--- クエリ: "${query}" ---`);
      const keywords = loader.extractDomainKeywords(query);
      console.log('抽出されたドメインキーワード:', keywords);
      
      // 各キーワードの優先度を確認
      for (const keyword of keywords) {
        const priority = loader.getKeywordPriority(keyword);
        console.log(`  ${keyword}: ${priority}優先度`);
      }
    }
    
  } catch (error) {
    console.error('❌ ドメイン知識の読み込みに失敗:', error);
  }
}

async function testProductionKeywordExtractor() {
  console.log('\n=== 本番用キーワード抽出器テスト（ドメイン知識統合） ===');
  
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
      const result = await extractKeywordsHybrid(testCase.query);
      
      console.log('抽出されたキーワード:', result.keywords);
      console.log('高優先度キーワード:', Array.from(result.highPriority));
      console.log('低優先度キーワード:', Array.from(result.lowPriority));
      
      // ドメイン知識からのキーワードを確認
      const loader = DomainKnowledgeLoader.getInstance();
      const domainKeywords = loader.extractDomainKeywords(testCase.query);
      console.log('ドメイン知識からのキーワード:', domainKeywords);
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

async function testClassBasedKeywordExtractor() {
  console.log('\n=== クラスベースキーワード抽出器テスト（ドメイン知識統合） ===');
  
  const extractor = new KeywordExtractor();
  
  const testCases = [
    {
      name: '教室管理',
      query: '教室管理の詳細は'
    },
    {
      name: '教室削除問題',
      query: '教室削除ができないのは何が原因ですか'
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
      console.log('処理時間:', result.metadata.processingTime + 'ms');
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

async function testDomainKnowledgeStatistics() {
  console.log('\n=== ドメイン知識統計情報テスト ===');
  
  const loader = DomainKnowledgeLoader.getInstance();
  
  if (loader.isLoaded()) {
    const stats = loader.getStatistics();
    console.log('ドメイン知識統計:', stats);
    
    const lastLoaded = loader.getLastLoaded();
    console.log('最後に読み込まれた時刻:', lastLoaded);
  } else {
    console.log('ドメイン知識が読み込まれていません');
  }
}

// テスト実行
async function runAllTests() {
  await testDomainKnowledgeLoader();
  await testProductionKeywordExtractor();
  await testClassBasedKeywordExtractor();
  await testDomainKnowledgeStatistics();
}

runAllTests().catch(console.error);
