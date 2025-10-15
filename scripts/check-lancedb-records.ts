import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  const client = OptimizedLanceDBClient.getInstance();
  const conn = await client.getConnection();
  const table = conn.table;
  
  const count = await table.countRows();
  console.log('現在のLanceDBレコード数:', count);
  
  const result = await table.query().limit(10).toArrow();
  console.log('\nサンプルレコード:');
  
  for (let i = 0; i < Math.min(10, result.numRows); i++) {
    const idCol = result.getChildAt(result.schema.fields.findIndex((f: any) => f.name === 'id'));
    const titleCol = result.getChildAt(result.schema.fields.findIndex((f: any) => f.name === 'title'));
    const isChunkedCol = result.getChildAt(result.schema.fields.findIndex((f: any) => f.name === 'isChunked'));
    
    console.log(`  ${i+1}. id=${idCol?.get(i)}, isChunked=${isChunkedCol?.get(i)}`);
    console.log(`      title=${titleCol?.get(i)}`);
  }
  
  // isChunked統計
  const allRecords = await table.query().limit(10000).toArrow();
  const isChunkedCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'isChunked'));
  
  let chunkedCount = 0;
  let notChunkedCount = 0;
  
  for (let i = 0; i < allRecords.numRows; i++) {
    const isChunked = isChunkedCol?.get(i);
    if (isChunked === true) {
      chunkedCount++;
    } else {
      notChunkedCount++;
    }
  }
  
  console.log('\n統計:');
  console.log(`  チャンク化されたページ (isChunked=true): ${chunkedCount}`);
  console.log(`  チャンク化されていないページ (isChunked=false): ${notChunkedCount}`);
  console.log(`  合計: ${chunkedCount + notChunkedCount}`);
  
  await client.disconnect();
}

main().catch(console.error);

