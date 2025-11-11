const path = require("path");
const lancedb = require("@lancedb/lancedb");

async function main() {
  const baseDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(".lancedb");
  const db = await lancedb.connect(baseDir);
  const table = await db.openTable("confluence");
  const rows = await table.search(new Array(768).fill(0)).limit(2000).toArray();

  const match = (text) => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return lower.includes("template") || lower.includes("テンプレート") || lower.includes("メール");
  };

  const results = rows.filter((row) => {
    return match(row.structured_feature) || match(row.structured_category) || match(row.title) || match(row.content);
  }).map((row) => ({
    page_id: row.page_id,
    title: row.title,
    structured_feature: row.structured_feature,
    structured_category: row.structured_category,
    snippet: row.content ? row.content.slice(0, 120) : ''
  }));

  console.log(JSON.stringify({ count: results.length, records: results.slice(0, 10) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
