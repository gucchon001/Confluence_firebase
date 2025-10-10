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

async function testPostLogIntegration() {
  try {
    console.log('🧪 投稿ログ統合テストを開始します...');
    
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // 現在の時刻でテストログを作成（postLogServiceと同じデータ構造）
    const now = new Date();
    const testLogData = {
      userId: 'integration-test-user-' + Date.now(),
      question: '統合テスト: 投稿ログの保存・取得が正常に動作するか確認',
      answer: '統合テスト回答: postLogServiceとstreaming-process APIの統合が正常に動作していることを確認します。',
      searchTime: 1800,
      aiGenerationTime: 3500,
      totalTime: 5300,
      referencesCount: 6,
      references: [
        { title: 'テスト参照1', url: 'https://example.com/1', score: 0.95, source: 'vector' },
        { title: 'テスト参照2', url: 'https://example.com/2', score: 0.87, source: 'vector' }
      ],
      answerLength: 120,
      qualityScore: 0.85, // 統合後のqualityScoreフィールド
      timestamp: Timestamp.fromDate(now),
      processingSteps: [
        {
          step: 'search',
          duration: 1800,
          status: 'completed',
          timestamp: Timestamp.fromDate(now),
          details: { query: '統合テスト', results: 6 }
        },
        {
          step: 'ai_generation',
          duration: 3500,
          status: 'completed',
          timestamp: Timestamp.fromDate(now),
          details: { model: 'test-model', tokens: 120 }
        }
      ],
      errors: [], // 統合後のerrorsフィールド（常に配列）
      metadata: {
        testRun: true,
        environment: 'integration-test',
        version: 'unified-1.0.0',
        integrationTest: true
      }
    };
    
    console.log('📝 統合テストログデータを作成中...', {
      userId: testLogData.userId,
      timestamp: testLogData.timestamp.toDate(),
      hasQualityScore: 'qualityScore' in testLogData,
      hasErrorsArray: Array.isArray(testLogData.errors),
      referencesCount: testLogData.references.length
    });
    
    // postLogsコレクションに追加（postLogServiceと同じ処理）
    const postLogsRef = collection(db, 'postLogs');
    const docRef = await addDoc(postLogsRef, testLogData);
    
    console.log('✅ 統合テストログが正常に保存されました:', docRef.id);
    
    // 保存直後に最新のログを取得して確認
    console.log('🔍 保存直後の最新ログを確認中...');
    
    const q = query(postLogsRef, orderBy('timestamp', 'desc'), limit(5));
    const snapshot = await getDocs(q);
    
    console.log(`📊 最新の投稿ログ (${snapshot.docs.length}件):`);
    snapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`   ${index + 1}. ${data.timestamp.toDate()} - ${data.userId} - ${data.question?.substring(0, 30)}...`);
      console.log(`      品質スコア: ${data.qualityScore || 'N/A'}, エラー数: ${data.errors?.length || 0}`);
    });
    
    // 作成したテストログが含まれているか確認
    const testLogExists = snapshot.docs.some(doc => doc.id === docRef.id);
    console.log(`🧪 統合テストログの存在確認: ${testLogExists ? '✅ 存在' : '❌ 不存在'}`);
    
    // データ構造の整合性を確認
    if (testLogExists) {
      const savedDoc = snapshot.docs.find(doc => doc.id === docRef.id);
      const savedData = savedDoc.data();
      
      console.log('🔍 保存されたデータ構造の確認:');
      console.log(`   qualityScore: ${savedData.qualityScore} (期待値: 0.85)`);
      console.log(`   errors配列: ${Array.isArray(savedData.errors)} (期待値: true)`);
      console.log(`   references配列: ${Array.isArray(savedData.references)} (期待値: true)`);
      console.log(`   processingSteps配列: ${Array.isArray(savedData.processingSteps)} (期待値: true)`);
      console.log(`   metadata: ${typeof savedData.metadata} (期待値: object)`);
      
      // 統合後のデータ構造が正しいか確認
      const structureValid = 
        typeof savedData.qualityScore === 'number' &&
        Array.isArray(savedData.errors) &&
        Array.isArray(savedData.references) &&
        Array.isArray(savedData.processingSteps) &&
        typeof savedData.metadata === 'object';
        
      console.log(`🎯 データ構造の整合性: ${structureValid ? '✅ 正常' : '❌ 異常'}`);
    }
    
  } catch (error) {
    console.error('❌ 統合テストエラー:', error);
    
    if (error.code === 'permission-denied') {
      console.log('🔐 権限エラー: Firestoreのセキュリティルールを確認してください');
      console.log('   現在のルールでは、認証済みユーザーのみpostLogsコレクションにアクセス可能です');
    } else if (error.code === 'unavailable') {
      console.log('🌐 ネットワークエラー: Firebase接続を確認してください');
    } else {
      console.log('🔧 その他のエラー:', error.message);
    }
  }
}

testPostLogIntegration();


