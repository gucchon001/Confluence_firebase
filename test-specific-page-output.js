/**
 * 特定のページID (721125561) でテストを実行（ファイル出力版）
 */

const { execSync } = require('child_process');
const fs = require('fs');

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
  
  // TypeScriptファイルを実行して結果をファイルに出力
  const output = execSync('npx tsx src/tests/confluence-sync-test/run-test.ts', { 
    encoding: 'utf8',
    env: process.env
  });
  
  // 結果をファイルに保存
  fs.writeFileSync('test-output.txt', output);
  console.log('\n✅ テスト完了！結果をtest-output.txtに保存しました。');
  
} catch (error) {
  console.error('\n❌ テスト実行エラー:', error.message);
  
  // エラーもファイルに保存
  fs.writeFileSync('test-error.txt', error.message + '\n' + error.stack);
  console.log('エラー詳細をtest-error.txtに保存しました。');
  
  process.exit(1);
}
