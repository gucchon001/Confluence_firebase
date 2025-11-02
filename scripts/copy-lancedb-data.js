/**
 * LanceDBデータをStandaloneビルドに確実にコピー
 * Next.js standaloneビルドではデータファイルが自動的にコピーされないため、
 * ビルド後に明示的にコピーする
 */

const fs = require('fs');
const path = require('path');

console.log('📦 [PostBuild] LanceDBデータをコピー中...');

const sourceDir = path.resolve(__dirname, '../.lancedb');
const standaloneDestDir = path.resolve(__dirname, '../.next/standalone/.lancedb');

// .next/standaloneディレクトリが存在しない場合はエラー
if (!fs.existsSync(path.dirname(standaloneDestDir))) {
  console.error('❌ [PostBuild] .next/standaloneディレクトリが見つかりません！');
  console.error('   next buildが正常に完了していない可能性があります。');
  process.exit(1);
}

// ソースディレクトリが存在しない場合は警告（条件付きダウンロードをスキップした場合）
if (!fs.existsSync(sourceDir)) {
  console.warn('⚠️  [PostBuild] ソース.lancedbディレクトリが見つかりません。');
  console.warn('   ビルド時にダウンロードがスキップされた可能性があります。');
  console.warn('   実行時にCloud Storageからダウンロードする必要があります。');
  process.exit(0); // エラーではなく警告で継続
}

// ディレクトリを再帰的にコピー
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
  const files = getAllFiles(standaloneDestDir);
  const totalSize = calculateTotalSize(standaloneDestDir);
  
  console.log(`✅ [PostBuild] LanceDBデータをコピー完了: ${files.length}ファイル`);
  console.log(`   Source: ${sourceDir}`);
  console.log(`   Dest: ${standaloneDestDir}`);
  console.log(`   総サイズ: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  
  // confluence.lanceディレクトリの存在確認
  const confluenceLancePath = path.join(standaloneDestDir, 'confluence.lance');
  if (fs.existsSync(confluenceLancePath)) {
    const confluenceFiles = getAllFiles(confluenceLancePath);
    console.log(`   ✅ confluence.lance: ${confluenceFiles.length}ファイル`);
  } else {
    console.error(`   ❌ confluence.lanceディレクトリが見つかりません！`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ [PostBuild] LanceDBデータのコピー失敗:', error);
  process.exit(1);
}

// ヘルパー関数: ディレクトリ内の全ファイルを取得
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);
  
  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });
  
  return arrayOfFiles;
}

// ヘルパー関数: ディレクトリの総サイズを計算
function calculateTotalSize(dirPath) {
  const files = getAllFiles(dirPath);
  let totalSize = 0;
  
  files.forEach((filePath) => {
    totalSize += fs.statSync(filePath).size;
  });
  
  return totalSize;
}

