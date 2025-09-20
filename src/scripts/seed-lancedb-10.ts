import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { createConfluenceRecord } from '../lib/lancedb-schema';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const tableName = 'confluence';
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable(tableName);

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
  for (let i = 0; i < 10; i++) {
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


