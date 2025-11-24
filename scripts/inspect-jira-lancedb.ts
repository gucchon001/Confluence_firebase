/**
 * jira_issues LanceDBテーブルの検査
 */

import 'dotenv/config';

import { connect } from '@lancedb/lancedb';
import { Schema } from 'apache-arrow';
import * as path from 'path';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await connect(dbPath);
  const table = await db.openTable('jira_issues');

  const schema: Schema = await table.schema();
  console.log('Schema:');
  schema.fields.forEach((field) => {
    console.log(`  - ${field.name}: ${field.type}`);
  });

  const count = await table.countRows();
  console.log(`jira_issues row count: ${count}`);

  const rows = await table
    .query()
    .limit(5)
    .toArray();

  rows.forEach((row, index) => {
    console.log(`\nRow ${index + 1}: id=${row.id}, title=${row.title}`);
    console.log(`  vector type: ${row.vector?.constructor?.name}`);
    console.log(`  vector length: ${row.vector?.length}`);
    if (Array.isArray(row.vector)) {
      console.log(`  vector sample: ${row.vector.slice(0, 5).map((v: number) => v.toFixed(4))}`);
    } else if (row.vector && typeof row.vector.toArray === 'function') {
      const arr = row.vector.toArray();
      console.log(`  vector sample: ${arr.slice(0, 5).map((v: number) => v.toFixed(4))}`);
    } else {
      console.log('  vector sample: n/a');
    }
    console.log(`  distance field: ${row._distance}`);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

