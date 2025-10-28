import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function checkSchema() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  const table = await db.openTable('confluence');
  
  // スキーマ情報を取得
  const schema = table.schema;
  console.log('📋 LanceDB Schema:');
  console.log(JSON.stringify(schema, null, 2));
  
  const rowCount = await table.countRows();
  console.log(`\n📊 総行数: ${rowCount.toLocaleString()}`);
  
  // 最初の数件を取得して実際の列名を確認
  console.log('\n🔍 実際の列名を確認:');
  const sample = await table.query().limit(1).toArray();
  if (sample.length > 0) {
    console.log('列名:', Object.keys(sample[0]));
  }
}

checkSchema().catch(console.error);