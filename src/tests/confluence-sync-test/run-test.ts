/**
 * Confluence同期テスト実行スクリプト
 * 20ページのテストを実行
 */

import 'dotenv/config';
import { ConfluenceSyncTest } from './confluence-sync-test';

async function main() {
  console.log('🚀 Confluence同期テスト実行スクリプト');
  console.log('=====================================\n');

  // 環境変数の確認
  console.log('🔍 環境変数の確認:');
  const requiredEnvVars = [
    'CONFLUENCE_BASE_URL',
    'CONFLUENCE_USER_EMAIL',
    'CONFLUENCE_SPACE_KEY',
    'CONFLUENCE_API_TOKEN'
  ];

  let allEnvVarsSet = true;
  requiredEnvVars.forEach(envVar => {
    if (process.env[envVar]) {
      console.log(`✅ ${envVar}: ${envVar.includes('TOKEN') ? '***設定済み***' : process.env[envVar]}`);
    } else {
      console.log(`❌ ${envVar}: 設定されていません`);
      allEnvVarsSet = false;
    }
  });

  if (!allEnvVarsSet) {
    console.log('\n❌ 必要な環境変数が設定されていません。.envファイルを確認してください。');
    process.exit(1);
  }

  console.log('\n🧪 特定ページID (721125561) テストを開始します...\n');

  try {
    console.log('🔧 ConfluenceSyncTestインスタンスを作成中...');
    const test = new ConfluenceSyncTest();
    console.log('✅ インスタンス作成完了');
    
    console.log('🔄 テスト実行中...');
    await test.runTest();
    console.log('✅ テスト実行完了');
  } catch (error) {
    console.error('\n❌ テスト実行エラー:', error);
    console.error('エラー詳細:', error);
    process.exit(1);
  }
}

main().catch(console.error);
