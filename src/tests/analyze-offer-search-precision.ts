/**
 * オファー機能検索精度の詳細分析
 */

import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';
import { extractKeywordsConfigured } from '../lib/keyword-extractor-configured';

const TEST_QUERY = 'オファー機能の種類は？';

// 期待されるページ（仕様書から）
const EXPECTED_PAGES = [
  // 主要なオファー機能ページ（優先度：高）
  '071_【FIX】オファー一覧閲覧機能',
  '【FIX】オファー履歴',
  '193_【FIX】オファー新規作成機能',
  '194_【FIX】自動オファー設定機能',
  '053_【FIX】スカウト・マッチ利用設定機能',
  '562_【FIX】自動オファー条件設定機能',
  
  // パーソナルオファー管理ページ（優先度：高）
  '542_【FIX】パーソナルオファー管理 - テンプレート新規作成機能',
  '543_【FIX】パーソナルオファー管理 - テンプレート編集機能',
  
  // 自動オファー関連ページ（優先度：中）
  '【FIX】オファー設定情報（自動オファー）',
  '742_【作成中】自動オファー送信バッチ',
  
  // 通知関連ページ（優先度：中）
  'パーソナルオファー受信通知メール（会員宛）',
  '自動オファー受信通知メール（会員宛）'
];

async function analyzeSearchPrecision() {
  console.log('=== オファー機能検索精度の詳細分析 ===');
  console.log(`クエリ: "${TEST_QUERY}"`);
  
  try {
    // 現在の検索結果を取得
    const searchResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 20,
      useLunrIndex: false
    });
    
    console.log(`\n検索結果数: ${searchResults.length}件`);
    
    // 期待されるページの含有状況を分析
    const foundPages = [];
    const missingPages = [];
    
    for (const expectedPage of EXPECTED_PAGES) {
      const found = searchResults.find(result => 
        result.title.includes(expectedPage) || expectedPage.includes(result.title)
      );
      
      if (found) {
        foundPages.push({
          expected: expectedPage,
          actual: found.title,
          score: found.score,
          rank: searchResults.indexOf(found) + 1
        });
      } else {
        missingPages.push(expectedPage);
      }
    }
    
    console.log('\n--- 期待されるページの含有状況 ---');
    console.log(`✅ 見つかったページ: ${foundPages.length}/${EXPECTED_PAGES.length}件`);
    console.log(`❌ 見つからないページ: ${missingPages.length}/${EXPECTED_PAGES.length}件`);
    
    if (foundPages.length > 0) {
      console.log('\n--- 見つかったページの詳細 ---');
      foundPages.forEach(page => {
        console.log(`${page.rank}位: ${page.actual} (スコア: ${page.score.toFixed(2)})`);
      });
    }
    
    if (missingPages.length > 0) {
      console.log('\n--- 見つからないページ ---');
      missingPages.forEach(page => {
        console.log(`- ${page}`);
      });
    }
    
    // 現在の検索結果の詳細分析
    console.log('\n--- 現在の検索結果の詳細分析 ---');
    searchResults.slice(0, 10).forEach((result, index) => {
      const isExpected = EXPECTED_PAGES.some(expected => 
        result.title.includes(expected) || expected.includes(result.title)
      );
      console.log(`${index + 1}位: ${result.title}`);
      console.log(`   スコア: ${result.score.toFixed(2)}`);
      console.log(`   ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`   期待ページ: ${isExpected ? '✅' : '❌'}`);
      console.log('');
    });
    
    // キーワード抽出の分析
    console.log('\n--- キーワード抽出の分析 ---');
    const keywordResult = await extractKeywordsConfigured(TEST_QUERY);
    console.log(`抽出されたキーワード: ${JSON.stringify(keywordResult.keywords)}`);
    console.log(`キーワード数: ${keywordResult.keywords.length}個`);
    console.log(`キーワードソース: ${keywordResult.metadata.keywordSource}`);
    
    // 各キーワードが期待ページのタイトルに含まれているかチェック
    console.log('\n--- キーワードと期待ページのマッチング分析 ---');
    for (const keyword of keywordResult.keywords) {
      const matchingPages = EXPECTED_PAGES.filter(page => 
        page.toLowerCase().includes(keyword.toLowerCase()) || 
        keyword.toLowerCase().includes(page.toLowerCase())
      );
      console.log(`"${keyword}": ${matchingPages.length}件の期待ページとマッチ`);
      if (matchingPages.length > 0) {
        matchingPages.forEach(page => console.log(`  - ${page}`));
      }
    }
    
    return {
      searchResults,
      foundPages,
      missingPages,
      keywordResult
    };
    
  } catch (error) {
    console.error('検索精度分析でエラー:', error);
    return null;
  }
}

async function analyzeMissingPages() {
  console.log('\n=== 見つからないページの詳細分析 ===');
  
  try {
    // 見つからないページを個別に検索
    const missingPages = [
      '【FIX】オファー履歴',
      '053_【FIX】スカウト・マッチ利用設定機能',
      '562_【FIX】自動オファー条件設定機能',
      '542_【FIX】パーソナルオファー管理 - テンプレート新規作成機能',
      '【FIX】オファー設定情報（自動オファー）',
      '742_【作成中】自動オファー送信バッチ',
      'パーソナルオファー受信通知メール（会員宛）',
      '自動オファー受信通知メール（会員宛）'
    ];
    
    for (const missingPage of missingPages) {
      console.log(`\n--- "${missingPage}" の個別検索 ---`);
      
      // ページタイトルの一部で検索
      const titleParts = missingPage.split('_').pop()?.split('【').shift() || missingPage;
      const searchQuery = titleParts.replace(/[【】]/g, '').trim();
      
      console.log(`検索クエリ: "${searchQuery}"`);
      
      const searchResults = await searchLanceDB({
        query: searchQuery,
        topK: 10,
        useLunrIndex: false
      });
      
      console.log(`検索結果数: ${searchResults.length}件`);
      
      const found = searchResults.find(result => 
        result.title.includes(missingPage) || missingPage.includes(result.title)
      );
      
      if (found) {
        console.log(`✅ 見つかりました: ${found.title} (スコア: ${found.score.toFixed(2)})`);
      } else {
        console.log(`❌ 見つかりませんでした`);
        console.log('上位3件の結果:');
        searchResults.slice(0, 3).forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.title} (スコア: ${result.score.toFixed(2)})`);
        });
      }
    }
    
  } catch (error) {
    console.error('見つからないページの分析でエラー:', error);
  }
}

async function analyzeKeywordExtraction() {
  console.log('\n=== キーワード抽出の詳細分析 ===');
  
  try {
    const keywordResult = await extractKeywordsConfigured(TEST_QUERY);
    
    console.log('\n--- 抽出されたキーワードの詳細 ---');
    console.log(`総キーワード数: ${keywordResult.keywords.length}個`);
    console.log(`最高優先度: ${Array.from(keywordResult.criticalPriority)}`);
    console.log(`高優先度: ${Array.from(keywordResult.highPriority)}`);
    console.log(`中優先度: ${Array.from(keywordResult.mediumPriority)}`);
    console.log(`低優先度: ${Array.from(keywordResult.lowPriority)}`);
    
    console.log('\n--- カテゴリ別抽出状況 ---');
    const stats = keywordResult.metadata.statistics.byCategory;
    console.log(`ドメイン名: ${stats.domainNames}個`);
    console.log(`機能名: ${stats.functionNames}個`);
    console.log(`操作名: ${stats.operationNames}個`);
    console.log(`システム項目: ${stats.systemFields}個`);
    console.log(`システム用語: ${stats.systemTerms}個`);
    console.log(`関連キーワード: ${stats.relatedKeywords}個`);
    
    // 理想のキーワードとの比較
    const idealKeywords = [
      'オファー機能', 'オファー', 'スカウト', 'マッチ', 
      'パーソナルオファー', '自動オファー', 'オファー一覧', 
      'オファー履歴', 'オファー種類'
    ];
    
    console.log('\n--- 理想のキーワードとの比較 ---');
    const matchedKeywords = keywordResult.keywords.filter(keyword => 
      idealKeywords.some(ideal => 
        keyword.includes(ideal) || ideal.includes(keyword)
      )
    );
    
    console.log(`理想のキーワード: ${JSON.stringify(idealKeywords)}`);
    console.log(`抽出されたキーワード: ${JSON.stringify(keywordResult.keywords)}`);
    console.log(`一致したキーワード: ${JSON.stringify(matchedKeywords)}`);
    console.log(`一致率: ${(matchedKeywords.length / idealKeywords.length * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('キーワード抽出分析でエラー:', error);
  }
}

// メイン実行
async function runAnalysis() {
  const results = await analyzeSearchPrecision();
  if (results) {
    await analyzeMissingPages();
    await analyzeKeywordExtraction();
  }
}

runAnalysis().catch(console.error);
