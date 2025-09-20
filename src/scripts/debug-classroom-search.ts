/**
 * 教室管理検索のデバッグスクリプト
 */
import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function debugClassroomSearch() {
  const query = '教室管理の仕様は';
  console.log(`=== デバッグ検索クエリ: "${query}" ===`);
  
  try {
    const results = await searchLanceDB({
      query,
      topK: 10, // より多くの結果を取得
      tableName: 'confluence',
      useLunrIndex: true
    });
    
    console.log(`\n検索結果数: ${results.length}`);
    
    // 教室管理を含むタイトルを探す
    const classroomResults = results.filter(r => 
      r.title.toLowerCase().includes('教室管理')
    );
    
    console.log(`\n教室管理を含む結果数: ${classroomResults.length}`);
    
    if (classroomResults.length > 0) {
      console.log('\n教室管理を含む結果:');
      classroomResults.forEach((result, index) => {
        console.log(`\n--- 結果 ${index + 1} ---`);
        console.log(`タイトル: ${result.title}`);
        console.log(`スペース: ${result.space_key}`);
        console.log(`距離: ${result.distance}%`);
        console.log(`ソース: ${result.source}`);
        console.log(`RRFスコア: ${result.rrfScore?.toFixed(4) || 'N/A'}`);
        console.log(`マッチ詳細: タイトル=${result.matchDetails?.titleMatches || 0}, ラベル=${result.matchDetails?.labelMatches || 0}, コンテンツ=${result.matchDetails?.contentMatches || 0}`);
      });
    } else {
      console.log('\n教室管理を含む結果が見つかりませんでした。');
    }
    
    // 全結果を表示
    console.log('\n=== 全検索結果 ===');
    results.forEach((result, index) => {
      console.log(`\n--- 結果 ${index + 1} ---`);
      console.log(`タイトル: ${result.title}`);
      console.log(`距離: ${result.distance}%`);
      console.log(`ソース: ${result.source}`);
      console.log(`RRFスコア: ${result.rrfScore?.toFixed(4) || 'N/A'}`);
    });
    
  } catch (error) {
    console.error(`クエリ "${query}" でエラー:`, error);
  }
}

debugClassroomSearch().catch(console.error);
