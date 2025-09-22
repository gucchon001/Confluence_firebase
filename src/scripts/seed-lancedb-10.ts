import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { createConfluenceRecord } from '../lib/lancedb-schema';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const tableName = 'confluence';
  const db = await lancedb.connect(dbPath);
  
  // テーブルが存在するかチェック
  const tableNames = await db.tableNames();
  let tbl;
  
  if (tableNames.includes(tableName)) {
    console.log(`テーブル '${tableName}' が存在します。開きます...`);
    tbl = await db.openTable(tableName);
  } else {
    console.log(`テーブル '${tableName}' が存在しません。作成します...`);
    // 最初のレコードでテーブルを作成
    const firstRecord = createConfluenceRecord(
      'seed-0',
      new Array(384).fill(0).map((_, j) => Math.sin(j * 0.01)),
      'SEED',
      'Seed Title 0',
      'Seed content 0',
      1000000000,
      0,
      'https://example.com/0',
      new Date().toISOString(),
      ['機能要件', '重要']
    );
    tbl = await db.createTable(tableName, [firstRecord]);
    console.log(`テーブル '${tableName}' を作成しました。`);
  }

  const labelsPool = [
    ['機能要件', '重要'],
    ['非機能要件', 'テスト計画'],
    ['議事録'],
    ['アーカイブ'],
    ['ドキュメント', 'ワークフロー'],
    ['帳票'],
    ['メールテンプレート'],
    ['meeting-notes'],
    ['スコープ外'],
    ['フォルダ']
  ];

  const records = [] as any[];
  for (let i = 1; i < 10; i++) {
    const id = `seed-${i}`;
    const spaceKey = 'SEED';
    const title = `Seed Title ${i}`;
    const content = `Seed content ${i}`;
    const pageId = 1000000000 + i;
    const chunkIndex = 0;
    const url = `https://example.com/seed/${i}`;
    const lastUpdated = new Date().toISOString();
    const labels = labelsPool[i % labelsPool.length];
    const vector = new Array(384).fill(0).map((_, j) => Math.sin(i + j) * 0.01);

    const rec = createConfluenceRecord(
      id,
      vector,
      spaceKey,
      title,
      content,
      pageId,
      chunkIndex,
      url,
      lastUpdated,
      labels
    );
    records.push(rec);
  }

  await tbl.add(records);
  console.log(`Seeded ${records.length} records.`);
}

main().catch(e => { console.error(e); process.exit(1); });


