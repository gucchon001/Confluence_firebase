/**
 * LanceDBスキーマ確認スクリプト
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function checkSchema() {
  try {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`📂 Connecting to: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    const table = await db.openTable('confluence');
    
    console.log(`✅ Connected\n`);
    
    // サンプルデータを取得
    const sampleData = await table.query().limit(5).toArray();
    
    if (sampleData.length === 0) {
      console.log('❌ No data found');
      return;
    }
    
    console.log('📊 Sample data structure:\n');
    
    // 最初のレコードの各フィールドの型を確認
    const firstRecord = sampleData[0];
    console.log(`Field types for first record:\n`);
    
    for (const [key, value] of Object.entries(firstRecord)) {
      const type = typeof value;
      const valueStr = typeof value === 'string' && value.length > 50 
        ? value.substring(0, 50) + '...' 
        : String(value);
      
      console.log(`  - ${key}: ${type} (example: ${valueStr})`);
    }
    
    console.log('\n📋 Checking pageId column specifically:\n');
    console.log(`  - pageId value: ${firstRecord.pageId}`);
    console.log(`  - pageId type: ${typeof firstRecord.pageId}`);
    
    // pageIdの型をより詳しく確認
    const pageIds = sampleData.map(r => r.pageId);
    console.log(`\n  - pageId values: [${pageIds.slice(0, 3).join(', ')}]`);
    
    // 数値型として扱えるか確認
    const isNumeric = pageIds.every(id => typeof id === 'number' || !isNaN(Number(id)));
    console.log(`  - Are all pageIds numeric? ${isNumeric}`);
    
    console.log('\n✅ Schema check completed\n');
    
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    console.error('Stack:', error.stack);
  }
}

checkSchema().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});

