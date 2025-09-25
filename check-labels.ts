/**
 * LanceDBのラベルデータを確認
 */

import 'dotenv/config';
import { LanceDBClient } from './src/lib/lancedb-client';

async function checkLabels() {
  console.log('🔍 LanceDBのラベルデータを確認中...\n');

  try {
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    
    const table = await lancedbClient.getTable();
    if (!table) {
      console.log('❌ テーブルが見つかりません');
      return;
    }

    // 全データを取得（ダミーベクトルで全件取得）
    const dummyVector = new Array(768).fill(0);
    const searchResults = await table.search(dummyVector).limit(1000).toArray();
    console.log(`📊 総チャンク数: ${searchResults.length}`);
    
    // 結果を配列に変換
    const allData = searchResults;

    if (allData.length === 0) {
      console.log('❌ データがありません');
      return;
    }

    // ラベル統計
    const labelStats = new Map<string, number>();
    let pagesWithLabels = 0;
    let totalLabels = 0;

    allData.forEach((row: any, index: number) => {
      console.log(`\n📄 チャンク ${index + 1}:`);
      console.log(`  ID: ${row.id}`);
      console.log(`  PageID: ${row.pageId}`);
      console.log(`  タイトル: ${row.title}`);
      console.log(`  ラベルの型: ${typeof row.labels}`);
      console.log(`  ラベルの値: ${JSON.stringify(row.labels)}`);
      
      if (Array.isArray(row.labels)) {
        pagesWithLabels++;
        totalLabels += row.labels.length;
        row.labels.forEach((label: string) => {
          labelStats.set(label, (labelStats.get(label) || 0) + 1);
        });
        console.log(`  ✅ ラベル配列: [${row.labels.join(', ')}]`);
      } else {
        console.log(`  ❌ ラベルが配列ではありません`);
      }
    });

    console.log('\n📊 ラベル統計:');
    console.log(`  総ラベル数: ${totalLabels}`);
    console.log(`  ラベル付きページ数: ${pagesWithLabels}`);
    console.log(`  ユニークラベル数: ${labelStats.size}`);
    
    if (labelStats.size > 0) {
      console.log('\n🏷️ ラベル一覧:');
      labelStats.forEach((count, label) => {
        console.log(`  ${label}: ${count}回`);
      });
    }

    // データ型チェック
    console.log('\n🔍 データ型チェック:');
    let correctDataTypes = 0;
    let incorrectDataTypes = 0;

    allData.forEach((row: any, index: number) => {
      const isCorrect = Array.isArray(row.labels) && Array.isArray(row.vector);
      if (isCorrect) {
        correctDataTypes++;
      } else {
        incorrectDataTypes++;
        console.log(`  ❌ チャンク ${index + 1}: labels=${typeof row.labels}, vector=${typeof row.vector}`);
      }
    });

    console.log(`\n📈 データ型の正確性:`);
    console.log(`  ✅ 正しい型: ${correctDataTypes}件`);
    console.log(`  ❌ 間違った型: ${incorrectDataTypes}件`);
    console.log(`  正確性: ${correctDataTypes === allData.length ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkLabels().catch(console.error);
