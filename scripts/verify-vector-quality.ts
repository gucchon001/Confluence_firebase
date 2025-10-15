/**
 * ベクトルの品質確認
 * エンベディングが正常に生成されているかを検証
 */

import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 エンベディングベクトルの品質確認');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const client = OptimizedLanceDBClient.getInstance();
  const conn = await client.getConnection();
  const table = conn.table;
  
  const allRecords = await table.query().limit(10000).toArrow();
  
  const idCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'id'));
  const titleCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'title'));
  const vectorCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'vector'));
  const contentCol = allRecords.getChildAt(allRecords.schema.fields.findIndex((f: any) => f.name === 'content'));
  
  console.log(`総レコード数: ${allRecords.numRows}件\n`);
  
  // Step 1: 046ページのベクトルを確認
  console.log('Step 1: 046_会員退会機能のベクトル確認\n');
  
  let page046Index = -1;
  for (let i = 0; i < allRecords.numRows; i++) {
    const id = String(idCol?.get(i));
    if (id === '704643076') {
      page046Index = i;
      break;
    }
  }
  
  if (page046Index === -1) {
    console.log('❌ 046ページが見つかりません');
    await client.disconnect();
    return;
  }
  
  const title = String(titleCol?.get(page046Index));
  const content = String(contentCol?.get(page046Index));
  const vector = vectorCol?.get(page046Index);
  const vectorArray = vector?.toArray ? vector.toArray() : [];
  
  console.log(`タイトル: ${title}`);
  console.log(`コンテンツ長: ${content.length}文字`);
  console.log(`ベクトル次元: ${vectorArray.length}\n`);
  
  if (vectorArray.length === 0) {
    console.log('🚨 ベクトルが空です！エンベディング生成に失敗しています\n');
    await client.disconnect();
    return;
  }
  
  // ベクトルの統計情報
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  let zeroCount = 0;
  
  for (let i = 0; i < vectorArray.length; i++) {
    const val = vectorArray[i];
    sum += val;
    min = Math.min(min, val);
    max = Math.max(max, val);
    if (val === 0) zeroCount++;
  }
  
  const mean = sum / vectorArray.length;
  
  console.log('ベクトルの統計:');
  console.log(`  平均値: ${mean.toFixed(6)}`);
  console.log(`  最小値: ${min.toFixed(6)}`);
  console.log(`  最大値: ${max.toFixed(6)}`);
  console.log(`  ゼロの数: ${zeroCount}/${vectorArray.length} (${(zeroCount / vectorArray.length * 100).toFixed(1)}%)`);
  console.log(`  最初の10次元: [${vectorArray.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]\n`);
  
  // Step 2: すべてのレコードのベクトル品質をチェック
  console.log('Step 2: 全レコードのベクトル品質チェック\n');
  
  let nullVectorCount = 0;
  let allZeroCount = 0;
  let normalCount = 0;
  
  const vectorMagnitudes: number[] = [];
  
  for (let i = 0; i < allRecords.numRows; i++) {
    const vector = vectorCol?.get(i);
    const vectorArray = vector?.toArray ? vector.toArray() : [];
    
    if (vectorArray.length === 0) {
      nullVectorCount++;
      continue;
    }
    
    // ベクトルの大きさ（ノルム）を計算
    let magnitude = 0;
    let allZero = true;
    
    for (let j = 0; j < vectorArray.length; j++) {
      const val = vectorArray[j];
      magnitude += val * val;
      if (val !== 0) allZero = false;
    }
    
    magnitude = Math.sqrt(magnitude);
    vectorMagnitudes.push(magnitude);
    
    if (allZero) {
      allZeroCount++;
    } else {
      normalCount++;
    }
  }
  
  console.log(`ベクトル品質サマリー:`);
  console.log(`  null/空ベクトル: ${nullVectorCount}件 (${(nullVectorCount / allRecords.numRows * 100).toFixed(1)}%)`);
  console.log(`  全ゼロベクトル: ${allZeroCount}件 (${(allZeroCount / allRecords.numRows * 100).toFixed(1)}%)`);
  console.log(`  正常なベクトル: ${normalCount}件 (${(normalCount / allRecords.numRows * 100).toFixed(1)}%)\n`);
  
  if (vectorMagnitudes.length > 0) {
    const avgMagnitude = vectorMagnitudes.reduce((a, b) => a + b, 0) / vectorMagnitudes.length;
    const minMagnitude = Math.min(...vectorMagnitudes);
    const maxMagnitude = Math.max(...vectorMagnitudes);
    
    console.log(`ベクトルの大きさ（ノルム）:`);
    console.log(`  平均: ${avgMagnitude.toFixed(4)}`);
    console.log(`  最小: ${minMagnitude.toFixed(4)}`);
    console.log(`  最大: ${maxMagnitude.toFixed(4)}\n`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 結論');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (nullVectorCount > 0 || allZeroCount > 0) {
    console.log(`🚨 エンベディング生成に問題があります！`);
    console.log(`   ${nullVectorCount + allZeroCount}件のレコードで異常なベクトル\n`);
  } else {
    console.log(`✅ すべてのベクトルが正常に生成されています\n`);
    
    console.log(`しかし、検索精度が低い理由は別にあります:`);
    console.log(`  1. コンテンツが短すぎて意味表現が貧弱`);
    console.log(`  2. クエリとページ内容の意味的な乖離`);
    console.log(`  3. Phase 0A-2と異なるチャンク戦略によるコンテンツの変化\n`);
  }
  
  await client.disconnect();
}

main().catch(console.error);

