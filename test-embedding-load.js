/**
 * ローカルでエンベディングモデルの読み込みをテスト
 */

const path = require('path');

// スタンドアロンディレクトリを設定（既に .next/standalone にいる場合とプロジェクトルートにいる場合の両方に対応）
const standaloneDir = __dirname.includes('.next/standalone') 
  ? __dirname 
  : path.join(__dirname, '.next', 'standalone');

console.log(`🔍 Running from: ${__dirname}`);
console.log(`📁 Working directory: ${process.cwd()}\n`);

// モデルファイルの存在確認
const fs = require('fs');
const modelDir = path.join(standaloneDir, 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');
const tokenizerPath = path.join(modelDir, 'tokenizer.json');

console.log(`📁 Expected model directory: ${modelDir}`);
console.log(`📄 Expected tokenizer.json: ${tokenizerPath}\n`);

if (fs.existsSync(modelDir)) {
  console.log('✅ Model directory exists');
  const files = fs.readdirSync(modelDir);
  console.log(`   Files: ${files.length}`);
  
  if (fs.existsSync(tokenizerPath)) {
    const stats = fs.statSync(tokenizerPath);
    console.log(`✅ tokenizer.json exists (${(stats.size / 1024).toFixed(2)} KB)`);
  } else {
    console.log('❌ tokenizer.json not found');
  }
} else {
  console.log('❌ Model directory not found');
  process.exit(1);
}

// embeddings.ts をテスト
console.log('\n🧪 Testing embedding model loading...\n');

// 環境変数を設定
process.env.HF_HUB_OFFLINE = '1';
process.env.TRANSFORMERS_CACHE = '/tmp/transformers_cache';

try {
  // embeddings.tsのロジックを直接テスト
  const { env } = require('@xenova/transformers');
  const { pipeline } = require('@xenova/transformers');
  
  console.log(`process.cwd(): ${process.cwd()}`);
  console.log(`env.localModelPath: ${env.localModelPath}`);
  
  const cwd = standaloneDir;
  env.localModelPath = '';
  env.allowRemoteModels = false;
  
  const absoluteModelPath = path.join(cwd, 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');
  console.log(`Absolute model path: ${absoluteModelPath}`);
  
  console.log('\n⏳ Loading model...');
  
  pipeline('feature-extraction', absoluteModelPath, {
    local_files_only: true,
  }).then(extractor => {
    console.log('✅ Model loaded successfully!');
    console.log('🧪 Testing embedding generation...');
    return extractor('test query', { pooling: 'mean', normalize: true });
  }).then(output => {
    console.log('✅ Embedding generated successfully!');
    console.log(`   Embedding length: ${output.data.length}`);
    console.log(`   First 5 values: ${Array.from(output.data).slice(0, 5).map(v => v.toFixed(4)).join(', ')}`);
    process.exit(0);
  }).catch(error => {
    console.error('❌ Model loading failed:');
    console.error(`   Error name: ${error.name}`);
    console.error(`   Error message: ${error.message}`);
    if (error.stack) {
      console.error(`   Error stack:\n${error.stack}`);
    }
    process.exit(1);
  });
  
} catch (error) {
  console.error('❌ Failed to require transformers:');
  console.error(error);
  process.exit(1);
}
