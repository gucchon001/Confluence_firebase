/**
 * 特定ページの検索デバッグスクリプト
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function debugSpecificPages() {
  try {
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    const specificTitles = [
      '511_【FIX】教室管理-求人一覧閲覧機能',
      '512_【FIX】教室管理-求人情報新規登録機能'
    ];
    
    console.log('=== 特定ページの検索 ===');
    
    for (const title of specificTitles) {
      console.log(`\n--- "${title}" の検索 ---`);
      
      // 完全一致検索
      const exactMatch = await tbl.query()
        .where(`title = '${title.replace(/'/g, "''")}'`)
        .limit(1)
        .toArray();
      
      if (exactMatch.length > 0) {
        console.log(`完全一致: 見つかりました`);
        console.log(`タイトル: ${exactMatch[0].title}`);
        console.log(`スペース: ${exactMatch[0].space_key}`);
        console.log(`URL: ${exactMatch[0].url}`);
        console.log(`ラベル: ${JSON.stringify(exactMatch[0].labels)}`);
      } else {
        console.log(`完全一致: 見つかりませんでした`);
      }
      
      // 部分一致検索
      const partialMatch = await tbl.query()
        .where(`title LIKE '%${title.replace(/'/g, "''")}%'`)
        .limit(5)
        .toArray();
      
      console.log(`部分一致: ${partialMatch.length}件`);
      partialMatch.forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.title}`);
      });
      
      // 「教室」キーワードで検索
      const classroomMatch = await tbl.query()
        .where(`title LIKE '%教室%'`)
        .limit(50)
        .toArray();
      
      const hasClassroom = classroomMatch.some(page => page.title === title);
      console.log(`「教室」キーワード検索に含まれる: ${hasClassroom ? 'YES' : 'NO'}`);
      
      if (hasClassroom) {
        const page = classroomMatch.find(p => p.title === title);
        console.log(`  見つかったページ: ${page?.title}`);
      }
    }
    
    // 「教室管理」で検索
    console.log(`\n=== 「教室管理」キーワード検索 ===`);
    const classroomManagementMatch = await tbl.query()
      .where(`title LIKE '%教室管理%'`)
      .limit(20)
      .toArray();
    
    console.log(`「教室管理」検索結果数: ${classroomManagementMatch.length}`);
    classroomManagementMatch.forEach((page, index) => {
      console.log(`  ${index + 1}. ${page.title}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

debugSpecificPages().catch(console.error);
