import 'dotenv/config';
import { connect } from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  const dbPath = path.resolve(process.cwd(), '.lancedb');
  console.log(`📂 LanceDB パス: ${dbPath}`);
  
  try {
    const db = await connect(dbPath);
    const tableNames = await db.tableNames();
    
    console.log(`\n📊 テーブル一覧 (${tableNames.length}件):`);
    tableNames.forEach((name, index) => {
      console.log(`  ${index + 1}. ${name}`);
    });
    
    if (tableNames.includes('jira_issues')) {
      console.log('\n✅ jira_issues テーブルが見つかりました');
      const table = await db.openTable('jira_issues');
      const count = await table.countRows();
      console.log(`   レコード数: ${count}件`);
    } else {
      console.log('\n❌ jira_issues テーブルが見つかりませんでした');
    }
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ 予期しないエラーが発生しました:', error);
  process.exit(1);
});

