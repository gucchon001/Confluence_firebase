/**
 * 検索機能のテストスクリプト
 */
import { searchLanceDB } from '../lib/lancedb-search-client';

async function testSearchFunctionality() {
  try {
    console.log('🔍 検索機能のテストを開始...');
    
    // テスト用の検索クエリ
    const testQueries = [
      'オファー機能',
      'パーソナルオファー',
      '応募管理',
      '契約管理',
      '請求管理'
    ];
    
    for (const query of testQueries) {
      console.log(`\n📝 検索クエリ: "${query}"`);
      
      try {
        const results = await searchLanceDB({
          query,
          limit: 5,
          labelFilter: {
            excludeLabels: ['フォルダ', 'アーカイブ']
          }
        });
        
        console.log(`✅ 検索結果: ${results.length}件`);
        
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.title} (pageId: ${result.pageId}, score: ${result.score?.toFixed(3)})`);
        });
        
      } catch (error: any) {
        console.error(`❌ 検索エラー (${query}):`, error.message);
      }
    }
    
    console.log('\n✅ 検索機能テスト完了');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

// スクリプト実行
if (require.main === module) {
  testSearchFunctionality();
}

export { testSearchFunctionality };
