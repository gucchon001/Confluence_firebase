import 'dotenv/config';
import { LanceDBClient } from '../lib/lancedb-client';

async function debugDeletionIssue() {
  console.log('🔍 削除クエリの問題をデバッグ中...');
  
  const client = LanceDBClient.getInstance();
  await client.connect();
  const table = await client.getTable();
  
  // 特定のページIDでテスト
  const testPageId = 704053435; // 160_【FIX】教室管理機能
  
  console.log(`\n📊 ページID ${testPageId} の現在の状況:`);
  
  // 現在のチャンク数を確認
  const allData = await table.search(new Array(768).fill(0)).limit(10000).toArray();
  const existingChunks = allData.filter((chunk: any) => chunk.pageId === testPageId);
  
  console.log(`  既存チャンク数: ${existingChunks.length}件`);
  existingChunks.forEach((chunk: any, i: number) => {
    console.log(`    ${i+1}. ID: ${chunk.id}, タイトル: ${chunk.title}`);
  });
  
  if (existingChunks.length > 0) {
    console.log(`\n🧪 削除クエリをテスト中...`);
    
    // 削除前の状況
    console.log('削除前のチャンク数:', existingChunks.length);
    
    // 削除クエリを実行
    try {
      const deleteQuery = `"pageId" = ${testPageId}`;
      console.log(`実行する削除クエリ: ${deleteQuery}`);
      
      await table.delete(deleteQuery);
      console.log('✅ 削除クエリ実行完了');
      
      // 削除後の状況を確認
      const afterData = await table.search(new Array(768).fill(0)).limit(10000).toArray();
      const remainingChunks = afterData.filter((chunk: any) => chunk.pageId === testPageId);
      
      console.log(`削除後のチャンク数: ${remainingChunks.length}件`);
      
      if (remainingChunks.length === 0) {
        console.log('✅ 削除が正常に実行されました');
      } else {
        console.log('❌ 削除が不完全でした');
        remainingChunks.forEach((chunk: any, i: number) => {
          console.log(`  残存 ${i+1}. ID: ${chunk.id}, タイトル: ${chunk.title}`);
        });
      }
      
    } catch (error) {
      console.error('❌ 削除クエリエラー:', error);
    }
  }
}

debugDeletionIssue().catch(console.error);
