import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function removeTestData() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');
  
  console.log('テストデータを削除中...');
  await tbl.delete('id LIKE "seed-%"');
  console.log('テストデータを削除しました。');
  
  const count = await tbl.countRows();
  console.log(`残りのレコード数: ${count}`);
}

removeTestData().catch(console.error);
