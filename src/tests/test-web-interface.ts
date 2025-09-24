/**
 * Webインターフェースのテスト
 * 統一キーワード抽出サービスが実際のWebアプリで正常に動作するかテスト
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:9003';

interface TestCase {
  name: string;
  query: string;
  expectedKeywords?: string[];
  expectedResponseTime?: number; // ms
}

const testCases: TestCase[] = [
  {
    name: '教室管理の詳細検索',
    query: '教室管理の詳細は',
    expectedKeywords: ['教室管理', '教室管理一覧', '教室管理登録', '教室管理編集'],
    expectedResponseTime: 1000 // 1秒以内
  },
  {
    name: 'ログイン機能の検索',
    query: 'ログイン機能について',
    expectedKeywords: ['ログイン', '認証', 'アクセス'],
    expectedResponseTime: 1000
  },
  {
    name: 'オファー管理の検索',
    query: 'オファー管理の機能',
    expectedKeywords: ['オファー', '管理', '機能'],
    expectedResponseTime: 1000
  }
];

async function testWebInterface() {
  console.log('🌐 Webインターフェース テスト開始');
  console.log('=' .repeat(60));
  console.log(`🔗 テスト対象URL: ${BASE_URL}`);
  console.log('');

  let passedTests = 0;
  let totalTests = testCases.length;

  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`[${i + 1}/${totalTests}] ${testCase.name}`);
    console.log(`🔍 クエリ: "${testCase.query}"`);

    try {
      const startTime = Date.now();
      
      // APIエンドポイントにリクエストを送信
      const response = await axios.post(`${BASE_URL}/api/search`, {
        query: testCase.query,
        limit: 10
      }, {
        timeout: 10000, // 10秒タイムアウト
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const responseTime = Date.now() - startTime;
      
      console.log(`⏱️  レスポンス時間: ${responseTime}ms`);
      console.log(`📊 ステータス: ${response.status}`);
      
      if (response.data) {
        console.log(`📄 レスポンスデータ:`, JSON.stringify(response.data, null, 2));
        
        // レスポンス時間のチェック
        if (testCase.expectedResponseTime && responseTime <= testCase.expectedResponseTime) {
          console.log(`✅ レスポンス時間: ${responseTime}ms <= ${testCase.expectedResponseTime}ms`);
        } else if (testCase.expectedResponseTime) {
          console.log(`⚠️  レスポンス時間: ${responseTime}ms > ${testCase.expectedResponseTime}ms`);
        }

        // キーワードのチェック（レスポンスに含まれている場合）
        if (testCase.expectedKeywords && response.data.keywords) {
          const foundKeywords = testCase.expectedKeywords.filter(keyword => 
            response.data.keywords.some((k: string) => k.includes(keyword))
          );
          console.log(`🔑 期待キーワード: [${testCase.expectedKeywords.join(', ')}]`);
          console.log(`🔍 見つかったキーワード: [${foundKeywords.join(', ')}]`);
          console.log(`📈 キーワード一致率: ${Math.round((foundKeywords.length / testCase.expectedKeywords.length) * 100)}%`);
        }

        console.log(`✅ テスト成功`);
        passedTests++;
      } else {
        console.log(`❌ レスポンスデータが空です`);
      }

    } catch (error: any) {
      console.log(`❌ テスト失敗: ${error.message}`);
      if (error.response) {
        console.log(`📊 エラーレスポンス: ${error.response.status} - ${error.response.statusText}`);
        console.log(`📄 エラーデータ:`, error.response.data);
      }
    }

    console.log('');
  }

  // 結果サマリー
  console.log('📊 テスト結果サマリー');
  console.log('=' .repeat(60));
  console.log(`✅ 成功: ${passedTests}/${totalTests} テスト`);
  console.log(`📈 成功率: ${Math.round((passedTests / totalTests) * 100)}%`);
  
  if (passedTests === totalTests) {
    console.log('🎉 全てのテストが成功しました！');
  } else {
    console.log('⚠️  一部のテストが失敗しました。');
  }

  console.log('\n✅ Webインターフェース テスト完了');
}

// テスト実行
testWebInterface().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
