import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function checkSyncProgress() {
  console.log('📊 同期進捗状況を確認中...');
  
  const client = LanceDBClient.getInstance();
  await client.connect();
  const table = await client.getTable();
  
  // 現在のデータベース状況
  const totalChunks = await table.countRows();
  console.log(`📊 現在のデータベース状況:`);
  console.log(`  総チャンク数: ${totalChunks}件`);
  
  // 教室管理関連ページの確認
  const classroomResults = await table.search(new Array(768).fill(0)).limit(100).toArray();
  const classroomPages = classroomResults.filter((r: any) => 
    r.title && r.title.includes('教室管理')
  );
  
  console.log(`\n🏫 教室管理関連ページ:`);
  console.log(`  検出されたページ数: ${classroomPages.length}件`);
  
  if (classroomPages.length > 0) {
    console.log(`\n📋 教室管理ページ一覧:`);
    classroomPages.forEach((page: any, i: number) => {
      console.log(`  ${i+1}. ${page.title}`);
      console.log(`     ラベル: ${JSON.stringify(page.labels)}`);
      console.log(`     ページID: ${page.pageId}`);
    });
  }
  
  // 期待される主要ページの存在確認
  const expectedPages = [
    '160_【FIX】教室管理機能',
    '161_【FIX】教室一覧閲覧機能', 
    '162_【FIX】教室新規登録機能',
    '163_【FIX】教室情報編集機能',
    '168_【FIX】教室コピー機能'
  ];
  
  console.log(`\n🎯 期待される主要ページの存在確認:`);
  expectedPages.forEach(expectedTitle => {
    const found = classroomPages.some(p => p.title === expectedTitle);
    console.log(`  ${found ? '✅' : '❌'} ${expectedTitle} - ${found ? '存在' : '未発見'}`);
  });
  
  // ラベル統計
  const withLabels = classroomPages.filter(p => p.labels && Array.isArray(p.labels) && p.labels.length > 0);
  const withoutLabels = classroomPages.filter(p => !p.labels || !Array.isArray(p.labels) || p.labels.length === 0);
  
  console.log(`\n📈 ラベル統計:`);
  console.log(`  ラベルあり: ${withLabels.length}件`);
  console.log(`  ラベルなし: ${withoutLabels.length}件`);
}

checkSyncProgress().catch(console.error);
