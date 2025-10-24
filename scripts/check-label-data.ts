/**
 * LanceDBのラベルデータを確認するスクリプト
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function checkLabelData() {
  try {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`📂 LanceDB接続中: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    console.log('✅ LanceDB接続成功\n');
    
    const tableName = 'confluence';
    console.log(`📋 テーブルを開く: ${tableName}`);
    const table = await db.openTable(tableName);
    console.log('✅ テーブルオープン成功\n');
    
    // ラベル情報を持つデータを取得
    const sampleData = await table.query().limit(5).toArray();
    
    console.log('📊 ラベルデータのサンプル:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    for (let i = 0; i < sampleData.length; i++) {
      const row = sampleData[i];
      
      // Vectorから実際の配列に変換
      let labelsArray: string[] = [];
      if (row.labels && typeof row.labels === 'object' && 'toArray' in row.labels) {
        labelsArray = row.labels.toArray();
      } else if (Array.isArray(row.labels)) {
        labelsArray = row.labels;
      }
      
      console.log(`📄 サンプル ${i + 1}:`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Title: ${row.title}`);
      console.log(`   Labels:`, labelsArray.length > 0 ? labelsArray : '(なし)');
      console.log(`   SpaceKey: ${row.spaceKey}`);
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // ラベルの統計情報
    const allData = await table.query().toArray();
    const labelCounts: Record<string, number> = {};
    let hasLabelsCount = 0;
    
    for (const row of allData) {
      // Vectorから実際の配列に変換
      let labelsArray: string[] = [];
      if (row.labels && typeof row.labels === 'object' && 'toArray' in row.labels) {
        labelsArray = row.labels.toArray();
      } else if (Array.isArray(row.labels)) {
        labelsArray = row.labels;
      }
      
      if (labelsArray.length > 0) {
        hasLabelsCount++;
        for (const label of labelsArray) {
          labelCounts[label] = (labelCounts[label] || 0) + 1;
        }
      }
    }
    
    console.log('📊 ラベル統計:');
    console.log(`   総レコード数: ${allData.length}`);
    console.log(`   ラベル有りレコード: ${hasLabelsCount}`);
    console.log(`   ラベル無しレコード: ${allData.length - hasLabelsCount}`);
    console.log('');
    
    if (Object.keys(labelCounts).length > 0) {
      console.log('🏷️ ラベル別の使用数（上位10件）:');
      const sortedLabels = Object.entries(labelCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      
      for (const [label, count] of sortedLabels) {
        console.log(`   ${label}: ${count}件`);
      }
      console.log('');
      
      console.log('✅ ラベルデータは正常に存在します');
    } else {
      console.log('⚠️ ラベルデータが見つかりませんでした');
    }
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

checkLabelData().catch((error) => {
  console.error('❌ スクリプト実行エラー:', error);
  process.exit(1);
});

