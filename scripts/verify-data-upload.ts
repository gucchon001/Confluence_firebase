/**
 * データアップロードの確認スクリプト
 * ローカルのデータ型を確認してからアップロードする
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function verifyAndReport() {
  console.log('='.repeat(80));
  console.log('🔍 Local Data Verification Before Upload');
  console.log('='.repeat(80));
  
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  console.log(`\n📂 Database Path: ${dbPath}\n`);
  
  const db = await lancedb.connect(dbPath);
  const table = await db.openTable('confluence');
  
  console.log('✅ Connected\n');
  
  const rowCount = await table.countRows();
  console.log(`📊 Total rows: ${rowCount.toLocaleString()}\n`);
  
  // サンプルデータ取得
  const sampleData = await table.query().limit(5).toArray();
  
  console.log('📋 Sample Data Analysis:');
  console.log('-'.repeat(80));
  
  for (let i = 0; i < sampleData.length; i++) {
    const record = sampleData[i];
    console.log(`\n  Record ${i + 1}:`);
    console.log(`    id: ${record.id} (type: ${typeof record.id})`);
    console.log(`    pageId: ${record.pageId} (type: ${typeof record.pageId})`);
    console.log(`    title: ${record.title}`);
  }
  
  // pageIdの型統計
  const allData = await table.query().toArray();
  const pageIds = allData.map(r => r.pageId);
  const types = new Set(pageIds.map(id => typeof id));
  
  console.log(`\n📊 Type Statistics:`);
  console.log(`   - Total records: ${allData.length}`);
  console.log(`   - pageId types found: ${Array.from(types).join(', ')}`);
  console.log(`   - All pageIds are same type: ${types.size === 1}`);
  
  const firstType = Array.from(types)[0];
  console.log(`   - Primary type: ${firstType}`);
  
  if (firstType === 'string') {
    console.log(`\n✅ Local data has STRING type pageId - This will work after upload!`);
    console.log(`\n📤 Ready to upload. Run: npm run upload:production-data`);
  } else {
    console.log(`\n⚠️  Local data has ${firstType} type pageId`);
    console.log(`\n    This may need type conversion before upload.`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
}

verifyAndReport().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

