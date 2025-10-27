/**
 * ローカルビルドのテストスクリプト
 * ビルド後に実際にサーバーを起動して、エンベディングモデルの読み込みをテスト
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 ローカルビルドのテストを開始します\n');

// 1. ビルド済みかチェック
const standaloneDir = path.resolve(__dirname, '..', '.next', 'standalone');
if (!fs.existsSync(standaloneDir)) {
  console.error('❌ .next/standalone ディレクトリが見つかりません');
  console.error('   → まず "npm run build" を実行してください');
  process.exit(1);
}

console.log('✅ ビルド済みのファイルが存在します\n');

// 2. モデルファイルの存在確認
const modelDir = path.join(standaloneDir, 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');
const tokenizerPath = path.join(modelDir, 'tokenizer.json');

if (!fs.existsSync(tokenizerPath)) {
  console.error('❌ モデルファイルが見つかりません');
  console.error(`   Expected: ${tokenizerPath}`);
  console.error('   → postbuildスクリプトが実行されていない可能性があります');
  process.exit(1);
}

console.log('✅ モデルファイルが存在します\n');

// 3. テスト用のAPIリクエストを作成
const testScript = `
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/test-embedding',
  method: 'GET'
};

console.log('🔍 エンベディングAPIにリクエストを送信中...');

const req = http.request(options, (res) => {
  console.log(\`Status: \${res.statusCode}\`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('📝 レスポンス:');
    console.log(data);
    process.exit(0);
  });
});

req.on('error', (error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});

req.end();
`;

console.log('📝 テスト用APIエンドポイントを作成します\n');

// テスト用のAPIエンドポイントファイルを作成
const testApiPath = path.join(standaloneDir, 'src', 'app', 'api', 'test-embedding', 'route.js');
const testApiDir = path.dirname(testApiPath);

if (!fs.existsSync(testApiDir)) {
  fs.mkdirSync(testApiDir, { recursive: true });
}

const testApiContent = `// Test API endpoint for embedding model loading
import { getEmbeddings } from '../../../../lib/embeddings';

export async function GET() {
  try {
    console.log('[TEST] Embedding model loading test started');
    const embedding = await getEmbeddings('test query');
    console.log('[TEST] Embedding model loaded successfully');
    
    return Response.json({ 
      success: true, 
      embeddingLength: embedding.length,
      firstFew: embedding.slice(0, 5)
    });
  } catch (error) {
    console.error('[TEST] Embedding model loading failed:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
`;

fs.writeFileSync(testApiPath, testApiContent);
console.log(`✅ テスト用APIを作成しました: ${testApiPath}\n`);

console.log('🚀 スタンドアロンサーバーを起動します...\n');
console.log('💡 動作確認: 別のターミナルで以下を実行してください:\n');
console.log('   curl http://localhost:3000/api/test-embedding\n');
console.log('   またはブラウザで http://localhost:3000/api/test-embedding にアクセス\n');

// サーバーを起動
const serverProcess = spawn('node', ['server.js'], {
  cwd: standaloneDir,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
  }
});

serverProcess.on('error', (error) => {
  console.error('❌ サーバーの起動に失敗:', error);
  process.exit(1);
});

// 10秒後にサーバーを停止
setTimeout(() => {
  console.log('\n⏹️  テストを終了します');
  serverProcess.kill();
  process.exit(0);
}, 10000);
