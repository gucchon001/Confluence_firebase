/**
 * 環境変数の読み込みテスト
 * .envファイルが正しく読み込まれているか確認
 */

import 'dotenv/config';

console.log('🔍 環境変数の読み込みテスト');
console.log('=' .repeat(50));

console.log('📋 環境変数の確認:');
console.log(`  CONFLUENCE_BASE_URL: ${process.env.CONFLUENCE_BASE_URL}`);
console.log(`  CONFLUENCE_USER_EMAIL: ${process.env.CONFLUENCE_USER_EMAIL}`);
console.log(`  CONFLUENCE_API_TOKEN: ${process.env.CONFLUENCE_API_TOKEN ? '設定済み' : '未設定'}`);
console.log(`  CONFLUENCE_SPACE_KEY: ${process.env.CONFLUENCE_SPACE_KEY}`);

// API URLの構築テスト
const baseUrl = process.env.CONFLUENCE_BASE_URL;
const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
const apiUrl = `${baseUrl}/wiki/rest/api/content?spaceKey=${spaceKey}&expand=body.storage,space,version,metadata.labels&limit=10`;

console.log('\n🔗 API URLの構築:');
console.log(`  ベースURL: ${baseUrl}`);
console.log(`  スペースキー: ${spaceKey}`);
console.log(`  完全なURL: ${apiUrl}`);

// 認証情報の確認
const username = process.env.CONFLUENCE_USER_EMAIL;
const apiToken = process.env.CONFLUENCE_API_TOKEN;

if (username && apiToken) {
  const authHeader = `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`;
  console.log('\n🔐 認証情報:');
  console.log(`  ユーザー: ${username}`);
  console.log(`  トークン: ${apiToken.substring(0, 20)}...`);
  console.log(`  認証ヘッダー: ${authHeader.substring(0, 50)}...`);
} else {
  console.log('\n❌ 認証情報が不足しています');
}

// 簡単なAPI呼び出しテスト
async function testApiCall() {
  console.log('\n🧪 API呼び出しテスト');
  console.log('=' .repeat(30));
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${username}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`📊 レスポンス状況: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ API呼び出し成功: ${data.results?.length || 0}件のページを取得`);
    } else {
      console.log(`❌ API呼び出し失敗: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log(`エラー詳細: ${errorText.substring(0, 200)}...`);
    }
  } catch (error) {
    console.error(`❌ API呼び出しエラー:`, error);
  }
}

// テスト実行
testApiCall().catch(error => {
  console.error('❌ テスト実行エラー:', error);
});
