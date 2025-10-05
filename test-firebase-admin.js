// Firebase Admin SDK認証テスト
const admin = require('firebase-admin');

async function testFirebaseAdminAuth() {
  try {
    console.log('🔧 Firebase Admin SDK認証テスト開始...');
    
    // 環境変数確認
    console.log('📋 環境変数確認:');
    console.log('GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    
    // サービスアカウントキーを直接読み込み
    const serviceAccount = require('./keys/firebase-adminsdk-key-new.json');
    console.log('📋 サービスアカウント情報:');
    console.log('- プロジェクトID:', serviceAccount.project_id);
    console.log('- クライアントメール:', serviceAccount.client_email);
    
    // Firebase Admin SDK初期化
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log('✅ Firebase Admin SDK初期化成功');
    }
    
    // Firestore接続テスト
    const db = admin.firestore();
    console.log('✅ Firestore接続成功');
    
    // テスト書き込み
    console.log('🧪 テスト書き込み開始...');
    const testDoc = await db.collection('testCollection').add({
      test: true,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      message: 'Firebase Admin SDK認証テスト'
    });
    
    console.log('✅ テスト書き込み成功:', testDoc.id);
    
    // テスト読み込み
    console.log('🧪 テスト読み込み開始...');
    const doc = await testDoc.get();
    console.log('✅ テスト読み込み成功:', doc.data());
    
    // テストドキュメント削除
    await testDoc.delete();
    console.log('✅ テストドキュメント削除成功');
    
    // postLogsコレクションへの書き込みテスト
    console.log('🧪 postLogsコレクション書き込みテスト...');
    const postLogDoc = await db.collection('postLogs').add({
      userId: 'test-user-cli',
      question: 'CLI認証テスト',
      answer: 'Firebase Admin SDK認証テスト成功',
      searchTime: 1000,
      aiGenerationTime: 2000,
      totalTime: 3000,
      referencesCount: 0,
      answerLength: 50,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processingSteps: [{
        step: 'test',
        status: 'completed',
        duration: 1000,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      }],
      metadata: {
        sessionId: 'test-session-cli',
        userAgent: 'CLI-Test',
        ipAddress: '127.0.0.1'
      }
    });
    
    console.log('✅ postLogs書き込み成功:', postLogDoc.id);
    
    // postLogsドキュメント削除
    await postLogDoc.delete();
    console.log('✅ postLogsドキュメント削除成功');
    
    console.log('🎉 Firebase Admin SDK認証テスト完了！');
    
  } catch (error) {
    console.error('❌ Firebase Admin SDK認証テスト失敗:', error);
    console.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
  }
}

testFirebaseAdminAuth();
