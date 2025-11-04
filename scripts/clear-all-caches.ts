/**
 * 全キャッシュをクリア
 */

import * as fs from 'fs';
import * as path from 'path';

const CACHE_PATHS = [
  '.cache/lunr-index.json',
  '.cache/embeddings-cache.json',
  '.cache/search-cache.json',
  // 追加の可能性のあるキャッシュファイル
];

async function clearAllCaches() {
  console.log('🧹 全キャッシュクリア開始\n');
  
  let cleared = 0;
  let notFound = 0;
  
  for (const cachePath of CACHE_PATHS) {
    const fullPath = path.join(process.cwd(), cachePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`✅ 削除: ${cachePath}`);
        cleared++;
      } catch (error: any) {
        console.error(`❌ 削除失敗: ${cachePath} - ${error.message}`);
      }
    } else {
      console.log(`⚠️  存在しない: ${cachePath}`);
      notFound++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log(`📊 結果: ${cleared}件削除, ${notFound}件存在せず`);
  console.log('='.repeat(80));
  console.log('\n✅ キャッシュクリア完了\n');
  
  // メモリ内キャッシュもクリアするため、アプリケーションの再起動を推奨
  console.log('💡 ヒント: サーバーを再起動してメモリ内キャッシュもクリアしてください');
}

clearAllCaches().catch(error => {
  console.error('❌ エラー:', error);
  process.exit(1);
});





















