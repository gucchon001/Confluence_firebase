/**
 * 512ページの詳細検索デバッグ
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function debug512Detailed() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    console.log('=== 512ページの詳細検索デバッグ ===');
    
    // 様々な検索パターンを試す
    const searchPatterns = [
      '教室管理',
      '教室管理-求人情報',
      '求人情報新規登録',
      '新規登録機能',
      '512_',
      '【FIX】',
      'FIX',
      '教室',
      '求人',
      '機能'
    ];
    
    for (const pattern of searchPatterns) {
      console.log(`\n--- パターン: "${pattern}" ---`);
      
      try {
        const rows = await tbl.query()
          .where(`title LIKE '%${pattern.replace(/'/g, "''")}%'`)
          .limit(10)
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
        }
        
        // 最初の3件を表示
        if (rows.length > 0) {
          console.log(`最初の3件:`);
          rows.slice(0, 3).forEach((row, index) => {
            console.log(`  ${index + 1}. ${row.title}`);
          });
        }
      } catch (error) {
        console.log(`エラー: ${error.message}`);
      }
    }
    
    // 全テーブルの行数を確認
    const totalRows = await tbl.countRows();
    console.log(`\nテーブルの総行数: ${totalRows}`);
    
    // 512ページの全チャンクを確認
    console.log(`\n--- 512ページの全チャンク ---`);
    const all512Pages = await tbl.query()
      .where(`title LIKE '%512_【FIX】教室管理-求人情報新規登録機能%'`)
      .toArray();
    
    console.log(`512ページのチャンク数: ${all512Pages.length}`);
    all512Pages.forEach((row, index) => {
      console.log(`  ${index + 1}. ID: ${row.id}, タイトル: ${row.title}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

debug512Detailed().catch(console.error);
