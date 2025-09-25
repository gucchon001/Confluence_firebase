const fs = require('fs');
const path = require('path');

function getDirectorySize(dirPath) {
  let totalSize = 0;
  let fileCount = 0;
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        const subResult = getDirectorySize(itemPath);
        totalSize += subResult.size;
        fileCount += subResult.count;
      } else {
        totalSize += stats.size;
        fileCount++;
      }
    }
  } catch (error) {
    console.log(`エラー: ${dirPath} - ${error.message}`);
  }
  
  return { size: totalSize, count: fileCount };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

console.log('🔍 .lancedbディレクトリの詳細分析');
console.log('=====================================');

const lancedbPath = '.lancedb';
if (fs.existsSync(lancedbPath)) {
  console.log('✅ .lancedbディレクトリが存在します');
  
  // 全体のサイズを計算
  const totalResult = getDirectorySize(lancedbPath);
  console.log(`📊 総ファイル数: ${totalResult.count}件`);
  console.log(`💾 総サイズ: ${formatBytes(totalResult.size)}`);
  
  // サブディレクトリごとの分析
  const items = fs.readdirSync(lancedbPath);
  for (const item of items) {
    const itemPath = path.join(lancedbPath, item);
    const stats = fs.statSync(itemPath);
    
    if (stats.isDirectory()) {
      const subResult = getDirectorySize(itemPath);
      console.log(`\n📁 ${item}/`);
      console.log(`   ファイル数: ${subResult.count}件`);
      console.log(`   サイズ: ${formatBytes(subResult.size)}`);
      
      // 特に大きなディレクトリの詳細分析
      if (subResult.size > 10 * 1024 * 1024) { // 10MB以上
        console.log(`   ⚠️ 大きなディレクトリです`);
        
        // サブディレクトリの詳細
        try {
          const subItems = fs.readdirSync(itemPath);
          for (const subItem of subItems) {
            const subItemPath = path.join(itemPath, subItem);
            const subStats = fs.statSync(subItemPath);
            
            if (subStats.isDirectory()) {
              const subSubResult = getDirectorySize(subItemPath);
              console.log(`     📁 ${subItem}/: ${subSubResult.count}件, ${formatBytes(subSubResult.size)}`);
            } else {
              console.log(`     📄 ${subItem}: ${formatBytes(subStats.size)}`);
            }
          }
        } catch (error) {
          console.log(`     エラー: ${error.message}`);
        }
      }
    } else {
      console.log(`📄 ${item}: ${formatBytes(stats.size)}`);
    }
  }
  
  // データ効率の分析
  console.log('\n📈 データ効率分析:');
  console.log(`   推定レコード数: 1,141件`);
  console.log(`   1レコードあたりの平均サイズ: ${formatBytes(totalResult.size / 1141)}`);
  console.log(`   1ファイルあたりの平均サイズ: ${formatBytes(totalResult.size / totalResult.count)}`);
  
  // 問題の特定
  if (totalResult.size > 100 * 1024 * 1024) { // 100MB以上
    console.log('\n⚠️ 問題: ファイルサイズが大きすぎます');
    console.log('   原因の可能性:');
    console.log('   1. 重複データの存在');
    console.log('   2. 不要なバージョンファイル');
    console.log('   3. トランザクションファイルの蓄積');
    console.log('   4. ベクトルデータの非効率な保存');
  }
  
} else {
  console.log('❌ .lancedbディレクトリが存在しません');
}

console.log('\n✅ 分析完了');
