const path = require('path');
const lancedb = require('@lancedb/lancedb');

(async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');
  const rows = await tbl.query().select(['id','title','labels','url']).limit(2000).toArray();
  const samples = [];
  let nonEmpty = 0;
  for (const r of rows) {
    let labels = [];
    if (r.labels) {
      try {
        // LanceDBのUtf8Vectorから実際の値を取得
        labels = r.labels.toArray ? r.labels.toArray() : [];
      } catch (e) {
        labels = [];
      }
    }
    if (Array.isArray(labels) && labels.length > 0) {
      nonEmpty++;
      if (samples.length < 10) samples.push({ title: r.title, labels, url: r.url });
    }
  }
  console.log(JSON.stringify({ scanned: rows.length, nonEmpty, samples }, null, 2));
})().catch((e) => { console.error(e?.message || e); process.exit(1); });


