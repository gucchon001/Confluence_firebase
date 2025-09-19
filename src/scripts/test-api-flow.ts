/**
 * API flowのテストスクリプト
 */
import 'dotenv/config';
import axios from 'axios';

async function testApiFlow() {
  try {
    const query = 'ログイン機能の詳細は';
    console.log(`検索クエリ: '${query}'`);
    
    // retrieveRelevantDocs APIを呼び出す
    console.log('\n1. retrieveRelevantDocs APIを呼び出し中...');
    const retrieveResponse = await axios.post('http://localhost:9003/api/flow/retrieveRelevantDocs', {
      question: query
    });
    
    console.log(`ステータスコード: ${retrieveResponse.status}`);
    console.log(`関連ドキュメント数: ${retrieveResponse.data.length}`);
    
    if (retrieveResponse.data.length > 0) {
      console.log('\n最初の2件の関連ドキュメント:');
      retrieveResponse.data.slice(0, 2).forEach((doc: any, index: number) => {
        console.log(`\n--- ドキュメント ${index + 1} ---`);
        console.log(`タイトル: ${doc.title}`);
        console.log(`URL: ${doc.url}`);
        console.log(`距離: ${doc.distance}`);
      });
    }
    
    // summarizeConfluenceDocs APIを呼び出す
    console.log('\n2. summarizeConfluenceDocs APIを呼び出し中...');
    const summarizeResponse = await axios.post('http://localhost:9003/api/flow/summarizeConfluenceDocs', {
      question: query,
      context: retrieveResponse.data,
      chatHistory: []
    });
    
    console.log(`ステータスコード: ${summarizeResponse.status}`);
    console.log('\n要約結果:');
    console.log(`回答: ${summarizeResponse.data.answer}`);
    console.log(`参照元数: ${summarizeResponse.data.references?.length || 0}`);
    
    // askQuestion APIを呼び出す
    console.log('\n3. / (askQuestion) APIを呼び出し中...');
    const askResponse = await axios.post('http://localhost:9003/', {
      question: query
    });
    
    console.log(`ステータスコード: ${askResponse.status}`);
    console.log('\n最終結果:');
    console.log(`回答: ${askResponse.data.answer}`);
    console.log(`参照元数: ${askResponse.data.references?.length || 0}`);
    
  } catch (err: any) {
    console.error('エラー:', err.message);
    if (err.response) {
      console.error('レスポンス:', err.response.data);
    }
  }
}

testApiFlow();
