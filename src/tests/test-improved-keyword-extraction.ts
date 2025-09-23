/**
 * 改善されたキーワード抽出のテスト
 */

import 'dotenv/config';
import { KeywordListsLoader } from '../lib/keyword-lists-loader';
import { extractKeywordsConfigured } from '../lib/keyword-extractor-configured';

const TEST_QUERY = 'オファー機能の種類は？';

async function testImprovedKeywordExtraction() {
  console.log('=== 改善されたキーワード抽出のテスト ===');
  console.log(`クエリ: "${TEST_QUERY}"`);
  
  try {
    // キーワードリストローダーのテスト
    const loader = KeywordListsLoader.getInstance();
    await loader.loadKeywordLists();
    
    console.log('\n--- キーワードリストローダーのテスト ---');
    const extractedKeywords = loader.extractKeywords(TEST_QUERY);
    
    console.log(`ドメイン名: ${extractedKeywords.domainNames.length}個`);
    console.log(`機能名: ${extractedKeywords.functionNames.length}個`);
    console.log(`操作名: ${extractedKeywords.operationNames.length}個`);
    console.log(`システム項目: ${extractedKeywords.systemFields.length}個`);
    console.log(`システム用語: ${extractedKeywords.systemTerms.length}個`);
    console.log(`関連キーワード: ${extractedKeywords.relatedKeywords.length}個`);
    console.log(`全キーワード: ${extractedKeywords.allKeywords.length}個`);
    
    console.log('\n--- 抽出されたキーワードの詳細 ---');
    console.log(`ドメイン名: ${JSON.stringify(extractedKeywords.domainNames)}`);
    console.log(`機能名: ${JSON.stringify(extractedKeywords.functionNames)}`);
    console.log(`操作名: ${JSON.stringify(extractedKeywords.operationNames)}`);
    console.log(`システム項目: ${JSON.stringify(extractedKeywords.systemFields.slice(0, 10))}`); // 最初の10個のみ表示
    console.log(`システム用語: ${JSON.stringify(extractedKeywords.systemTerms.slice(0, 10))}`); // 最初の10個のみ表示
    console.log(`関連キーワード: ${JSON.stringify(extractedKeywords.relatedKeywords.slice(0, 10))}`); // 最初の10個のみ表示
    
    // 設定値化キーワード抽出器のテスト
    console.log('\n--- 設定値化キーワード抽出器のテスト ---');
    const keywordResult = await extractKeywordsConfigured(TEST_QUERY);
    
    console.log(`抽出されたキーワード: ${JSON.stringify(keywordResult.keywords)}`);
    console.log(`最高優先度: ${JSON.stringify(Array.from(keywordResult.criticalPriority))}`);
    console.log(`高優先度: ${JSON.stringify(Array.from(keywordResult.highPriority))}`);
    console.log(`中優先度: ${JSON.stringify(Array.from(keywordResult.mediumPriority))}`);
    console.log(`低優先度: ${JSON.stringify(Array.from(keywordResult.lowPriority))}`);
    console.log(`処理時間: ${keywordResult.metadata.processingTime}ms`);
    console.log(`キーワードソース: ${keywordResult.metadata.keywordSource}`);
    
    // 理想のキーワードとの比較
    const idealKeywords = [
      'オファー機能', 'オファー', 'スカウト', 'マッチ', 
      'パーソナルオファー', '自動オファー', 'オファー一覧', 
      'オファー履歴', 'オファー種類'
    ];
    
    console.log('\n--- 理想のキーワードとの比較 ---');
    console.log(`理想のキーワード: ${JSON.stringify(idealKeywords)}`);
    console.log(`抽出されたキーワード: ${JSON.stringify(keywordResult.keywords)}`);
    
    const matchedKeywords = keywordResult.keywords.filter(keyword => 
      idealKeywords.some(ideal => 
        keyword.includes(ideal) || ideal.includes(keyword)
      )
    );
    
    console.log(`一致したキーワード: ${JSON.stringify(matchedKeywords)}`);
    console.log(`一致率: ${(matchedKeywords.length / idealKeywords.length * 100).toFixed(1)}%`);
    
    // 改善前との比較
    console.log('\n--- 改善前との比較 ---');
    const beforeKeywords = ['オファー機能', 'オファー', 'オフ', '機能', '種類', 'オファ'];
    console.log(`改善前: ${JSON.stringify(beforeKeywords)} (${beforeKeywords.length}個)`);
    console.log(`改善後: ${JSON.stringify(keywordResult.keywords)} (${keywordResult.keywords.length}個)`);
    
    const beforeMatched = beforeKeywords.filter(keyword => 
      idealKeywords.some(ideal => 
        keyword.includes(ideal) || ideal.includes(keyword)
      )
    );
    
    console.log(`改善前の一致率: ${(beforeMatched.length / idealKeywords.length * 100).toFixed(1)}%`);
    console.log(`改善後の一致率: ${(matchedKeywords.length / idealKeywords.length * 100).toFixed(1)}%`);
    
    const improvement = (matchedKeywords.length / idealKeywords.length * 100) - (beforeMatched.length / idealKeywords.length * 100);
    console.log(`改善幅: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`);
    
    return {
      extractedKeywords,
      keywordResult,
      matchedKeywords,
      improvement
    };
    
  } catch (error) {
    console.error('改善されたキーワード抽出のテストでエラー:', error);
    return null;
  }
}

async function testSpecificOfferKeywords() {
  console.log('\n=== 特定のオファー機能キーワードのテスト ===');
  
  const testQueries = [
    'オファー機能の種類は？',
    'スカウト機能について教えて',
    'マッチ機能の詳細は',
    'パーソナルオファー管理',
    '自動オファー設定'
  ];
  
  const loader = KeywordListsLoader.getInstance();
  
  for (const query of testQueries) {
    console.log(`\n--- クエリ: "${query}" ---`);
    
    const extractedKeywords = loader.extractKeywords(query);
    console.log(`抽出されたキーワード: ${JSON.stringify(extractedKeywords.allKeywords)}`);
    console.log(`キーワード数: ${extractedKeywords.allKeywords.length}個`);
    
    // 各カテゴリの詳細
    console.log(`ドメイン名: ${extractedKeywords.domainNames.length}個`);
    console.log(`機能名: ${extractedKeywords.functionNames.length}個`);
    console.log(`操作名: ${extractedKeywords.operationNames.length}個`);
  }
}

// メイン実行
async function runTests() {
  const results = await testImprovedKeywordExtraction();
  if (results) {
    await testSpecificOfferKeywords();
  }
}

runTests().catch(console.error);
