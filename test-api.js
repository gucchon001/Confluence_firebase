const http = require('http');

console.log('🧪 Testing embedding model loading via API...\n');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/test-embedding',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`📊 Status: ${res.statusCode}\n`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📝 Response:');
    console.log(data);
    process.exit(res.statusCode === 200 ? 0 : 1);
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});

req.end();
