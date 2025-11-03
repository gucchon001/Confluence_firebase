import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  const client = OptimizedLanceDBClient.getInstance();
  const table = await client.getTable();
  const count = await table.countRows();
  console.log('LanceDB レコード数:', count);
  
  // ユニークページ数も確認
  const results = await table
    .query()
    .select(['pageId'])
    .limit(10000)
    .execute();
  
  const uniquePages = new Set(results.map((r: any) => r.pageId));
  console.log('ユニークページ数:', uniquePages.size);
  
  client.reset();
}

main();

