import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { createConfluenceRecord } from '../lib/lancedb-schema';

const LABEL_SETS: string[][] = [
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

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const tableName = 'confluence';
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable(tableName);

  const records: any[] = [];
  for (let i = 0; i < 50; i++) {
    const id = `seed50-${i}`;
    const spaceKey = i % 2 === 0 ? 'SEED' : 'SEED2';
    const title = `Seed50 Title ${i}`;
    const content = `Seed50 content ${i} about feature ${i % 5}`;
    const pageId = `seed50-page-${i}`;
    const chunkIndex = 0;
    const url = `https://example.com/seed50/${i}`;
    const lastUpdated = new Date(Date.now() - i * 60000).toISOString();
    const labels = LABEL_SETS[i % LABEL_SETS.length];
    const vector = new Array(384).fill(0).map((_, j) => Math.sin(i * 0.1 + j * 0.01));

    records.push(
      createConfluenceRecord(
        id,
        vector,
        spaceKey,
        title,
        content,
        parseInt(pageId),
        chunkIndex,
        url,
        lastUpdated,
        labels
      )
    );
  }

  await tbl.add(records);
  console.log(`Seeded ${records.length} records.`);
}

main().catch(e => { console.error(e); process.exit(1); });


