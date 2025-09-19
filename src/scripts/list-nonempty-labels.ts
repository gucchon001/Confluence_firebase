import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');

  const rows = await tbl.query().select(['id','title','labels','url']).limit(1000).toArray();
  let nonEmpty = 0;
  const samples: any[] = [];
  for (const r of rows) {
    const labels: string[] = Array.isArray(r.labels) ? r.labels : [];
    if (labels.length > 0) {
      nonEmpty++;
      if (samples.length < 10) {
        samples.push({ title: r.title, labels, url: r.url });
      }
    }
  }
  console.log(JSON.stringify({ scanned: rows.length, nonEmpty, samples }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });


