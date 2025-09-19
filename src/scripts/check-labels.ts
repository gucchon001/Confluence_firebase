import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const tableName = 'confluence';
  const db = await lancedb.connect(dbPath);

  const tables = await db.tableNames();
  if (!tables.includes(tableName)) {
    console.error(`Table '${tableName}' not found at ${dbPath}`);
    process.exit(1);
  }
  const tbl = await db.openTable(tableName);

  const targets = [
    {
      title: '【統合のためクローズ】アカウント契約情報',
      url: 'https://giginc.atlassian.net/wiki/spaces/CLIENTTOMO/pages/960561281',
    },
    {
      title: '■クライアント企業向け管理画面',
      url: 'https://giginc.atlassian.net/wiki/spaces/CLIENTTOMO/pages/666927294',
    },
  ];

  for (const t of targets) {
    // URLで一致するレコードを抽出
    const rows = await tbl
      .query()
      .where(`url = '${t.url}'`)
      .select(['id', 'title', 'labels', 'chunkIndex', 'url'])
      .toArray();

    console.log(`\n=== Check: ${t.title} ===`);
    if (rows.length === 0) {
      console.log('No records found for URL:', t.url);
      continue;
    }
    const uniqueLabels = new Set<string>();
    for (const r of rows) {
      const labels: string[] = Array.isArray(r.labels) ? r.labels : [];
      labels.forEach((l) => uniqueLabels.add(l));
    }
    console.log(`Records: ${rows.length}`);
    console.log('Labels:', Array.from(uniqueLabels));
  }

  // 全体のラベル出現数（サンプリング）
  const sample = await tbl.query().limit(500).select(['labels']).toArray();
  const labelCount: Record<string, number> = {};
  for (const r of sample) {
    const labels: string[] = Array.isArray(r.labels) ? r.labels : [];
    for (const l of labels) {
      labelCount[l] = (labelCount[l] || 0) + 1;
    }
  }
  const sorted = Object.entries(labelCount).sort((a, b) => b[1] - a[1]);
  console.log('\n=== Label sample stats (top 20) ===');
  console.log(sorted.slice(0, 20));
}

main().catch((e) => {
  console.error('check-labels failed:', e?.message || e);
  process.exit(1);
});


