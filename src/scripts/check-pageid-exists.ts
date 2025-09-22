import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';

async function checkPageIdExists() {
  try {
    // LanceDBに接続
    const db = await lancedb.connect('.lancedb');
    const tbl = await db.openTable('confluence');
    
    // pageId 704545010を検索
    console.log('🔍 LanceDBからpageId 704545010を検索中...');
    const results = await tbl.query().where('"pageId" = 704545010').toArray();
    console.log(`LanceDB結果: ${results.length}件`);
    
    if (results.length > 0) {
      const result = results[0];
      console.log('LanceDB内のデータ:');
      console.log(`- pageId: ${result.pageId}`);
      console.log(`- title: ${result.title}`);
      console.log(`- lastUpdated: ${result.lastUpdated}`);
      console.log(`- labels: ${JSON.stringify(result.labels)}`);
    } else {
      console.log('❌ pageId 704545010はLanceDBに存在しません');
      console.log('   そのため、毎回新規として処理されています');
    }
    
  } catch (error: any) {
    console.error('エラー:', error.message);
  }
}

checkPageIdExists();
