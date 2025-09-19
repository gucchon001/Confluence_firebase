/**
 * askQuestion APIのテストスクリプト
 */
import 'dotenv/config';
import axios from 'axios';

async function testAskQuestion() {
  try {
    const query = 'ログイン機能の詳細は';
    console.log(`検索クエリ: '${query}'`);
    
    // askQuestion APIを直接呼び出す
    console.log('\n/ (askQuestion) APIを直接呼び出し中...');
    const response = await axios.post('http://localhost:9003/', {
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

testAskQuestion();
