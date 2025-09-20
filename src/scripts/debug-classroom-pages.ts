/**
 * 教室管理ページの直接検索デバッグスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function debugClassroomPages() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`LanceDB接続先: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // テーブルを開く
    const tableName = 'confluence';
    const tbl = await db.openTable(tableName);
    
    // 教室管理を含むページを直接検索
    console.log('\n=== 教室管理を含むページの直接検索 ===');
    const classroomPages = await tbl.query()
      .where("title LIKE '%教室管理%'")
      .limit(20)
      .toArray();
    
    console.log(`教室管理を含むページ数: ${classroomPages.length}`);
    
    classroomPages.forEach((page, index) => {
      console.log(`\n--- ページ ${index + 1} ---`);
      console.log(`タイトル: ${page.title}`);
      console.log(`スペース: ${page.space_key}`);
      console.log(`URL: ${page.url}`);
      console.log(`ラベル: ${JSON.stringify(page.labels)}`);
      console.log(`内容の一部: ${page.content?.substring(0, 100)}...`);
    });
    
    // 特定のページIDを検索
    console.log('\n=== 特定ページの検索 ===');
    const specificPages = ['511', '512'];
    
    for (const pageId of specificPages) {
      console.log(`\n--- ページID ${pageId} の検索 ---`);
      const pages = await tbl.query()
        .where(`title LIKE '%${pageId}_%教室管理%'`)
        .limit(5)
        .toArray();
      
      if (pages.length > 0) {
        pages.forEach((page, index) => {
          console.log(`タイトル: ${page.title}`);
          console.log(`スペース: ${page.space_key}`);
          console.log(`URL: ${page.url}`);
        });
      } else {
        console.log(`ページID ${pageId} の教室管理ページが見つかりませんでした。`);
      }
    }
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

debugClassroomPages().catch(console.error);
