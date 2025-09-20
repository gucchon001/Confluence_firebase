import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import { getRowsByPageId, getRowsByPageIdViaUrl } from '../lib/lancedb-utils';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');

  const target = 1000000003;
  console.log(`Testing equality where "pageId" = ${target}`);
  const rows = await tbl.query().where(`"pageId" = ${target}`).toArray();
  console.log(`Found: ${rows.length}`);
  rows.slice(0, 5).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}`);
  });

  console.log('\nScan first 5 rows pageId values:');
  const first = await tbl.query().select(['pageId','title']).limit(5).toArray();
  first.forEach((r: any, i: number) => {
    console.log(`${i + 1}. pageId=${r.pageId} (type=${typeof r.pageId}), title=${r.title}`);
  });

  console.log('\nRange where "pageId" >= 1000000000:');
  const range = await tbl.query().where(`"pageId" >= 1000000000`).toArray();
  console.log(`Found in range: ${range.length}`);

  console.log(`\nBETWEEN equality check for ${target}`);
  const between = await tbl.query().where(`"pageId" BETWEEN ${target} AND ${target}`).toArray();
  console.log(`Found by BETWEEN: ${between.length}`);

  // Test real pageId after full sync
  const realId = 703889475;
  console.log(`\nReal ID equality test: "pageId" = ${realId}`);
  const realRows = await tbl.query().where(`"pageId" = ${realId}`).toArray();
  console.log(`Found realId: ${realRows.length}`);
  realRows.slice(0, 5).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}, url=${r.url}`);
  });

  console.log(`\nReal ID IN() test: "pageId" IN (${realId})`);
  const realIn = await tbl.query().where(`"pageId" IN (${realId})`).toArray();
  console.log(`Found IN: ${realIn.length}`);
  realIn.slice(0, 5).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}`);
  });

  try {
    console.log(`\nReal ID CAST equality test: CAST("pageId" AS Int64) = ${realId}`);
    const realCast = await tbl.query().where(`CAST("pageId" AS Int64) = ${realId}`).toArray();
    console.log(`Found CAST: ${realCast.length}`);
  } catch (e: any) {
    console.log(`CAST test skipped due to error: ${e?.message || e}`);
  }

  console.log(`\nReal ID range-equality test: "pageId" >= ${realId} AND "pageId" < ${realId + 1}`);
  const realRangeEq = await tbl.query().where(`"pageId" >= ${realId} AND "pageId" < ${realId + 1}`).toArray();
  console.log(`Found range-eq: ${realRangeEq.length}`);
  realRangeEq.slice(0, 10).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}, url=${r.url}`);
  });

  console.log(`\nTitle LIKE check for login page:`);
  const likeRows = await tbl.query().where(`title LIKE '%会員ログイン・ログアウト%'`).toArray();
  console.log(`Found by title LIKE: ${likeRows.length}`);
  likeRows.slice(0, 10).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}, url=${r.url}`);
  });

  console.log(`\nFallback util getRowsByPageId(${realId}):`);
  const utilRows = await getRowsByPageId(tbl as any, realId);
  console.log(`Found by util: ${utilRows.length}`);
  utilRows.slice(0, 10).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}, url=${r.url}`);
  });

  console.log(`\nURL LIKE fallback for pageId ${realId}:`);
  const viaUrl = await getRowsByPageIdViaUrl(tbl as any, realId);
  console.log(`Found via URL: ${viaUrl.length}`);
  viaUrl.slice(0, 10).forEach((r: any, i: number) => {
    console.log(`${i + 1}. title=${r.title}, pageId=${r.pageId}, url=${r.url}`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });


