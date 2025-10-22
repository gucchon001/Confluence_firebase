/**
 * LanceDBのスキーマを確認するスクリプト
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function checkLanceDBSchema() {
  try {
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`📂 LanceDB接続中: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    console.log('✅ LanceDB接続成功\n');
    
    const tableName = 'confluence';
    console.log(`📋 テーブルを開く: ${tableName}`);
    const table = await db.openTable(tableName);
    console.log('✅ テーブルオープン成功\n');
    
    // 実際のデータを1件取得してフィールド名を確認
    const sampleData = await table.query().limit(1).toArray();
    
    console.log('📊 テーブルスキーマ（実データから取得）:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (sampleData.length > 0) {
      const firstRow = sampleData[0];
      const fields = Object.keys(firstRow);
      
      for (const fieldName of fields) {
        const value = firstRow[fieldName];
        const type = Array.isArray(value) ? 'array' : typeof value;
        console.log(`  ${fieldName}: ${type}`);
      }
    } else {
      console.log('  テーブルにデータがありません');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // pageId列の存在確認
    const fields = sampleData.length > 0 ? Object.keys(sampleData[0]) : [];
    const hasPageId = fields.includes('pageId');
    const hasPageid = fields.includes('pageid');
    
    console.log('🔍 重要な列の確認:');
    console.log(`  pageId (大文字): ${hasPageId ? '✅ 存在する' : '❌ 存在しない'}`);
    console.log(`  pageid (小文字): ${hasPageid ? '⚠️ 存在する（古いスキーマ）' : '✅ 存在しない'}\n`);
    
    if (hasPageid && !hasPageId) {
      console.log('⚠️ 警告: テーブルは古いスキーマ（pageid）で作られています。');
      console.log('   再構築が必要です: npm run lancedb:rebuild\n');
    } else if (hasPageId) {
      console.log('✅ テーブルは正しいスキーマ（pageId）です。\n');
    }
    
    // 行数確認
    const rowCount = await table.countRows();
    console.log(`📊 総行数: ${rowCount.toLocaleString()}行`);
    
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    process.exit(1);
  }
}

checkLanceDBSchema().catch((error) => {
  console.error('❌ スクリプト実行エラー:', error);
  process.exit(1);
});

