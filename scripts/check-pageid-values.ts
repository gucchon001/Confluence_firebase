import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  const client = OptimizedLanceDBClient.getInstance();
  const conn = await client.getConnection();
  const table = conn.table;
  
  console.log('pageIdカラムの値を確認中...\n');
  
  const result = await table.query().limit(10).toArrow();
  
  console.log(`総レコード数: ${result.numRows}\n`);
  console.log('最初の10件のpageId:');
  
  const pageIdCol = result.getChildAt(result.schema.fields.findIndex((f: any) => f.name === 'pageId'));
  const idCol = result.getChildAt(result.schema.fields.findIndex((f: any) => f.name === 'id'));
  const isChunkedCol = result.getChildAt(result.schema.fields.findIndex((f: any) => f.name === 'isChunked'));
  
  for (let i = 0; i < result.numRows; i++) {
    const pageId = pageIdCol?.get(i);
    const id = idCol?.get(i);
    const isChunked = isChunkedCol?.get(i);
    
    console.log(`  ${i+1}. pageId="${pageId}" (type: ${typeof pageId}), id="${id}", isChunked=${isChunked}`);
  }
  
  //  WHERE句テスト
  console.log('\n\nWHERE句テスト:');
  const testPageId = String(pageIdCol?.get(0));
  console.log(`対象pageId: "${testPageId}"`);
  
  console.log(`\n1. WHERE "pageId" = '${testPageId}'`);
  try {
    const test1 = await table.query().where(`"pageId" = '${testPageId}'`).limit(10).toArrow();
    console.log(`   結果: ${test1.numRows}件`);
  } catch (error: any) {
    console.log(`   エラー: ${error.message}`);
  }
  
  console.log(`\n2. WHERE pageId = '${testPageId}' (ダブルクォートなし)`);
  try {
    const test2 = await table.query().where(`pageId = '${testPageId}'`).limit(10).toArrow();
    console.log(`   結果: ${test2.numRows}件`);
  } catch (error: any) {
    console.log(`   エラー: ${error.message}`);
  }
  
  await client.disconnect();
}

main().catch(console.error);

