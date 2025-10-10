const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp, getDocs, orderBy, query, limit } = require('firebase/firestore');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyA6ZvZQZQZQZQZQZQZQZQZQZQZQZQZQZQ",
  authDomain: "confluence-copilot-ppjye.firebaseapp.com",
  projectId: "confluence-copilot-ppjye",
  storageBucket: "confluence-copilot-ppjye.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

async function testLatestPostLog() {
  try {
    console.log('🧪 最新の投稿ログテストを開始します...');
    
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // 現在の時刻でテストログを作成
    const now = new Date();
    const testLogData = {
      userId: 'test-user-' + Date.now(),
      question: 'テスト質問: 最新の投稿ログテスト',
      answer: 'テスト回答: 投稿ログが正しく保存されているかを確認するテストです。',
      searchTime: 1500,
      aiGenerationTime: 3000,
      totalTime: 4500,
      referencesCount: 5,
      answerLength: 100,
      timestamp: Timestamp.fromDate(now),
      processingSteps: [
        {
          step: 'search',
          duration: 1500,
          status: 'completed',
          timestamp: Timestamp.fromDate(now),
          details: { query: 'テスト質問', results: 5 }
        },
        {
          step: 'ai_generation',
          duration: 3000,
          status: 'completed',
          timestamp: Timestamp.fromDate(now),
          details: { model: 'test-model', tokens: 100 }
        }
      ],
      metadata: {
        testRun: true,
        environment: 'local',
        version: '1.0.0'
      }
    };
    
    console.log('📝 テストログデータを作成中...', {
      userId: testLogData.userId,
      timestamp: testLogData.timestamp.toDate()
    });
    
    // postLogsコレクションに追加
    const postLogsRef = collection(db, 'postLogs');
    const docRef = await addDoc(postLogsRef, testLogData);
    
    console.log('✅ テストログが正常に保存されました:', docRef.id);
    
    // 保存直後に最新のログを取得して確認
    console.log('🔍 保存直後の最新ログを確認中...');
    
    const q = query(postLogsRef, orderBy('timestamp', 'desc'), limit(5));
    const snapshot = await getDocs(q);
    
    console.log(`📊 最新の投稿ログ (${snapshot.docs.length}件):`);
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   ${index + 1}. ${data.timestamp.toDate()} - ${data.userId} - ${data.question?.substring(0, 30)}...`);
    });
    
    // 作成したテストログが含まれているか確認
    const testLogExists = snapshot.docs.some(doc => doc.id === docRef.id);
    console.log(`🧪 テストログの存在確認: ${testLogExists ? '✅ 存在' : '❌ 不存在'}`);
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    
    if (error.code === 'permission-denied') {
      console.log('🔐 権限エラー: Firestoreのセキュリティルールを確認してください');
    } else if (error.code === 'unavailable') {
      console.log('🌐 ネットワークエラー: Firebase接続を確認してください');
    }
  }
}

testLatestPostLog();
