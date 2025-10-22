/**
 * Xenova Transformers.jsのモデルファイルを正しい階層にコピーするスクリプト
 * 
 * 注意: CopyPluginで既にXenova/サブディレクトリ構造が作られている場合、
 * このスクリプトは何もしない（冪等性を保証）
 */
const fs = require('fs');
const path = require('path');

console.log('📦 [PostBuild] Xenova Transformers.jsモデルファイルを確認中...');

const sourceDir = path.join(__dirname, '..', '.next', 'standalone', 'models', 'paraphrase-multilingual-mpnet-base-v2');
const targetDir = path.join(__dirname, '..', '.next', 'standalone', 'models', 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');

// サーバービルド用も同様に処理
const sourceDir2 = path.join(__dirname, '..', '.next', 'server', 'models', 'paraphrase-multilingual-mpnet-base-v2');
const targetDir2 = path.join(__dirname, '..', '.next', 'server', 'models', 'Xenova', 'paraphrase-multilingual-mpnet-base-v2');

function ensureXenovaStructure(src, dest) {
  // すでに正しい構造がある場合はスキップ
  const tokenizerInTarget = path.join(dest, 'tokenizer.json');
  if (fs.existsSync(tokenizerInTarget)) {
    console.log(`✅ Already exists: Xenova/${path.basename(dest)}`);
    return true;
  }
  
  // ソースディレクトリがない場合はスキップ（警告なし）
  if (!fs.existsSync(src)) {
    return false;
  }

  // Xenova/ サブディレクトリを作成
  const xenovaDir = path.dirname(dest);
  if (!fs.existsSync(xenovaDir)) {
    fs.mkdirSync(xenovaDir, { recursive: true });
  }

  // ディレクトリを移動
  try {
    fs.renameSync(src, dest);
    console.log(`✅ Moved: ${path.basename(src)} -> Xenova/${path.basename(src)}`);
    return true;
  } catch (error) {
    // renameが失敗する場合はコピーを試みる
    console.warn(`⚠️ Rename failed, trying copy...`);
    copyRecursive(src, dest);
    console.log(`✅ Copied: ${path.basename(src)} -> Xenova/${path.basename(src)}`);
    return true;
  }
}

function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

try {
  let success = false;
  
  // Standaloneビルド用
  if (ensureXenovaStructure(sourceDir, targetDir)) {
    console.log(`   Target: ${targetDir}`);
    success = true;
  }

  // サーバービルド用
  if (ensureXenovaStructure(sourceDir2, targetDir2)) {
    console.log(`   Target: ${targetDir2}`);
    success = true;
  }

  // 検証
  const tokenizerPath = path.join(targetDir, 'tokenizer.json');
  if (fs.existsSync(tokenizerPath)) {
    console.log('✅ [PostBuild] Xenova Transformers.jsモデルファイルの構造が正しく配置されました');
  } else if (success) {
    console.warn('⚠️ [PostBuild] Model files processed but verification failed');
  } else {
    console.log('ℹ️  [PostBuild] No action needed (CopyPlugin already handled)');
  }
} catch (error) {
  console.error('❌ [PostBuild] Xenova Transformers.jsモデルファイルの処理に失敗:', error.message);
  // エラーでもビルドは中断しない（CopyPluginで対応済みの可能性）
  console.warn('⚠️ Continuing build process...');
}

