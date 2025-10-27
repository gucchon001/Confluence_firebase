/**
 * モデルファイルのパス確認スクリプト
 * ビルド後に実行して、ファイルが正しい場所に配置されているか確認
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 モデルファイルの配置確認\n');

const workspaceDir = path.resolve(__dirname, '../.next/standalone');
console.log(`作業ディレクトリ: ${workspaceDir}`);

// チェック1: Xenova/paraphrase-multilingual-mpnet-base-v2 ディレクトリの存在
const modelDir = path.join(workspaceDir, 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');
console.log(`\n📁 モデルディレクトリ: ${modelDir}`);

if (fs.existsSync(modelDir)) {
  console.log('✅ モデルディレクトリが存在します');
  
  // ファイル一覧を表示
  const files = fs.readdirSync(modelDir);
  console.log(`   ファイル数: ${files.length}`);
  files.forEach(file => {
    const filePath = path.join(modelDir, file);
    const stats = fs.statSync(filePath);
    const size = stats.isDirectory() ? 'ディレクトリ' : `${(stats.size / 1024).toFixed(2)} KB`;
    console.log(`   - ${file} (${size})`);
  });
  
  // 重要なファイルの確認
  const tokenizerPath = path.join(modelDir, 'tokenizer.json');
  if (fs.existsSync(tokenizerPath)) {
    const size = fs.statSync(tokenizerPath).size;
    console.log(`✅ tokenizer.json 存在 (${(size / 1024).toFixed(2)} KB)`);
  } else {
    console.log('❌ tokenizer.json が見つかりません');
  }
  
  const configPath = path.join(modelDir, 'config.json');
  if (fs.existsSync(configPath)) {
    console.log('✅ config.json 存在');
  } else {
    console.log('❌ config.json が見つかりません');
  }
  
  const onnxPath = path.join(modelDir, 'onnx');
  if (fs.existsSync(onnxPath)) {
    const onnxFiles = fs.readdirSync(onnxPath);
    console.log(`✅ onnx/ ディレクトリ存在 (${onnxFiles.length} ファイル)`);
  } else {
    console.log('❌ onnx/ ディレクトリが見つかりません');
  }
  
} else {
  console.log('❌ モデルディレクトリが存在しません');
  console.log('   → postbuildスクリプトを実行してください');
}

// チェック2: 他の可能性のある場所
console.log('\n📁 他の可能性のある場所をチェック:\n');

const possiblePaths = [
  path.join(workspaceDir, 'models', 'Xenova', 'paraphrase-multilingual-mpnet-base-v2'),
  path.join(workspaceDir, 'paraphrase-multilingual-mpnet-base-v2'),
  path.join(workspaceDir, 'models', 'paraphrase-multilingual-mpnet-base-v2'),
];

possiblePaths.forEach(possiblePath => {
  if (fs.existsSync(possiblePath)) {
    console.log(`✅ 発見: ${possiblePath}`);
  }
});

// チェック3: ライブラリの期待するパス構造
console.log('\n🔍 ライブラリが検索するパス構造:\n');

const cwd = process.cwd();
const modelName = 'Xenova/paraphrase-multilingual-mpnet-base-v2';
const expectedPath = path.join(cwd, modelName);

console.log(`process.cwd(): ${cwd}`);
console.log(`モデル名: ${modelName}`);
console.log(`期待されるパス: ${expectedPath}`);

if (fs.existsSync(expectedPath)) {
  console.log('✅ 期待されるパスにファイルが存在します');
} else {
  console.log('❌ 期待されるパスにファイルがありません');
  console.log('   ファイルをこの場所にコピーするか、embeddings.tsの設定を変更してください');
}

console.log('\n--- 確認完了 ---');

