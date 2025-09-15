/*
  LanceDB loader: Load embeddings JSON/JSONL into a local LanceDB database (.lancedb/).
  Usage:
    npx tsx src/scripts/lancedb-load.ts data/embeddings-CLIENTTOMO.json
*/
import fs from 'fs';
import path from 'path';
import * as lancedb from '@lancedb/lancedb';

type InputRecord = {
  id?: string;
  pageId?: string;
  chunkIndex?: number;
  embedding?: number[];
  featureVector?: number[];
  restricts?: any[];
  space_key?: string;
  title?: string;
  labels?: string[];
  text?: string;
};

async function readJsonOrJsonl(filePath: string): Promise<InputRecord[]> {
  const buf = fs.readFileSync(filePath, 'utf8');
  const text = buf.replace(/^\uFEFF/, '').trim();
  if (text.startsWith('[')) {
    return JSON.parse(text);
  }
  return text
    .split(/\r?\n/)
    .map((ln) => ln.trim())
    .filter(Boolean)
    .map((ln) => JSON.parse(ln));
}

async function main() {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: npx tsx src/scripts/lancedb-load.ts <path-to-json-or-jsonl>');
    process.exit(1);
  }

  const abs = path.resolve(src);
  if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
  }

  const rows = await readJsonOrJsonl(abs);
  if (rows.length === 0) {
    console.log('No records to load.');
    return;
  }

  console.log(`Read ${rows.length} records from ${src}`);

  // LanceDBに接続
  console.log('Connecting to LanceDB...');
  const db = await lancedb.connect('.lancedb');
  const tableName = 'confluence';

  // データの準備
  const data = rows.map((r) => {
    // Generate ID if not present
    const id = r.id || (r.pageId && r.chunkIndex !== undefined ? `${r.pageId}-${r.chunkIndex}` : undefined);
    
    // Get embedding vector
    const vector = r.embedding || r.featureVector;
    
    return {
      id: id || `unknown-${Math.random().toString(36).substring(2, 11)}`,
      vector: vector,
      space_key: r.space_key || extractRestrict(r.restricts, 'space_key') || '',
      title: r.title || extractRestrict(r.restricts, 'title')?.[0] || '',
      labels: Array.isArray(r.labels) ? r.labels : 
              Array.isArray(extractRestrict(r.restricts, 'label')) ? 
              extractRestrict(r.restricts, 'label') : []
      // textフィールドは削除（既存スキーマと不整合のため）
    };
  });

  console.log(`Prepared ${data.length} records for LanceDB`);

  try {
    // テーブルが存在するか確認
    const tableNames = await db.tableNames();
    const exists = tableNames.includes(tableName);
    
    if (exists) {
      console.log(`Table '${tableName}' already exists, opening...`);
      const tbl = await db.openTable(tableName);
      
      // 既存テーブルにデータをマージ
      console.log(`Merging ${data.length} records into table...`);
      await tbl.add(data);
      console.log(`Successfully merged data into table '${tableName}'`);
      
      // テーブル情報を表示
      const stats = await tbl.countRows();
      console.log(`Table now contains ${stats} rows`);
    } else {
      console.log(`Creating new table '${tableName}'...`);
      const tbl = await db.createTable(tableName, data);
      console.log(`Successfully created table '${tableName}' with ${data.length} records`);
    }
    
    console.log(`Loaded ${data.length} records into .lancedb/${tableName}`);
  } catch (error) {
    console.error('Error working with LanceDB:', error);
    process.exit(1);
  }
}

function extractRestrict(restricts: any[] | undefined, key: string): any {
  if (!Array.isArray(restricts)) return undefined;
  const ns = restricts.find((r) => r?.namespace === key);
  return ns?.allow_list;
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});