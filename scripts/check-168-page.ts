import * as lancedb from '@lancedb/lancedb';

async function main() {
  const db = await lancedb.connect('.lancedb');
  const table = await db.openTable('confluence');
  const all = await table.query().limit(10000).toArray();
  
  const page168 = all.filter((r: any) => r.title.includes('168') || r.title.includes('教室コピー'));
  
  console.log(`📄 168または教室コピーを含むページ: ${page168.length}件\n`);
  page168.forEach((p: any) => {
    console.log(`  - ${p.title} (${p.id})`);
  });
}

main().catch(console.error);

