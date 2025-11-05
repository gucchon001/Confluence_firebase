const https = require('https');

// APIキーを.env.localから読み込む
require('dotenv').config({ path: '.env.local' });
const apiKey = process.env.GEMINI_API_KEY || 'AIzaSyA6YvXHeaXByWy64MMOMLSMzO1ctQCXcTs';
const data = JSON.stringify({
  model: 'models/text-embedding-004',
  content: {
    parts: [{ text: 'test' }]
  }
});

const options = {
  hostname: 'generativelanguage.googleapis.com',
  path: '/v1beta/models/text-embedding-004:embedContent?key=' + apiKey,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Testing API key...');

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ API key is valid and working');
      try {
        const result = JSON.parse(body);
        console.log('   Embedding dimensions:', result.embedding?.values?.length || 'N/A');
      } catch (e) {
        console.log('   Response:', body.substring(0, 100));
      }
    } else {
      console.log('❌ API key error:', res.statusCode);
      try {
        const error = JSON.parse(body);
        console.log('   Error message:', error.error?.message || error.message || body);
      } catch (e) {
        console.log('   Response:', body);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
});

req.write(data);
req.end();

