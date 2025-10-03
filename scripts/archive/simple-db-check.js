const fs = require('fs');
const path = require('path');

console.log('🔍 LanceDBデータベース分析');
console.log('=====================================');

// .lancedbディレクトリの構造を確認
const lancedbPath = '.lancedb';
if (fs.existsSync(lancedbPath)) {
  console.log('✅ .lancedbディレクトリが存在します');
  
  // ディレクトリの内容を確認
  const items = fs.readdirSync(lancedbPath);
  console.log('📁 ディレクトリ内容:', items);
  
  // confluence.lanceディレクトリの確認
  const confluencePath = path.join(lancedbPath, 'confluence.lance');
  if (fs.existsSync(confluencePath)) {
    console.log('✅ confluence.lanceディレクトリが存在します');
    
    // サブディレクトリの確認
    const subItems = fs.readdirSync(confluencePath);
    console.log('📁 confluence.lance内容:', subItems);
    
    // データファイルの数を確認
    const dataPath = path.join(confluencePath, 'data');
    if (fs.existsSync(dataPath)) {
      const dataFiles = fs.readdirSync(dataPath);
      console.log(`📊 データファイル数: ${dataFiles.length}件`);
    }
    
    // バージョンファイルの数を確認
    const versionsPath = path.join(confluencePath, '_versions');
    if (fs.existsSync(versionsPath)) {
      const versionFiles = fs.readdirSync(versionsPath);
      console.log(`📊 バージョンファイル数: ${versionFiles.length}件`);
    }
    
    // トランザクションファイルの数を確認
    const transactionsPath = path.join(confluencePath, '_transactions');
    if (fs.existsSync(transactionsPath)) {
      const transactionFiles = fs.readdirSync(transactionsPath);
      console.log(`📊 トランザクションファイル数: ${transactionFiles.length}件`);
    }
  } else {
    console.log('❌ confluence.lanceディレクトリが存在しません');
  }
  
  // ディレクトリサイズの計算
  function getDirectorySize(dirPath) {
    let totalSize = 0;
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
    
    return totalSize;
  }
  
  try {
    const totalSize = getDirectorySize(lancedbPath);
    console.log(`💾 総ディレクトリサイズ: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
  } catch (error) {
    console.log('⚠️ ディレクトリサイズの計算に失敗:', error.message);
  }
  
} else {
  console.log('❌ .lancedbディレクトリが存在しません');
}

console.log('\n✅ 分析完了');
