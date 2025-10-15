/**
 * エンベディングベクトルの比較
 * バックアップと現在のLanceDBで、同じページのベクトルが異なるかを検証
 */

import * as lancedb from '@lancedb/lancedb';

// テスト対象のページ
const testPageId = '704643076'; // 046_【FIX】会員退会機能

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 エンベディングベクトルの比較');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`対象ページ: ${testPageId} (046_会員退会機能)\n`);
  
  // Step 1: バックアップから読み込み
  console.log('Step 1: バックアップLanceDBから読み込み中...\n');
  
  const backupDb = await lancedb.connect('.lancedb.backup.1760508595814');
  const backupTable = backupDb.table('confluence');
  
  const backupRecords = await backupTable.query().limit(10000).toArrow();
  
  console.log(`  バックアップ総レコード数: ${backupRecords.numRows}件\n`);
  
  // pageIdでフィルタ
  const backupIdCol = backupRecords.getChildAt(backupRecords.schema.fields.findIndex((f: any) => f.name === 'id'));
  const backupPageIdCol = backupRecords.getChildAt(backupRecords.schema.fields.findIndex((f: any) => f.name === 'pageId'));
  const backupTitleCol = backupRecords.getChildAt(backupRecords.schema.fields.findIndex((f: any) => f.name === 'title'));
  const backupVectorCol = backupRecords.getChildAt(backupRecords.schema.fields.findIndex((f: any) => f.name === 'vector'));
  const backupContentCol = backupRecords.getChildAt(backupRecords.schema.fields.findIndex((f: any) => f.name === 'content'));
  
  const backupPageRecords: any[] = [];
  for (let i = 0; i < backupRecords.numRows; i++) {
    const id = String(backupIdCol?.get(i) || '');
    const pageId = backupPageIdCol ? String(backupPageIdCol.get(i)) : id.split('-')[0];
    
    if (pageId === testPageId || id === testPageId || id.startsWith(`${testPageId}-`)) {
      const vector = backupVectorCol?.get(i);
      const vectorArray = vector?.toArray ? vector.toArray() : [];
      
      backupPageRecords.push({
        id: id,
        pageId: pageId,
        title: String(backupTitleCol?.get(i)),
        content: String(backupContentCol?.get(i)),
        vector: vectorArray,
        vectorLength: vectorArray.length
      });
    }
  }
  
  console.log(`  バックアップ内の該当レコード: ${backupPageRecords.length}件`);
  backupPageRecords.forEach((r, idx) => {
    console.log(`    ${idx + 1}. id=${r.id}, vector次元=${r.vectorLength}, content長=${r.content.length}文字`);
  });
  console.log('');
  
  // Step 2: 現在のLanceDBから読み込み
  console.log('Step 2: 現在のLanceDBから読み込み中...\n');
  
  const currentDb = await lancedb.connect('.lancedb');
  const currentTable = currentDb.table('confluence');
  
  const currentRecords = await currentTable.query().limit(10000).toArrow();
  
  console.log(`  現在の総レコード数: ${currentRecords.numRows}件\n`);
  
  const currentIdCol = currentRecords.getChildAt(currentRecords.schema.fields.findIndex((f: any) => f.name === 'id'));
  const currentPageIdCol = currentRecords.getChildAt(currentRecords.schema.fields.findIndex((f: any) => f.name === 'pageId'));
  const currentTitleCol = currentRecords.getChildAt(currentRecords.schema.fields.findIndex((f: any) => f.name === 'title'));
  const currentVectorCol = currentRecords.getChildAt(currentRecords.schema.fields.findIndex((f: any) => f.name === 'vector'));
  const currentContentCol = currentRecords.getChildAt(currentRecords.schema.fields.findIndex((f: any) => f.name === 'content'));
  
  const currentPageRecords: any[] = [];
  for (let i = 0; i < currentRecords.numRows; i++) {
    const id = String(currentIdCol?.get(i) || '');
    const pageId = String(currentPageIdCol?.get(i));
    
    if (pageId === testPageId || id === testPageId || id.startsWith(`${testPageId}-`)) {
      const vector = currentVectorCol?.get(i);
      const vectorArray = vector?.toArray ? vector.toArray() : [];
      
      currentPageRecords.push({
        id: id,
        pageId: pageId,
        title: String(currentTitleCol?.get(i)),
        content: String(currentContentCol?.get(i)),
        vector: vectorArray,
        vectorLength: vectorArray.length
      });
    }
  }
  
  console.log(`  現在の該当レコード: ${currentPageRecords.length}件`);
  currentPageRecords.forEach((r, idx) => {
    console.log(`    ${idx + 1}. id=${r.id}, vector次元=${r.vectorLength}, content長=${r.content.length}文字`);
  });
  console.log('');
  
  // Step 3: ベクトルを比較
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 ベクトル比較結果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (backupPageRecords.length === 0 || currentPageRecords.length === 0) {
    console.log('❌ 比較対象のレコードが不足しています');
    return;
  }
  
  // 同じidのレコードを比較
  for (const backupRecord of backupPageRecords) {
    const matchingCurrent = currentPageRecords.find(r => r.id === backupRecord.id);
    
    if (!matchingCurrent) {
      console.log(`⚠️ id=${backupRecord.id}: 現在のLanceDBに存在しません`);
      console.log(`   バックアップでは存在していた\n`);
      continue;
    }
    
    console.log(`比較対象: id=${backupRecord.id}`);
    console.log(`  タイトル: ${backupRecord.title}`);
    console.log(`  バックアップ: vector次元=${backupRecord.vectorLength}, content長=${backupRecord.content.length}文字`);
    console.log(`  現在:       vector次元=${matchingCurrent.vectorLength}, content長=${matchingCurrent.content.length}文字\n`);
    
    // コンテンツが同じか確認
    const contentMatch = backupRecord.content === matchingCurrent.content;
    console.log(`  コンテンツ一致: ${contentMatch ? '✅ 同じ' : '❌ 異なる'}`);
    
    if (!contentMatch) {
      console.log(`    バックアップ: ${backupRecord.content.substring(0, 100)}...`);
      console.log(`    現在:       ${matchingCurrent.content.substring(0, 100)}...\n`);
    }
    
    // ベクトルが同じか確認
    if (backupRecord.vectorLength !== matchingCurrent.vectorLength) {
      console.log(`  ❌ ベクトル次元が異なります！\n`);
      continue;
    }
    
    if (backupRecord.vectorLength === 0 || matchingCurrent.vectorLength === 0) {
      console.log(`  ❌ ベクトルが空です！\n`);
      continue;
    }
    
    // ベクトルの類似度を計算（コサイン類似度）
    let dotProduct = 0;
    let backupMagnitude = 0;
    let currentMagnitude = 0;
    
    for (let i = 0; i < backupRecord.vectorLength; i++) {
      const backupVal = backupRecord.vector[i];
      const currentVal = matchingCurrent.vector[i];
      
      dotProduct += backupVal * currentVal;
      backupMagnitude += backupVal * backupVal;
      currentMagnitude += currentVal * currentVal;
    }
    
    backupMagnitude = Math.sqrt(backupMagnitude);
    currentMagnitude = Math.sqrt(currentMagnitude);
    
    const cosineSimilarity = dotProduct / (backupMagnitude * currentMagnitude);
    
    console.log(`  ベクトル類似度（コサイン）: ${cosineSimilarity.toFixed(6)}`);
    
    if (cosineSimilarity < 0.999) {
      console.log(`  ⚠️ ベクトルが異なります！ (類似度 < 0.999)\n`);
      
      // 最初の10次元を表示
      console.log(`  最初の10次元:`);
      console.log(`    バックアップ: [${backupRecord.vector.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]`);
      console.log(`    現在:       [${matchingCurrent.vector.slice(0, 10).map((v: number) => v.toFixed(4)).join(', ')}]\n`);
    } else {
      console.log(`  ✅ ベクトルはほぼ同一です\n`);
    }
  }
  
  // 新しく追加されたレコード
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 変更サマリー');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const removedRecords = backupPageRecords.filter(b => !currentPageRecords.find(c => c.id === b.id));
  const addedRecords = currentPageRecords.filter(c => !backupPageRecords.find(b => b.id === c.id));
  
  console.log(`削除されたレコード: ${removedRecords.length}件`);
  removedRecords.forEach(r => {
    console.log(`  - id=${r.id}`);
  });
  
  console.log(`\n追加されたレコード: ${addedRecords.length}件`);
  addedRecords.forEach(r => {
    console.log(`  + id=${r.id}`);
  });
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 結論');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (backupPageRecords.length > currentPageRecords.length) {
    console.log(`🚨 チャンク数が減少: ${backupPageRecords.length}件 → ${currentPageRecords.length}件`);
    console.log('   スマートチャンキングにより、一部のチャンクが統合された可能性\n');
  } else if (backupPageRecords.length < currentPageRecords.length) {
    console.log(`📈 チャンク数が増加: ${backupPageRecords.length}件 → ${currentPageRecords.length}件`);
    console.log('   チャンク分割が細かくなった可能性\n');
  } else {
    console.log(`✅ チャンク数は同じ: ${backupPageRecords.length}件\n`);
  }
}

main().catch(console.error);

