/**
 * ハイブリッド検索のテストスクリプト
 */
import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function testHybridSearch() {
  const testQueries = [
    '教室管理の仕様は',
    'ログイン機能の詳細を教えて',
    '急募の設定箇所は'
  ];

  for (const query of testQueries) {
    console.log(`\n=== 検索クエリ: "${query}" ===`);
    
    try {
      const results = await searchLanceDB({
        query,
        topK: 5,
        tableName: 'confluence',
        useLunrIndex: true
      });
      
      console.log(`検索結果数: ${results.length}`);
      
      results.forEach((result, index) => {
        console.log(`\n--- 結果 ${index + 1} ---`);
        console.log(`タイトル: ${result.title}`);
        console.log(`スペース: ${result.space_key}`);
        console.log(`距離: ${result.distance}%`);
        console.log(`ソース: ${result.source}`);
        console.log(`RRFスコア: ${result.rrfScore?.toFixed(4) || 'N/A'}`);
        console.log(`マッチ詳細: タイトル=${result.matchDetails?.titleMatches || 0}, ラベル=${result.matchDetails?.labelMatches || 0}, コンテンツ=${result.matchDetails?.contentMatches || 0}`);
        console.log(`内容の一部: ${result.content?.substring(0, 100)}...`);
      });
      
    } catch (error) {
      console.error(`クエリ "${query}" でエラー:`, error);
    }
  }
}

testHybridSearch().catch(console.error);
