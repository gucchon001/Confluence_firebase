/**
 * モデルファイルをStandaloneビルドに確実にコピー
 * 
 * 実行タイミング: next build の後に自動実行 (postbuild)
 * コピー先: .next/standalone/models/Xenova/paraphrase-multilingual-mpnet-base-v2/
 */

const fs = require('fs');
const path = require('path');

console.log('📦 [PostBuild] モデルファイルをコピー中...');

const sourceDir = path.resolve(__dirname, '../models/paraphrase-multilingual-mpnet-base-v2');
const standaloneDestDir = path.resolve(__dirname, '../.next/standalone/models/Xenova/paraphrase-multilingual-mpnet-base-v2');

// sourceディレクトリが存在しない場合はエラー
if (!fs.existsSync(sourceDir)) {
  console.error(`❌ [PostBuild] ソースディレクトリが存在しません: ${sourceDir}`);
  console.error('   prebuildスクリプトでモデルをダウンロードしてください: npm run model:download');
  process.exit(1);
}

// Standaloneディレクトリが存在しない場合は作成
if (!fs.existsSync(path.dirname(standaloneDestDir))) {
  fs.mkdirSync(path.dirname(standaloneDestDir), { recursive: true });
}

// モデルディレクトリが存在しない場合は作成
if (!fs.existsSync(standaloneDestDir)) {
  fs.mkdirSync(standaloneDestDir, { recursive: true });
}

// モデルファイルをコピー
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  copyRecursiveSync(sourceDir, standaloneDestDir);
  
  // 確認
  const files = fs.readdirSync(standaloneDestDir);
  console.log(`✅ [PostBuild] モデルファイルをコピー完了: ${files.length}ファイル`);
  console.log(`   Source: ${sourceDir}`);
  console.log(`   Dest: ${standaloneDestDir}`);
  
  // tokenizer.jsonの存在確認（最重要ファイル）
  const tokenizerPath = path.join(standaloneDestDir, 'tokenizer.json');
  if (fs.existsSync(tokenizerPath)) {
    const size = fs.statSync(tokenizerPath).size;
    console.log(`   ✅ tokenizer.json: ${(size / 1024).toFixed(2)} KB`);
  } else {
    console.error(`   ❌ tokenizer.json が見つかりません！`);
    process.exit(1);
  }
  
  // config.jsonの存在確認
  const configPath = path.join(standaloneDestDir, 'config.json');
  if (fs.existsSync(configPath)) {
    console.log(`   ✅ config.json: 存在確認`);
  } else {
    console.error(`   ❌ config.json が見つかりません！`);
    process.exit(1);
  }
  
  // onnxディレクトリの確認
  const onnxPath = path.join(standaloneDestDir, 'onnx');
  if (fs.existsSync(onnxPath)) {
    const onnxFiles = fs.readdirSync(onnxPath);
    console.log(`   ✅ onnx/: ${onnxFiles.length}ファイル`);
  } else {
    console.error(`   ❌ onnxディレクトリが見つかりません！`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ [PostBuild] モデルファイルのコピー失敗:', error);
  process.exit(1);
}

