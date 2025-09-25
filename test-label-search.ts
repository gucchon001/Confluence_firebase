/**
 * ラベル機能の実際の動作テスト
 */

import 'dotenv/config';
import { HybridSearchEngine } from './src/lib/hybrid-search-engine';

async function testLabelSearch() {
  console.log('🔍 ラベル機能の実際の動作テスト...\n');

  try {
    const searchEngine = new HybridSearchEngine();
    
    // ラベル付きの検索をテスト
    console.log('🔍 ラベル付き検索をテスト中...');
    const results = await searchEngine.search({ 
      query: 'フォルダ', 
      topK: 5 
    });
    
    console.log(`📊 検索結果数: ${results.length}`);
    
    results.forEach((result, index) => {
      console.log(`\n📄 結果 ${index + 1}:`);
      console.log(`  タイトル: ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`  スコア: ${result.score}`);
    });
    
    // ラベルフィルタリングのテスト
    console.log('\n🔍 ラベルフィルタリングをテスト中...');
    const filteredResults = await searchEngine.search({ 
      query: 'client', 
      topK: 5,
      labelFilters: {
        includeLabels: ['フォルダ']
      }
    });
    
    console.log(`📊 フィルタリング結果数: ${filteredResults.length}`);
    
    filteredResults.forEach((result, index) => {
      console.log(`\n📄 フィルタリング結果 ${index + 1}:`);
      console.log(`  タイトル: ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testLabelSearch().catch(console.error);
