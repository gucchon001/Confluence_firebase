import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function checkLabelsInDB() {
  console.log('🔍 データベース内のラベル状況を確認中...');
  
  const client = LanceDBClient.getInstance();
  await client.connect();
  const table = await client.getTable();
  
  const results = await table.search(new Array(768).fill(0)).limit(10).toArray();
  
  console.log('📊 データベース内のラベル状況:');
  results.forEach((r: any, i: number) => {
    console.log(`${i+1}. ${r.title}`);
    console.log(`   ラベル: ${JSON.stringify(r.labels)}`);
    console.log(`   ラベル型: ${typeof r.labels}`);
    console.log(`   ラベル配列か: ${Array.isArray(r.labels)}`);
    console.log('');
  });
  
  const withLabels = results.filter(r => r.labels && Array.isArray(r.labels) && r.labels.length > 0);
  const withoutLabels = results.filter(r => !r.labels || !Array.isArray(r.labels) || r.labels.length === 0);
  
  console.log(`📈 統計:`);
  console.log(`  ラベルあり: ${withLabels.length}件`);
  console.log(`  ラベルなし: ${withoutLabels.length}件`);
}

checkLabelsInDB().catch(console.error);
