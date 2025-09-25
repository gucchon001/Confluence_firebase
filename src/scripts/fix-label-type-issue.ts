import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function fixLabelTypeIssue() {
  console.log('🔧 ラベルデータの型問題を修正中...');
  
  const client = LanceDBClient.getInstance();
  await client.connect();
  const table = await client.getTable();
  
  // ラベルデータの型を確認
  const sampleData = await table.search(new Array(768).fill(0)).limit(5).toArray();
  
  console.log('📊 現在のラベルデータ型:');
  sampleData.forEach((row: any, i: number) => {
    console.log(`${i+1}. ${row.title}`);
    console.log(`   ラベル: ${JSON.stringify(row.labels)}`);
    console.log(`   ラベル型: ${typeof row.labels}`);
    console.log(`   ラベル配列か: ${Array.isArray(row.labels)}`);
    console.log(`   ラベルの内容: ${JSON.stringify(row.labels, null, 2)}`);
    console.log('');
  });
  
  // ラベルが文字列配列として正しく格納されているかチェック
  const classroomPages = sampleData.filter((r: any) => 
    r.title && r.title.includes('教室管理')
  );
  
  if (classroomPages.length > 0) {
    const page = classroomPages[0];
    console.log('🔍 教室管理ページのラベル詳細:');
    console.log(`  タイトル: ${page.title}`);
    console.log(`  ラベル: ${JSON.stringify(page.labels)}`);
    console.log(`  ラベル型: ${typeof page.labels}`);
    
    // ラベルが文字列配列として正しく処理できるかテスト
    if (Array.isArray(page.labels)) {
      console.log('✅ ラベルは正しく配列として格納されています');
      page.labels.forEach((label: any, index: number) => {
        console.log(`  [${index}] ${label} (型: ${typeof label})`);
      });
    } else {
      console.log('❌ ラベルが配列として格納されていません');
      console.log('   実際の型:', typeof page.labels);
      console.log('   実際の値:', JSON.stringify(page.labels, null, 2));
    }
  }
}

fixLabelTypeIssue().catch(console.error);
