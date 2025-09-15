import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  const tableName = process.argv[2] || 'confluence_768';
  const vectorDim = Number(process.argv[3] || 768);

  const dbPath = path.resolve('.lancedb');
  console.log('Connecting to LanceDB at', dbPath);
  const db = await lancedb.connect(dbPath);

  const names = await db.tableNames();
  if (names.includes(tableName)) {
    console.log(`Dropping existing table '${tableName}'...`);
    await db.dropTable(tableName);
  }

  const seed = {
    id: 'seed-0',
    vector: Array(vectorDim).fill(0),
    space_key: 'SEED',
    title: 'seed',
    labels: ['_'],
    content: 'seed',
    pageId: 'seed',
    chunkIndex: 0,
    url: '',
    lastUpdated: new Date().toISOString(),
  };

  console.log(`Creating table '${tableName}' with seed row...`);
  const tbl = await db.createTable(tableName, [seed]);
  console.log('Removing seed row...');
  await tbl.delete("id = 'seed-0'");
  console.log('Done.');
}

main().catch((e) => {
  console.error('Error:', e?.message || e);
  process.exit(1);
});
