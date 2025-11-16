/**
 * Kuromoji辞書ファイルを.next/standaloneにコピー
 * postbuildスクリプトで実行される
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(process.cwd(), 'node_modules/kuromoji/dict');
const targetDir = path.resolve(process.cwd(), '.next/standalone/node_modules/kuromoji/dict');

console.log('[copy-kuromoji-dict] Starting copy process...');
console.log(`[copy-kuromoji-dict] Source: ${sourceDir}`);
console.log(`[copy-kuromoji-dict] Target: ${targetDir}`);

// ソースディレクトリの存在確認
if (!fs.existsSync(sourceDir)) {
  console.warn(`[copy-kuromoji-dict] ⚠️  Source directory not found: ${sourceDir}`);
  console.warn('[copy-kuromoji-dict] Skipping copy (kuromoji may not be installed)');
  process.exit(0);
}

// ターゲットディレクトリの親ディレクトリを作成
const targetParentDir = path.dirname(targetDir);
if (!fs.existsSync(targetParentDir)) {
  fs.mkdirSync(targetParentDir, { recursive: true });
}

// ターゲットディレクトリを作成
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 辞書ファイルをコピー
try {
  const files = fs.readdirSync(sourceDir);
  let copiedCount = 0;

  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    const targetPath = path.join(targetDir, file);
    const stat = fs.statSync(sourcePath);

    if (stat.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
      console.log(`[copy-kuromoji-dict] ✅ Copied: ${file}`);
    }
  }

  console.log(`[copy-kuromoji-dict] ✅ Successfully copied ${copiedCount} files`);
} catch (error) {
  console.error('[copy-kuromoji-dict] ❌ Error copying files:', error.message);
  process.exit(1);
}

