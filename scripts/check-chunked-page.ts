import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  const client = OptimizedLanceDBClient.getInstance();
  const conn = await client.getConnection();
  const table = conn.table;
  
  // チャンク化されたページを検索
  console.log('チャンク化されたページを検索中...\n');
  
  // isChunked = true のページを探す（全件取得してフィルタ）
  const allPages = await table.query().limit(1000).toArrow();
  
  const isChunkedCol = allPages.getChildAt(allPages.schema.fields.findIndex((f: any) => f.name === 'isChunked'));
  
  let chunkedPageIndex = -1;
  for (let i = 0; i < allPages.numRows; i++) {
    if (isChunkedCol?.get(i) === true) {
      chunkedPageIndex = i;
      break;
    }
  }
  
  if (chunkedPageIndex === -1) {
    console.log('⚠️ チャンク化されたページが見つかりません');
    await client.disconnect();
    return;
  }
  
  const chunkedPages = allPages;
  
  if (chunkedPages.numRows === 0) {
    console.log('⚠️ チャンク化されたページが見つかりません');
    await client.disconnect();
    return;
  }
  
  const pageIdCol = chunkedPages.getChildAt(chunkedPages.schema.fields.findIndex((f: any) => f.name === 'pageId'));
  const titleCol = chunkedPages.getChildAt(chunkedPages.schema.fields.findIndex((f: any) => f.name === 'title'));
  const idCol = chunkedPages.getChildAt(chunkedPages.schema.fields.findIndex((f: any) => f.name === 'id'));
  
  const targetPageId = String(pageIdCol?.get(chunkedPageIndex));
  const targetTitle = String(titleCol?.get(chunkedPageIndex));
  const targetId = String(idCol?.get(chunkedPageIndex));
  
  console.log(`対象ページ:`);
  console.log(`  pageId: ${targetPageId}`);
  console.log(`  title: ${targetTitle}`);
  console.log(`  id: ${targetId}\n`);
  
  // このページの全チャンクを検索
  console.log(`pageId="${targetPageId}" で全チャンクを検索中...\n`);
  
  const allChunks = await table
    .query()
    .where(`"pageId" = '${targetPageId}'`)
    .limit(100)
    .toArrow();
  
  console.log(`検索結果: ${allChunks.numRows}件\n`);
  
  if (allChunks.numRows > 0) {
    console.log('全チャンク:');
    for (let i = 0; i < allChunks.numRows; i++) {
      const idCol2 = allChunks.getChildAt(allChunks.schema.fields.findIndex((f: any) => f.name === 'id'));
      const chunkIndexCol = allChunks.getChildAt(allChunks.schema.fields.findIndex((f: any) => f.name === 'chunkIndex'));
      const totalChunksCol = allChunks.getChildAt(allChunks.schema.fields.findIndex((f: any) => f.name === 'totalChunks'));
      const contentCol = allChunks.getChildAt(allChunks.schema.fields.findIndex((f: any) => f.name === 'content'));
      
      console.log(`  ${i+1}. id=${idCol2?.get(i)}, chunkIndex=${chunkIndexCol?.get(i)}, totalChunks=${totalChunksCol?.get(i)}, content length=${String(contentCol?.get(i)).length}`);
    }
  }
  
  await client.disconnect();
}

main().catch(console.error);

