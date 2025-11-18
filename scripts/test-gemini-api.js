// Gemini APIキーの動作確認スクリプト
const https = require('https');

const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyD6h4V0PENM6YiGHwlW3uq3hQB2JzwUAZM';
const testText = '教室管理について';

const payload = JSON.stringify({
  model: 'models/text-embedding-004',
  content: {
    parts: [{ text: testText }]
  }
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: `/v1/models/text-embedding-004:embedContent?key=${apiKey}`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

console.log('🔍 Gemini APIキーの動作確認を開始します...');
console.log(`API Key: ${apiKey.substring(0, 10)}...`);
console.log(`Test Text: ${testText}`);
console.log('');

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Status Message: ${res.statusMessage}`);
    console.log('');

    if (res.statusCode === 200) {
      try {
        const json = JSON.parse(data);
        console.log('✅ API呼び出し成功！');
        console.log('');
        
        if (json.embedding && json.embedding.values) {
          console.log(`✅ Embedding値が取得できました（${json.embedding.values.length}次元）`);
          console.log(`最初の5つの値: ${json.embedding.values.slice(0, 5).join(', ')}`);
        } else {
          console.log('❌ Embedding値が見つかりません');
          console.log('レスポンス構造:', JSON.stringify(json, null, 2));
        }
      } catch (e) {
        console.log('❌ JSON解析エラー:', e.message);
        console.log('レスポンス:', data);
      }
    } else {
      console.log('❌ API呼び出し失敗');
      console.log('レスポンス:', data);
      
      try {
        const json = JSON.parse(data);
        if (json.error) {
          console.log('');
          console.log('エラー詳細:');
          console.log(`  Code: ${json.error.code || 'N/A'}`);
          console.log(`  Message: ${json.error.message || 'N/A'}`);
          console.log(`  Status: ${json.error.status || 'N/A'}`);
        }
      } catch (e) {
        // JSON解析失敗は無視
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ リクエストエラー:', error.message);
});

req.write(payload);
req.end();

