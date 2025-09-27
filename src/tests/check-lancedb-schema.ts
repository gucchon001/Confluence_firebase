/**
 * LanceDBスキーマの実際の構造確認テスト
 */

import { lancedbClient } from '../lib/lancedb-client';

async function checkLanceDBSchema(): Promise<void> {
  console.log('🔍 LanceDBスキーマ構造確認テスト開始\n');

  try {
    const db = await lancedbClient.getDatabase();
    const table = await lancedbClient.getTable();

    console.log('📊 テーブル情報:');
    console.log(`- テーブル名: ${table.name}`);
    console.log(`- データベースパス: ${db.uri}`);

    // テーブルのスキーマを確認
    const schema = table.schema;
    console.log('\n📋 テーブルスキーマ:');
    console.log(JSON.stringify(schema, null, 2));

    // サンプルデータを取得してフィールドを確認
    console.log('\n📄 サンプルデータ（最初の3件）:');
    const sampleData = await table.query().limit(3).toArray();
    
    sampleData.forEach((row, index) => {
      console.log(`\n${index + 1}. レコード: ${row.title || 'No Title'}`);
      console.log('   フィールド一覧:');
      Object.keys(row).forEach(key => {
        const value = row[key];
        const type = typeof value;
        const preview = type === 'string' ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : value;
        console.log(`   - ${key}: ${type} = ${preview}`);
      });
    });

    // URLフィールドの存在確認
    console.log('\n🔗 URLフィールドの確認:');
    const urlFieldExists = sampleData.some(row => 'url' in row);
    const urlFieldValues = sampleData.map(row => ({ title: row.title, url: row.url }));

    console.log(`- URLフィールド存在: ${urlFieldExists}`);
    console.log('- URLフィールドの値:');
    urlFieldValues.forEach(item => {
      console.log(`  - ${item.title}: "${item.url}"`);
    });

    // Space Keyフィールドの確認
    console.log('\n🏢 Space Keyフィールドの確認:');
    const spaceKeyFieldExists = sampleData.some(row => 'space_key' in row);
    const spaceKeyFieldValues = sampleData.map(row => ({ title: row.title, space_key: row.space_key }));

    console.log(`- Space Keyフィールド存在: ${spaceKeyFieldExists}`);
    console.log('- Space Keyフィールドの値:');
    spaceKeyFieldValues.forEach(item => {
      console.log(`  - ${item.title}: "${item.space_key}"`);
    });

    // 統計情報
    console.log('\n📈 データ統計:');
    const totalCount = await table.countRows();
    console.log(`- 総レコード数: ${totalCount}`);

    // URLフィールドの統計
    const urlStats = await table.query().toArray();
    const urlPresent = urlStats.filter(row => row.url && row.url.trim() !== '').length;
    const urlEmpty = urlStats.filter(row => !row.url || row.url.trim() === '').length;

    console.log(`- URL存在: ${urlPresent}件`);
    console.log(`- URL空: ${urlEmpty}件`);

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

if (require.main === module) {
  checkLanceDBSchema().catch(console.error);
}

export { checkLanceDBSchema };
