/**
 * データベース状況確認スクリプト
 */

import 'dotenv/config';
import { LanceDBClient } from '../../lib/lancedb-client';

async function checkDatabaseStatus() {
  console.log('📊 データベース状況を確認中...');
  
  try {
    const client = LanceDBClient.getInstance();
    await client.connect();
    const table = await client.getTable();

    // 全データを取得
    const dummyVector = new Array(768).fill(0);
    const allData = await table.search(dummyVector).limit(50).toArray();

    console.log(`📊 現在のデータベース状況:`);
    console.log(`  総チャンク数: ${allData.length}件`);

    if (allData.length > 0) {
      console.log('\n📄 最新のデータ（最初の5件）:');
      allData.slice(0, 5).forEach((row: any, i: number) => {
        console.log(`  ${i+1}. PageID: ${row.pageId}`);
        console.log(`     タイトル: ${row.title}`);
        console.log(`     ラベル: [${row.labels && Array.isArray(row.labels) ? row.labels.join(', ') : 'なし'}]`);
        console.log(`     更新日時: ${row.lastUpdated}`);
        console.log('');
      });

      // ラベルが含まれているページをカウント
      const pagesWithLabels = allData.filter((row: any) => 
        row.labels && Array.isArray(row.labels) && row.labels.length > 0
      );

      console.log(`\n📊 ラベル統計:`);
      console.log(`  ラベルが含まれているページ数: ${pagesWithLabels.length}件`);
      console.log(`  ラベルが含まれていないページ数: ${allData.length - pagesWithLabels.length}件`);

      if (pagesWithLabels.length > 0) {
        console.log('\n✅ ラベルが含まれているページ:');
        pagesWithLabels.slice(0, 3).forEach((row: any, i: number) => {
          console.log(`  ${i+1}. ${row.title} - [${row.labels.join(', ')}]`);
        });
      } else {
        console.log('\n⚠️ ラベルが含まれているページが見つかりませんでした');
      }
    }

  } catch (error) {
    console.error('❌ データベース状況確認エラー:', error);
  }
}

checkDatabaseStatus().catch(console.error);
