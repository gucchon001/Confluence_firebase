const lancedb = require('@lancedb/lancedb');
const path = require('path');

async function debugLanceDBSchema() {
  try {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log('Connecting to LanceDB at:', dbPath);
    
    const db = await lancedb.connect(dbPath);
    const tableNames = await db.tableNames();
    console.log('Available tables:', tableNames);
    
    if (tableNames.includes('confluence')) {
      const tbl = await db.openTable('confluence');
      
      // スキーマを確認
      console.log('\n=== Table Schema ===');
      const schema = tbl.schema;
      console.log(JSON.stringify(schema, null, 2));
      
      // 最初の5件のレコードを確認
      console.log('\n=== First 5 Records ===');
      const records = await tbl.query().limit(5).toArray();
      records.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        console.log('  id:', record.id);
        console.log('  title:', record.title);
        console.log('  labels:', record.labels);
        console.log('  labels type:', typeof record.labels);
        console.log('  labels isArray:', Array.isArray(record.labels));
        console.log('  pageId:', record.pageId);
        console.log('  vector length:', record.vector ? record.vector.length : 'undefined');
      });
      
      // ラベルが空でないレコードを検索
      console.log('\n=== Records with Non-Empty Labels ===');
      try {
        const nonEmptyLabels = await tbl.query()
          .where('array_length(labels) > 0')
          .limit(10)
          .toArray();
        console.log(`Found ${nonEmptyLabels.length} records with non-empty labels`);
        nonEmptyLabels.forEach((record, index) => {
          console.log(`\nRecord ${index + 1}:`);
          console.log('  id:', record.id);
          console.log('  title:', record.title);
          console.log('  labels:', record.labels);
        });
      } catch (error) {
        console.log('Error querying non-empty labels:', error.message);
      }
      
      // 全レコード数
      const totalCount = await tbl.countRows();
      console.log(`\nTotal records in table: ${totalCount}`);
      
    } else {
      console.log('Table "confluence" not found');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugLanceDBSchema();
