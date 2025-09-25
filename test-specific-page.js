/**
 * 特定のページID (721125561) でテストを実行
 */

const { execSync } = require('child_process');

console.log('🚀 特定ページID (721125561) テストを開始...\n');

try {
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

  console.log('\n🧪 テスト実行中...');
  
  // TypeScriptファイルを直接実行
  execSync('npx tsx src/tests/confluence-sync-test/run-test.ts', { 
    stdio: 'inherit',
    env: process.env
  });
  
  console.log('\n✅ テスト完了！');
  
} catch (error) {
  console.error('\n❌ テスト実行エラー:', error.message);
  process.exit(1);
}
