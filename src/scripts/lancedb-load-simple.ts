/*
  LanceDB loader: Load embeddings JSON/JSONL into a local LanceDB database (.lancedb/).
  Usage:
    npx tsx src/scripts/lancedb-load-simple.ts data/embeddings-CLIENTTOMO.json
*/
import fs from 'fs';
import path from 'path';
import * as lancedb from '@lancedb/lancedb';

async function main() {
  try {
    // 1. LanceDBに接続
    console.log('Connecting to LanceDB...');
    const db = await lancedb.connect('.lancedb');
    
    // 2. サンプルデータでテーブル作成
    console.log('Creating table with sample data...');
    const sampleData = [
      { 
        id: 'sample-1',
        vector: new Array(768).fill(0.1),
        space_key: 'SAMPLE',
        title: 'Sample Document',
        labels: ['test', 'sample']
      }
    ];
    
    const tableName = 'confluence';
    
    // テーブルが存在するか確認
    const tableNames = await db.tableNames();
    if (tableNames.includes(tableName)) {
      console.log(`Table '${tableName}' already exists, opening...`);
      const tbl = await db.openTable(tableName);
      console.log('Table opened successfully');
      
      // テーブル情報を表示
      const stats = await tbl.countRows();
      console.log(`Table contains ${stats} rows`);
      
      // サンプルクエリを実行
      console.log('Running sample query...');
      const results = await tbl.search(new Array(768).fill(0.1)).limit(1).toArray();
      console.log('Query results:', results);
    } else {
      console.log(`Creating new table '${tableName}'...`);
      const tbl = await db.createTable(tableName, sampleData);
      console.log('Table created successfully');
    }
    
    console.log('LanceDB test completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
