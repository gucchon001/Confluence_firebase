/**
 * /api/ask APIのテストスクリプト
 */
import 'dotenv/config';
import axios from 'axios';

async function testAskApi() {
  try {
    const query = 'ログイン機能の詳細は';
    console.log(`検索クエリ: '${query}'`);
    
    // /api/ask APIを呼び出す
    console.log('\n/api/ask APIを呼び出し中...');
    const response = await axios.post('http://localhost:9003/api/ask', {
      question: query
    });
    
    console.log(`ステータスコード: ${response.status}`);
    console.log('レスポンスデータ:', JSON.stringify(response.data, null, 2));
    
  } catch (err: any) {
    console.error('エラー:', err.message);
    if (err.response) {
      console.error('レスポンス:', err.response.data);
    }
  }
}

testAskApi();
