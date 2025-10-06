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

async function checkPostLogsStatus() {
  try {
    console.log('🔍 FirestoreのpostLogsコレクションの状況を確認します...');
    
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // postLogsコレクションの最新10件を取得
    const postLogsRef = collection(db, 'postLogs');
    const q = query(postLogsRef, orderBy('timestamp', 'desc'), limit(10));
    
    const snapshot = await getDocs(q);
    const postLogs = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      postLogs.push({
        id: doc.id,
        timestamp: data.timestamp?.toDate?.() || data.timestamp,
        user: data.user || '不明',
        query: data.query || '不明',
        responseTime: data.responseTime || '不明',
        referenceCount: data.referenceCount || 0,
        status: data.status || '不明'
      });
    });
    
    console.log(`📊 postLogsコレクションの状況:`);
    console.log(`   総件数: ${postLogs.length}件`);
    
    if (postLogs.length > 0) {
      console.log(`   最新の投稿: ${postLogs[0].timestamp} (${postLogs[0].user})`);
      console.log(`   最古の投稿: ${postLogs[postLogs.length - 1].timestamp} (${postLogs[postLogs.length - 1].user})`);
      
      console.log('\n📝 最新の投稿ログ詳細:');
      postLogs.forEach((log, index) => {
        console.log(`   ${index + 1}. ${log.timestamp} - ${log.user} - ${log.query.substring(0, 50)}...`);
      });
    } else {
      console.log('❌ postLogsコレクションにデータがありません');
    }
    
    // 他のコレクションも確認
    console.log('\n🔍 他のコレクションの状況も確認します...');
    
    const collections = ['users', 'errorLogs', 'systemAlerts'];
    
    for (const collectionName of collections) {
      try {
        const collectionRef = collection(db, collectionName);
        const snapshot = await getDocs(collectionRef);
        console.log(`   ${collectionName}: ${snapshot.size}件`);
      } catch (error) {
        console.log(`   ${collectionName}: エラー - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
}

checkPostLogsStatus();
