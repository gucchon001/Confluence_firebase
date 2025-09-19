/**
 * /api/search APIのテストスクリプト
 */
import 'dotenv/config';
import axios from 'axios';

async function testSearchApi() {
  try {
    const query = 'ログイン機能の詳細は';
    console.log(`検索クエリ: '${query}'`);
    
    // /api/search APIを呼び出す
    console.log('\n/api/search APIを呼び出し中...');
    const response = await axios.post('http://localhost:9003/api/search', {
      query,
      topK: 5,
      tableName: 'confluence'
    });
    
    console.log(`ステータスコード: ${response.status}`);
    console.log(`検索結果数: ${response.data.results.length}`);
    
    if (response.data.results.length > 0) {
      console.log('\n最初の2件の検索結果:');
      response.data.results.slice(0, 2).forEach((result: any, index: number) => {
        console.log(`\n--- 結果 ${index + 1} ---`);
        console.log(`タイトル: ${result.title}`);
        console.log(`スペース: ${result.space_key}`);
        console.log(`URL: ${result.url}`);
        console.log(`距離: ${result.distance}`);
        console.log(`内容の一部: ${result.content.substring(0, 100)}...`);
      });
    }
    
  } catch (err: any) {
    console.error('エラー:', err.message);
    if (err.response) {
      console.error('レスポンス:', err.response.data);
    }
  }
}

testSearchApi();
