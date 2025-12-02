/**
 * LanceDBテーブルのスキーマを確認するスクリプト
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tableNames = await db.tableNames();
    console.log('テーブル一覧:', tableNames);
    console.log('');

    for (const tableName of ['confluence', 'jira_issues']) {
      if (tableNames.includes(tableName)) {
        console.log(`=== ${tableName} テーブル ===`);
        const table = await db.openTable(tableName);
        const sample = await table.query().limit(1).toArray();
        
        if (sample.length > 0) {
          const fields = Object.keys(sample[0]);
          console.log('フィールド一覧:', fields);
          console.log('space_key存在:', 'space_key' in sample[0]);
          console.log('spaceKey存在:', 'spaceKey' in sample[0]);
          console.log('url存在:', 'url' in sample[0]);
          console.log('page_id存在:', 'page_id' in sample[0]);
          console.log('pageId存在:', 'pageId' in sample[0]);
          console.log('');
        } else {
          console.log('  データが存在しません');
          console.log('');
        }
      } else {
        console.log(`=== ${tableName} テーブル ===`);
        console.log('  テーブルが存在しません');
        console.log('');
      }
    }
  } catch (error) {
    console.error('エラー:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

