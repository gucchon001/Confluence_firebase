import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

async function checkSpecificPage() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');
  
  // 実際に保存されたページIDで検索
  const results = await tbl.query()
    .where(`"pageId" = '703889475'`)
    .toArray();
    
  console.log('ページID 703889475 のレコード数:', results.length);
  if (results.length > 0) {
    console.log('ラベル:', JSON.stringify(results[0].labels));
    console.log('タイトル:', results[0].title);
    console.log('チャンク数:', results.length);
  }

  // 960561281でも検索してみる
  const originalResults = await tbl.query()
    .where(`"pageId" = '960561281'`)
    .toArray();
    
  console.log('\nページID 960561281 のレコード数:', originalResults.length);
}

checkSpecificPage().catch(console.error);
