/**
 * LanceDBデータを.next/standaloneにコピー（オプション）
 * postbuildスクリプトで実行される
 * 注意: 本番環境では通常Cloud Storageからデータを取得するため、このコピーは開発/テスト用
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.resolve(process.cwd(), '.lancedb');
const targetDir = path.resolve(process.cwd(), '.next/standalone/.lancedb');

console.log('[copy-lancedb-data] Starting copy process...');
console.log(`[copy-lancedb-data] Source: ${sourceDir}`);
console.log(`[copy-lancedb-data] Target: ${targetDir}`);

// ソースディレクトリの存在確認
if (!fs.existsSync(sourceDir)) {
  console.log(`[copy-lancedb-data] ℹ️  Source directory not found: ${sourceDir}`);
  console.log('[copy-lancedb-data] Skipping copy (LanceDB data will be loaded from Cloud Storage in production)');
  process.exit(0);
}

// ターゲットディレクトリを作成
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// 再帰的にディレクトリとファイルをコピー
function copyRecursive(source, target) {
  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
    const files = fs.readdirSync(source);
    for (const file of files) {
      copyRecursive(path.join(source, file), path.join(target, file));
    }
  } else {
    fs.copyFileSync(source, target);
  }
}

try {
  copyRecursive(sourceDir, targetDir);
  console.log('[copy-lancedb-data] ✅ Successfully copied LanceDB data');
} catch (error) {
  console.error('[copy-lancedb-data] ❌ Error copying files:', error.message);
  // LanceDBデータのコピーは本番環境では必須ではないため、警告のみ
  console.warn('[copy-lancedb-data] ⚠️  Continuing build (LanceDB data can be loaded from Cloud Storage)');
}

