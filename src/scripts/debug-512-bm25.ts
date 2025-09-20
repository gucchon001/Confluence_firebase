/**
 * 512ページのBM25検索をデバッグするスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function debug512BM25() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    console.log('=== 512ページのBM25検索デバッグ ===');
    
    // 検索キーワード
    const keywords = ['教室管理', '教室', 'room scheduling', 'クラスルームマネジメント'];
    
    for (const keyword of keywords) {
      console.log(`\n--- キーワード: "${keyword}" ---`);
      
      const rows = await tbl.query()
        .where(`title LIKE '%${keyword.replace(/'/g, "''")}%'`)
        .limit(20)
        .toArray();
      
      console.log(`検索結果数: ${rows.length}`);
      
      // 512ページが含まれているかチェック
      const has512 = rows.some(row => row.title.includes('512_【FIX】教室管理-求人情報新規登録機能'));
      console.log(`512ページが含まれている: ${has512}`);
      
      if (has512) {
        const page512 = rows.find(row => row.title.includes('512_【FIX】教室管理-求人情報新規登録機能'));
        console.log(`512ページの詳細:`);
        console.log(`  ID: ${page512.id}`);
        console.log(`  タイトル: ${page512.title}`);
        console.log(`  ベクトル: ${page512.vector ? 'あり' : 'なし'}`);
      }
      
      // 最初の5件を表示
      console.log(`最初の5件:`);
      rows.slice(0, 5).forEach((row, index) => {
        console.log(`  ${index + 1}. ${row.title}`);
      });
    }
    
    // 512ページを直接検索
    console.log(`\n--- 512ページの直接検索 ---`);
    const directSearch = await tbl.query()
      .where(`title LIKE '%512_【FIX】教室管理-求人情報新規登録機能%'`)
      .toArray();
    
    console.log(`直接検索結果数: ${directSearch.length}`);
    directSearch.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.title} (ベクトル: ${row.vector ? 'あり' : 'なし'})`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

debug512BM25().catch(console.error);
