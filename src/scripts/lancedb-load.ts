/*
  LanceDB loader: Load embeddings JSON/JSONL into a local LanceDB database (.lancedb/).
  Usage:
    npx tsx src/scripts/lancedb-load.ts data/embeddings-CLIENTTOMO.json
*/
import fs from 'fs';
import path from 'path';
import * as lancedb from '@lancedb/lancedb';

type InputRecord = {
  id: string;
  embedding: number[];
  featureVector?: number[];
  restricts?: any[];
  space_key?: string;
  title?: string;
  labels?: string[];
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

  const db = await lancedb.connect(path.resolve('.lancedb'));
  const tableName = 'confluence';

  const data = rows.map((r) => ({
    id: r.id,
    vector: (r.embedding || r.featureVector) as number[],
    space_key: r.space_key || extractRestrict(r.restricts, 'space_key') || null,
    title: r.title || extractRestrict(r.restricts, 'title')?.[0] || null,
    labels: r.labels || extractRestrict(r.restricts, 'label') || [],
  }));

  const schema = {
    id: 'utf8',
    vector: { type: 'fixed_size_list', listSize: (data[0]?.vector?.length || 768), field: { type: 'float32' } },
    space_key: 'utf8',
    title: 'utf8',
    labels: { type: 'list', field: { type: 'utf8' } },
  } as any;

  const exists = (await db.tableNames()).includes(tableName);
  const tbl = exists
    ? await db.openTable(tableName)
    : await db.createTable(tableName, data.slice(0, 0), { schema });

  if (!exists) {
    await tbl.add(data);
  } else {
    // upsert by id
    await tbl.mergeInsert(data, ['id']);
  }

  console.log(`Loaded ${data.length} records into .lancedb/${tableName}`);
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


