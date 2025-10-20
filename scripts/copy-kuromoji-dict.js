/**
 * Phase 0A-4: Cloud Run Gen2対応
 * 
 * Kuromoji辞書ファイルをStandaloneビルドに確実にコピー
 * Gen2では outputFileTracingIncludes が無視されるため、
 * ビルド後に明示的にコピーする
 */

const fs = require('fs');
const path = require('path');

console.log('📦 [PostBuild] Kuromoji辞書ファイルをコピー中...');

const sourceDir = path.resolve(__dirname, '../node_modules/kuromoji/dict');
const standaloneDestDir = path.resolve(__dirname, '../.next/standalone/node_modules/kuromoji/dict');

// Standaloneディレクトリが存在しない場合は作成
if (!fs.existsSync(path.dirname(standaloneDestDir))) {
  fs.mkdirSync(path.dirname(standaloneDestDir), { recursive: true });
}

// 辞書ディレクトリが存在しない場合は作成
if (!fs.existsSync(standaloneDestDir)) {
  fs.mkdirSync(standaloneDestDir, { recursive: true });
}

// 辞書ファイルをコピー
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
  console.log(`✅ [PostBuild] Kuromoji辞書ファイルをコピー完了: ${files.length}ファイル`);
  console.log(`   Source: ${sourceDir}`);
  console.log(`   Dest: ${standaloneDestDir}`);
  
  // base.dat.gzの存在確認（最重要ファイル）
  const baseDatPath = path.join(standaloneDestDir, 'base.dat.gz');
  if (fs.existsSync(baseDatPath)) {
    const size = fs.statSync(baseDatPath).size;
    console.log(`   ✅ base.dat.gz: ${(size / 1024 / 1024).toFixed(2)} MB`);
  } else {
    console.error(`   ❌ base.dat.gz が見つかりません！`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ [PostBuild] Kuromoji辞書ファイルのコピー失敗:', error);
  process.exit(1);
}

