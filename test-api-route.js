// API ルートの直接テスト
const testAPI = async () => {
  try {
    console.log('🧪 API ルートのテスト開始...');
    
    const response = await fetch('http://localhost:9003/api/streaming-process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': 'test-user-123',
        'x-session-id': 'test-session-456',
        'user-agent': 'Test-Client/1.0',
        'x-forwarded-for': '127.0.0.1'
      },
      body: JSON.stringify({
        question: 'テスト質問: ログイン機能について教えて',
        chatHistory: [],
        labelFilters: { includeMeetingNotes: false }
      })
    });

    console.log('📡 レスポンスステータス:', response.status);
    console.log('📡 レスポンスヘッダー:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ エラーレスポンス:', errorText);
      return;
    }

    console.log('✅ ストリーミングレスポンス受信開始...');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunkCount = 0;
    let fullResponse = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('🏁 ストリーミング完了');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              chunkCount++;
              
              if (data.type === 'chunk') {
                console.log(`📦 チャンク ${chunkCount}: ${data.chunk.substring(0, 50)}...`);
                fullResponse += data.chunk;
              } else if (data.type === 'completion') {
                console.log('✅ 完了メッセージ受信');
                console.log('📊 最終統計:', {
                  totalChunks: chunkCount,
                  responseLength: fullResponse.length,
                  references: data.references?.length || 0
                });
              }
            } catch (e) {
              // JSON解析エラーは無視（通常のストリーミングデータ）
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('🎉 テスト完了！');
    console.log('📝 受信した回答の長さ:', fullResponse.length);
    
  } catch (error) {
    console.error('❌ テストエラー:', error);
  }
};

// Node.js環境での実行
if (typeof window === 'undefined') {
  // Node.js環境
  const fetch = require('node-fetch');
  testAPI();
} else {
  // ブラウザ環境
  testAPI();
}
