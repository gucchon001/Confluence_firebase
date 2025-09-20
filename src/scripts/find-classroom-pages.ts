/**
 * 教室管理ページを検索するスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function findClassroomPages() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    console.log('=== 教室管理ページの検索 ===');
    
    // 教室管理を含むページを検索
    const classroomPages = await tbl.query()
      .where(`title LIKE '%教室管理%'`)
      .limit(50)
      .toArray();
    
    console.log(`教室管理を含むページ数: ${classroomPages.length}`);
    
    classroomPages.forEach((page, index) => {
      console.log(`\n--- ページ ${index + 1} ---`);
      console.log(`ID: ${page.id}`);
      console.log(`タイトル: ${page.title}`);
      console.log(`ページID: ${page.pageId}`);
      console.log(`スペース: ${page.space_key}`);
      console.log(`URL: ${page.url}`);
      console.log(`ベクトル: ${page.vector ? 'あり' : 'なし'}`);
      console.log(`ラベル: ${JSON.stringify(page.labels)}`);
    });
    
    // 特定のタイトルを検索
    const specificTitles = [
      '511_【FIX】教室管理-求人一覧閲覧機能',
      '512_【FIX】教室管理-求人情報新規登録機能'
    ];
    
    console.log('\n=== 特定タイトルの検索 ===');
    
    for (const title of specificTitles) {
      console.log(`\n--- "${title}" の検索 ---`);
      
      const pages = await tbl.query()
        .where(`title = '${title.replace(/'/g, "''")}'`)
        .toArray();
      
      if (pages.length > 0) {
        console.log(`見つかりました: ${pages.length}件`);
        pages.forEach((page, index) => {
          console.log(`  ${index + 1}. ID: ${page.id}, ページID: ${page.pageId}, ベクトル: ${page.vector ? 'あり' : 'なし'}`);
        });
      } else {
        console.log('見つかりませんでした');
      }
    }
    
    // 全テーブルの行数を確認
    const totalRows = await tbl.countRows();
    console.log(`\nテーブルの総行数: ${totalRows}`);
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

findClassroomPages().catch(console.error);
