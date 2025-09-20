/**
 * ハイブリッド検索のテスト（シンプル版）
 */
import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function testHybridSearch() {
  try {
    console.log('=== ハイブリッド検索テスト ===');
    
    const query = '教室管理';
    console.log(`\nクエリ: "${query}"`);
    
    const results = await searchLanceDB({
      query,
      topK: 10,
      useLunrIndex: false
    });
    
    console.log(`\n検索結果数: ${results.length}`);
    
    // 結果を表示
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title} (${result.distance}%)`);
    });
    
    // 教室管理を含む結果をチェック
    const classroomResults = results.filter(r => 
      r.title.includes('教室管理')
    );
    
    console.log(`\n教室管理を含む結果: ${classroomResults.length}件`);
    classroomResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (${result.distance}%)`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testHybridSearch().catch(console.error);
