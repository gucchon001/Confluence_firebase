/**
 * 修正版キーワード抽出のテスト
 */

import { extractKeywordsFixed } from '../lib/keyword-extractor-fixed';

async function testFixedKeywordExtraction() {
  console.log('🔧 修正版キーワード抽出テスト開始');
  console.log('=' .repeat(60));
  
  const testQueries = [
    '教室管理の詳細は',
    '教室一覧閲覧機能',
    'ログイン機能について',
    '求人管理の仕様'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 テストクエリ: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
      const result = await extractKeywordsFixed(query);
      
      console.log('📋 抽出結果:');
      console.log(`- 総キーワード数: ${result.keywords.length}`);
      console.log(`- キーワードソース: ${result.metadata.keywordSource}`);
      console.log(`- 処理時間: ${result.metadata.processingTime}ms`);
      console.log('');
      
      console.log('🔑 抽出されたキーワード:');
      result.keywords.forEach((keyword, index) => {
        console.log(`  ${index + 1}. "${keyword}"`);
      });
      console.log('');
      
      console.log('⭐ High Priority:');
      Array.from(result.highPriority).forEach(keyword => {
        console.log(`  - "${keyword}"`);
      });
      
      console.log('📝 Low Priority:');
      Array.from(result.lowPriority).forEach(keyword => {
        console.log(`  - "${keyword}"`);
      });
      
    } catch (error) {
      console.error('❌ エラーが発生しました:', error);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ 修正版キーワード抽出テスト完了');
}

// テスト実行
if (require.main === module) {
  testFixedKeywordExtraction();
}

export { testFixedKeywordExtraction };
