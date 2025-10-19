const admin = require('firebase-admin');
const fs = require('fs');

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  try {
    // 本番環境では環境変数から認証情報を取得
    if (process.env.NODE_ENV === 'production') {
      // Cloud RunやApp Engineでは自動的に認証情報が提供される
      admin.initializeApp();
    } else {
      // 開発環境ではローカルキーファイルを使用
      const serviceAccount = require('./keys/firebase-adminsdk-key.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error('[ArchiveScript] Firebase Admin SDK初期化エラー:', error);
    // 本番環境での認証情報取得に失敗した場合は、デフォルト認証を試行
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function checkFirestoreData() {
  console.log('🔍 Firestoreデータベースの確認を開始...\n');

  try {
    // 1. usersコレクションの確認
    console.log('📊 usersコレクションの確認:');
    const usersSnapshot = await db.collection('users').get();
    console.log(`  - 総ユーザー数: ${usersSnapshot.size}`);
    
    if (usersSnapshot.size > 0) {
      console.log('  - ユーザー一覧:');
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(`    * ID: ${doc.id}`);
        console.log(`      Email: ${data.email || 'N/A'}`);
        console.log(`      Display Name: ${data.displayName || 'N/A'}`);
        console.log(`      isAdmin: ${data.isAdmin || false}`);
        console.log(`      Created: ${data.createdAt?.toDate?.() || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('  - ユーザーデータが見つかりません');
    }

    // 2. postLogsコレクションの確認
    console.log('📝 postLogsコレクションの確認:');
    const postLogsSnapshot = await db.collection('postLogs').get();
    console.log(`  - 総投稿ログ数: ${postLogsSnapshot.size}`);
    
    if (postLogsSnapshot.size > 0) {
      console.log('  - 最新の投稿ログ（上位5件）:');
      const sortedLogs = postLogsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate())
        .slice(0, 5);
      
      sortedLogs.forEach((log, index) => {
        console.log(`    ${index + 1}. ID: ${log.id}`);
        console.log(`       User ID: ${log.userId}`);
        console.log(`       Question: ${log.question?.substring(0, 50)}...`);
        console.log(`       Timestamp: ${log.timestamp.toDate()}`);
        console.log(`       Search Time: ${log.searchTime}ms`);
        console.log(`       AI Generation Time: ${log.aiGenerationTime}ms`);
        console.log(`       Total Time: ${log.totalTime}ms`);
        console.log('');
      });
    } else {
      console.log('  - 投稿ログデータが見つかりません');
    }

    // 3. errorLogsコレクションの確認
    console.log('🚨 errorLogsコレクションの確認:');
    const errorLogsSnapshot = await db.collection('errorLogs').get();
    console.log(`  - 総エラーログ数: ${errorLogsSnapshot.size}`);
    
    if (errorLogsSnapshot.size > 0) {
      console.log('  - 最新のエラーログ（上位3件）:');
      const sortedErrors = errorLogsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.timestamp.toDate() - a.timestamp.toDate())
        .slice(0, 3);
      
      sortedErrors.forEach((error, index) => {
        console.log(`    ${index + 1}. ID: ${error.id}`);
        console.log(`       Type: ${error.errorType}`);
        console.log(`       Severity: ${error.severity}`);
        console.log(`       Message: ${error.message?.substring(0, 50)}...`);
        console.log(`       Timestamp: ${error.timestamp.toDate()}`);
        console.log(`       Resolved: ${error.resolved}`);
        console.log('');
      });
    } else {
      console.log('  - エラーログデータが見つかりません');
    }

    // 4. systemMetricsコレクションの確認
    console.log('📈 systemMetricsコレクションの確認:');
    const systemMetricsSnapshot = await db.collection('systemMetrics').get();
    console.log(`  - 総システムメトリクス数: ${systemMetricsSnapshot.size}`);

    // 5. systemAlertsコレクションの確認
    console.log('⚠️ systemAlertsコレクションの確認:');
    const systemAlertsSnapshot = await db.collection('systemAlerts').get();
    console.log(`  - 総システムアラート数: ${systemAlertsSnapshot.size}`);

    // 6. satisfactionRatingsコレクションの確認
    console.log('⭐ satisfactionRatingsコレクションの確認:');
    const satisfactionRatingsSnapshot = await db.collection('satisfactionRatings').get();
    console.log(`  - 総満足度評価数: ${satisfactionRatingsSnapshot.size}`);

    console.log('✅ Firestoreデータベースの確認が完了しました');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
}

// スクリプト実行
checkFirestoreData().then(() => {
  console.log('\n🏁 スクリプト実行完了');
  process.exit(0);
}).catch((error) => {
  console.error('❌ スクリプト実行エラー:', error);
  process.exit(1);
});
