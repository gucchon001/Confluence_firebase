/**
 * LanceDBデータベース件数チェックスクリプト
 */

import * as lancedb from '@lancedb/lancedb';

async function main() {
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    const count = await table.countRows();
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    console.log(`[${timestamp}] Current count: ${count.toLocaleString()} records`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

