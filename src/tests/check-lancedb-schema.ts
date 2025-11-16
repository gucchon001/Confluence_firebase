/**
 * LanceDBスキーマの実際の構造確認テスト
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
// 注意: このimportは必ず最初に実行される必要があります
import { loadTestEnv } from './test-helpers/env-loader';

// loadTestEnv()を即座に実行して環境変数を設定
loadTestEnv();

// 環境変数が設定されたことを確認（デバッグ用）
const requiredEnvVars = [
  'CONFLUENCE_BASE_URL',
  'CONFLUENCE_USER_EMAIL',
  'CONFLUENCE_API_TOKEN',
  'CONFLUENCE_SPACE_KEY',
  'GEMINI_API_KEY',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
];
const missingVars = requiredEnvVars.filter(key => !process.env[key] || process.env[key]?.trim() === '');
if (missingVars.length > 0) {
  console.error(`[check-lancedb-schema] ❌ 必須環境変数が設定されていません: ${missingVars.join(', ')}`);
  process.exit(1);
}

// 環境変数が設定された後にapp-configをインポート
// lancedb-clientは内部でapp-configをインポートするため、
// この時点で環境変数が設定されている必要があります
// 動的インポートを使用して、loadTestEnv()の実行後に確実にインポートされるようにする
async function checkLanceDBSchema(): Promise<void> {
  console.log('🔍 LanceDBスキーマ構造確認テスト開始\n');

  // 動的インポートでlancedb-clientを読み込む（環境変数設定後に確実に実行される）
  const { lancedbClient } = await import('../lib/lancedb-client');

  try {
    console.log('📡 LanceDBに接続中...');
    const db = await lancedbClient.getDatabase();
    const table = await lancedbClient.getTable();

    console.log('✅ LanceDB接続成功\n');
    console.log('📊 テーブル情報:');
    const tableName = lancedbClient.getTableName();
    console.log(`- テーブル名: ${tableName}`);
    console.log(`- テーブルオブジェクト名: ${table.name || 'N/A'}`);

    // テーブルのスキーマを確認
    const schema = table.schema;
    console.log('\n📋 テーブルスキーマ:');
    console.log(JSON.stringify(schema, null, 2));

    // サンプルデータを取得してフィールドを確認
    console.log('\n📄 サンプルデータ（最初の3件）:');
    const sampleData = await table.query().limit(3).toArray();
    
    if (sampleData.length === 0) {
      console.log('⚠️  サンプルデータが存在しません');
    } else {
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
    }

    // 統計情報
    console.log('\n📈 データ統計:');
    const totalCount = await table.countRows();
    console.log(`- 総レコード数: ${totalCount}`);

    if (totalCount > 0) {
      // URLフィールドの統計
      const urlStats = await table.query().limit(100).toArray();
      const urlPresent = urlStats.filter(row => row.url && row.url.trim() !== '').length;
      const urlEmpty = urlStats.filter(row => !row.url || row.url.trim() === '').length;

      console.log(`- URL存在: ${urlPresent}件（サンプル100件中）`);
      console.log(`- URL空: ${urlEmpty}件（サンプル100件中）`);
    }

    console.log('\n✅ LanceDBスキーマ検証完了');

  } catch (error) {
    console.error('\n❌ エラー:', error);
    if (error instanceof Error) {
      console.error('エラーメッセージ:', error.message);
      console.error('スタックトレース:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  checkLanceDBSchema()
    .then(() => {
      // 正常終了時に明示的にexit(0)を呼ぶ
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

export { checkLanceDBSchema };
