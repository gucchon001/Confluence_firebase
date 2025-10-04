/**
 * 投稿ログ収集のデバッグスクリプト
 * Firestoreの投稿ログを直接確認する
 */

const admin = require('firebase-admin');

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  const serviceAccount = require('./keys/firebase-adminsdk-key.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || serviceAccount.project_id
  });
}

const db = admin.firestore();

async function debugPostLogs() {
  console.log('🔍 投稿ログのデバッグ開始...');
  
  try {
    // 1. ユーザーコレクションの確認
    console.log('\n📊 ユーザーコレクションの確認:');
    const usersSnapshot = await db.collection('users').limit(5).get();
    console.log(`ユーザー数: ${usersSnapshot.size}`);
    
    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      console.log(`- ユーザーID: ${doc.id}`);
      console.log(`  メール: ${userData.email}`);
      console.log(`  管理者: ${userData.isAdmin || false}`);
      console.log(`  作成日: ${userData.createdAt?.toDate?.() || userData.createdAt}`);
    });

    // 2. 投稿ログコレクションの確認
    console.log('\n📝 投稿ログコレクションの確認:');
    const postLogsSnapshot = await db.collection('postLogs').limit(10).get();
    console.log(`投稿ログ数: ${postLogsSnapshot.size}`);
    
    if (postLogsSnapshot.empty) {
      console.log('❌ 投稿ログが存在しません');
    } else {
      postLogsSnapshot.forEach(doc => {
        const logData = doc.data();
        console.log(`- ログID: ${doc.id}`);
        console.log(`  ユーザーID: ${logData.userId}`);
        console.log(`  質問: ${logData.question?.substring(0, 50)}...`);
        console.log(`  検索時間: ${logData.searchTime}ms`);
        console.log(`  AI生成時間: ${logData.aiGenerationTime}ms`);
        console.log(`  タイムスタンプ: ${logData.timestamp?.toDate?.() || logData.timestamp}`);
      });
    }

    // 3. 管理者権限の確認
    console.log('\n👑 管理者権限の確認:');
    const adminUsers = await db.collection('users').where('isAdmin', '==', true).get();
    console.log(`管理者数: ${adminUsers.size}`);
    
    adminUsers.forEach(doc => {
      const userData = doc.data();
      console.log(`- 管理者: ${userData.email} (${doc.id})`);
    });

    // 4. 最新の投稿ログを時系列で確認
    console.log('\n⏰ 最新の投稿ログ（時系列）:');
    const recentLogs = await db.collection('postLogs')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .get();
    
    if (recentLogs.empty) {
      console.log('❌ 最新の投稿ログがありません');
    } else {
      recentLogs.forEach(doc => {
        const logData = doc.data();
        console.log(`- ${logData.timestamp?.toDate?.()}: ${logData.question?.substring(0, 30)}...`);
        console.log(`  処理時間: ${logData.totalTime}ms (検索: ${logData.searchTime}ms, AI: ${logData.aiGenerationTime}ms)`);
      });
    }

  } catch (error) {
    console.error('❌ デバッグ中にエラーが発生しました:', error);
  }
}

debugPostLogs().then(() => {
  console.log('\n✅ デバッグ完了');
  process.exit(0);
}).catch(error => {
  console.error('❌ デバッグ失敗:', error);
  process.exit(1);
});
