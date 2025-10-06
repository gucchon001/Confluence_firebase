const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, orderBy, query, limit } = require('firebase/firestore');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyA6ZvZQZQZQZQZQZQZQZQZQZQZQZQZQZQ",
  authDomain: "confluence-copilot-ppjye.firebaseapp.com",
  projectId: "confluence-copilot-ppjye",
  storageBucket: "confluence-copilot-ppjye.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

async function debugPostLogFlow() {
  try {
    console.log('🔍 投稿ログフローのデバッグを開始します...');
    
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    console.log('📊 現在のFirestoreの状況を確認中...');
    
    // 現在のpostLogsコレクションの状況を確認
    const postLogsRef = collection(db, 'postLogs');
    const q = query(postLogsRef, orderBy('timestamp', 'desc'), limit(10));
    
    try {
      const snapshot = await getDocs(q);
      console.log(`📝 現在のpostLogsコレクション: ${snapshot.docs.length}件`);
      
      if (snapshot.docs.length > 0) {
        console.log('\n📋 最新の投稿ログ:');
        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          const timestamp = data.timestamp?.toDate?.() || data.timestamp;
          console.log(`   ${index + 1}. ${timestamp} - ${data.userId}`);
          console.log(`      質問: ${data.question?.substring(0, 50)}...`);
          console.log(`      品質スコア: ${data.qualityScore || 'N/A'}`);
          console.log(`      エラー数: ${data.errors?.length || 0}`);
          console.log(`      参照数: ${data.referencesCount || 0}`);
        });
        
        // 最新の投稿の詳細を確認
        const latestDoc = snapshot.docs[0];
        const latestData = latestDoc.data();
        console.log('\n🔍 最新投稿の詳細構造:');
        console.log(`   ID: ${latestDoc.id}`);
        console.log(`   userId: ${latestData.userId}`);
        console.log(`   question: ${latestData.question?.substring(0, 100)}...`);
        console.log(`   answer: ${latestData.answer?.substring(0, 100)}...`);
        console.log(`   searchTime: ${latestData.searchTime}ms`);
        console.log(`   aiGenerationTime: ${latestData.aiGenerationTime}ms`);
        console.log(`   totalTime: ${latestData.totalTime}ms`);
        console.log(`   qualityScore: ${latestData.qualityScore}`);
        console.log(`   referencesCount: ${latestData.referencesCount}`);
        console.log(`   answerLength: ${latestData.answerLength}`);
        console.log(`   processingSteps: ${Array.isArray(latestData.processingSteps) ? latestData.processingSteps.length : 'N/A'}件`);
        console.log(`   errors: ${Array.isArray(latestData.errors) ? latestData.errors.length : 'N/A'}件`);
        console.log(`   metadata: ${typeof latestData.metadata}`);
        
        // データ構造の整合性チェック
        const hasRequiredFields = 
          latestData.userId &&
          latestData.question &&
          latestData.answer &&
          typeof latestData.searchTime === 'number' &&
          typeof latestData.aiGenerationTime === 'number' &&
          typeof latestData.totalTime === 'number' &&
          latestData.timestamp;
          
        console.log(`\n🎯 必須フィールドの整合性: ${hasRequiredFields ? '✅ 正常' : '❌ 異常'}`);
        
        // 統合後のフィールドチェック
        const hasUnifiedFields = 
          typeof latestData.qualityScore === 'number' &&
          Array.isArray(latestData.errors) &&
          Array.isArray(latestData.processingSteps);
          
        console.log(`🎯 統合フィールドの整合性: ${hasUnifiedFields ? '✅ 正常' : '❌ 異常'}`);
        
      } else {
        console.log('❌ postLogsコレクションにデータがありません');
        console.log('   これは以下のいずれかの理由が考えられます:');
        console.log('   1. まだ投稿が行われていない');
        console.log('   2. 投稿処理でエラーが発生している');
        console.log('   3. 権限の問題でデータが保存されていない');
        console.log('   4. 異なるコレクション名が使用されている');
      }
      
    } catch (error) {
      console.error('❌ postLogsコレクションアクセスエラー:', error);
      
      if (error.code === 'permission-denied') {
        console.log('\n🔐 権限エラーの詳細:');
        console.log('   現在のFirestoreセキュリティルール:');
        console.log('   - 認証済みユーザーのみアクセス可能');
        console.log('   - postLogsコレクションは管理者権限が必要');
        console.log('\n💡 解決方法:');
        console.log('   1. ブラウザで認証してから管理画面にアクセス');
        console.log('   2. 実際の投稿を行ってログを確認');
        console.log('   3. ブラウザの開発者ツールでコンソールログを確認');
      }
    }
    
  } catch (error) {
    console.error('❌ デバッグエラー:', error);
  }
}

debugPostLogFlow();


