/**
 * Xenova Transformers.jsのモデルファイルを正しい階層にコピーするスクリプト
 * Xenovaは models/Xenova/model-name という階層を期待するため、
 * ビルド後にファイルを移動する
 */
const fs = require('fs');
const path = require('path');

console.log('📦 [PostBuild] Xenova Transformers.jsモデルファイルを再配置中...');

const sourceDir = path.join(__dirname, '..', '.next', 'standalone', 'models', 'paraphrase-multilingual-mpnet-base-v2');
const targetDir = path.join(__dirname, '..', '.next', 'standalone', 'models', 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');

// サーバービルド用も同様に処理
const sourceDir2 = path.join(__dirname, '..', '.next', 'server', 'models', 'paraphrase-multilingual-mpnet-base-v2');
const targetDir2 = path.join(__dirname, '..', '.next', 'server', 'models', 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');

function moveDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`⚠️ Source directory not found: ${src}`);
    return false;
  }

  // Xenova/ サブディレクトリを作成
  const xenovaDir = path.dirname(dest);
  if (!fs.existsSync(xenovaDir)) {
    fs.mkdirSync(xenovaDir, { recursive: true });
  }

  // ディレクトリを移動
  fs.renameSync(src, dest);
  console.log(`✅ Moved: ${path.basename(src)} -> Xenova/${path.basename(src)}`);
  return true;
}

try {
  // Standaloneビルド用
  if (moveDirectory(sourceDir, targetDir)) {
    console.log(`   Target: ${targetDir}`);
  }

  // サーバービルド用
  if (moveDirectory(sourceDir2, targetDir2)) {
    console.log(`   Target: ${targetDir2}`);
  }

  // 検証
  const tokenizerPath = path.join(targetDir, 'tokenizer.json');
  if (fs.existsSync(tokenizerPath)) {
    console.log('✅ [PostBuild] Xenova Transformers.jsモデルファイルの再配置が完了しました');
  } else {
    console.error('❌ [PostBuild] Verification failed: tokenizer.json not found');
  }
} catch (error) {
  console.error('❌ [PostBuild] Xenova Transformers.jsモデルファイルの再配置に失敗:', error.message);
  process.exit(1);
}

