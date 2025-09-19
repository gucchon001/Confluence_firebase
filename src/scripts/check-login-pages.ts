import 'dotenv/config';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

async function checkLoginPages() {
  try {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const tableName = 'confluence';
    const db = await lancedb.connect(dbPath);
    
    const tables = await db.tableNames();
    if (!tables.includes(tableName)) {
      console.log('テーブルが存在しません');
      return;
    }
    
    const tbl = await db.openTable(tableName);
    
    // ログイン機能のページIDを検索
    const pageIds = ['540901632', '703889475'];
    
    console.log('=== 指定されたページIDの検索 ===');
    for (const pageId of pageIds) {
      console.log(`\nページID ${pageId} を検索中...`);
      try {
        const results = await tbl.query().where(`pageId = '${pageId}'`).toArray();
        console.log(`結果: ${results.length}件`);
        if (results.length > 0) {
          results.forEach((r, i) => {
            console.log(`  ${i+1}. タイトル: ${r.title}`);
            console.log(`     ラベル: ${JSON.stringify(r.labels)}`);
            console.log(`     URL: ${r.url}`);
          });
        } else {
          console.log('  見つかりませんでした');
        }
      } catch (error) {
        console.log(`  エラー: ${error.message}`);
      }
    }
    
    // ログイン関連のタイトル検索
    console.log('\n=== ログイン関連のタイトル検索 ===');
    const allResults = await tbl.query().select(['pageId', 'title', 'labels']).toArray();
    const loginResults = allResults.filter(r => 
      r.title && (r.title.includes('ログイン') || r.title.includes('ログアウト'))
    );
    
    console.log(`ログイン関連: ${loginResults.length}件`);
    loginResults.forEach(r => {
      console.log(`  - ${r.title} (pageId: ${r.pageId})`);
    });
    
    // 全レコード数の確認
    console.log(`\n=== 全体統計 ===`);
    console.log(`総レコード数: ${allResults.length}`);
    
  } catch (error) {
    console.error('エラー:', error.message);
  }
}

checkLoginPages();
