/**
 * APIエンドポイントの投稿ログ保存テスト
 * streaming-process/route.tsのAPIエンドポイントを直接テスト
 */

const fetch = require('node-fetch');

async function testAPIEndpoint() {
  try {
    console.log('🧪 APIエンドポイント投稿ログ保存テスト開始');
    
    // テストデータの準備
    const testData = {
      question: 'テスト質問: APIエンドポイント経由で投稿ログは正しく保存されますか？',
      userId: 'test-user-api-123'
    };
    
    console.log('📝 テストデータ準備完了:', {
      question: testData.question.substring(0, 50) + '...',
      userId: testData.userId
    });
    
    // 開発サーバーが起動していることを確認
    const baseUrl = 'http://localhost:3000';
    const endpoint = '/api/streaming-process';
    
    console.log('🚀 APIエンドポイントテスト実行中...');
    console.log('📍 エンドポイント:', baseUrl + endpoint);
    
    // APIリクエストの送信
    const response = await fetch(baseUrl + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });
    
    console.log('📊 レスポンス状況:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ APIエラー:', errorText);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    // ストリーミングレスポンスの処理
    console.log('📡 ストリーミングレスポンス受信中...');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let postLogId = null;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        console.log('✅ ストリーミング完了');
        break;
      }
      
      const chunk = decoder.decode(value);
      fullResponse += chunk;
      
      // 投稿ログIDの抽出を試行
      const logIdMatch = chunk.match(/投稿ログを保存しました: ([a-zA-Z0-9]+)/);
      if (logIdMatch) {
        postLogId = logIdMatch[1];
        console.log('📝 投稿ログID検出:', postLogId);
      }
      
      // エラーの検出
      if (chunk.includes('❌') && chunk.includes('エラー')) {
        console.error('❌ ストリーミング中にエラー検出:', chunk);
      }
    }
    
    console.log('✅ APIテスト完了！');
    console.log('📊 結果:', {
      postLogId: postLogId,
      responseLength: fullResponse.length,
      hasError: fullResponse.includes('❌')
    });
    
    // レスポンスの一部を表示
    console.log('📄 レスポンスサンプル:', fullResponse.substring(0, 500) + '...');
    
    return postLogId;
    
  } catch (error) {
    console.error('❌ APIテスト失敗:', error);
    console.error('❌ エラー詳細:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    
    // 開発サーバーが起動していない可能性
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 開発サーバーが起動していない可能性があります');
      console.log('💡 npm run dev でサーバーを起動してから再実行してください');
    }
    
    throw error;
  }
}

// テスト実行
if (require.main === module) {
  testAPIEndpoint()
    .then((postLogId) => {
      console.log('🎉 APIエンドポイントテスト完了！投稿ログID:', postLogId);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 APIエンドポイントテスト失敗:', error);
      process.exit(1);
    });
}

module.exports = { testAPIEndpoint };
