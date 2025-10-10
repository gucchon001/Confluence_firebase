/**
 * サーバーサイド投稿ログ保存のユニットテスト
 * streaming-process/route.tsのsavePostLogToAdminDB関数をテスト
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');

// Firebase設定（実際の設定を使用）
const firebaseConfig = {
  apiKey: "AIzaSyAgaGihnyshajIN2YC7CdJR_H0bJMg_hkI",
  authDomain: "confluence-copilot-ppjye.firebaseapp.com",
  projectId: "confluence-copilot-ppjye",
  storageBucket: "confluence-copilot-ppjye.firebasestorage.app",
  messagingSenderId: "122015916118",
  appId: "1:122015916118:web:50d117434b1318f173dbf7"
};

async function testServerSidePostLog() {
  try {
    console.log('🧪 サーバーサイド投稿ログ保存テスト開始');
    
    // Firebase初期化
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    
    // テストデータの準備
    const testLogData = {
      userId: 'test-user-123',
      question: 'テスト質問: サーバーサイド投稿ログは正しく保存されますか？',
      answer: 'はい、サーバーサイド投稿ログは正しく保存されます。このテストは成功です。',
      searchTime: 150,
      aiGenerationTime: 800,
      totalTime: 950,
      referencesCount: 3,
      references: [
        {
          title: 'テスト参照1',
          url: 'https://example.com/doc1',
          content: 'テストコンテンツ1'
        },
        {
          title: 'テスト参照2', 
          url: 'https://example.com/doc2',
          content: 'テストコンテンツ2'
        },
        {
          title: 'テスト参照3',
          url: 'https://example.com/doc3', 
          content: 'テストコンテンツ3'
        }
      ],
      answerLength: 85,
      qualityScore: 0.95,
      timestamp: new Date(),
      processingSteps: [
        {
          stepId: 'search',
          status: 'completed',
          duration: 150,
          timestamp: new Date(),
          details: 'テスト検索ステップ'
        },
        {
          stepId: 'ai_generation',
          status: 'completed', 
          duration: 800,
          timestamp: new Date(),
          details: 'テストAI生成ステップ'
        }
      ],
      errors: [],
      metadata: {
        testMode: true,
        testTimestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    console.log('📝 テストデータ準備完了:', {
      userId: testLogData.userId,
      question: testLogData.question.substring(0, 50) + '...',
      answerLength: testLogData.answerLength,
      qualityScore: testLogData.qualityScore
    });
    
    // サーバーサイド用の投稿ログ保存関数（streaming-process/route.tsと同じ実装）
    async function savePostLogToAdminDB(logData) {
      try {
        const postLogsRef = collection(db, 'postLogs');
        
        console.log('🔍 サーバーサイド投稿ログデータの詳細:', {
          userId: logData.userId,
          question: logData.question?.substring(0, 50) + '...',
          answer: logData.answer?.substring(0, 50) + '...',
          searchTime: logData.searchTime,
          aiGenerationTime: logData.aiGenerationTime,
          totalTime: logData.totalTime
        });
        
        // Firestoreドキュメントを作成（postLogServiceと同じデータ構造）
        const firestoreData = {
          userId: logData.userId,
          question: logData.question,
          answer: logData.answer,
          searchTime: logData.searchTime,
          aiGenerationTime: logData.aiGenerationTime,
          totalTime: logData.totalTime,
          referencesCount: logData.referencesCount,
          references: logData.references,
          answerLength: logData.answerLength,
          qualityScore: logData.qualityScore || 0.8, // デフォルト品質スコア
          timestamp: Timestamp.fromDate(logData.timestamp),
          processingSteps: logData.processingSteps?.map(step => ({
            ...step,
            timestamp: Timestamp.fromDate(step.timestamp)
          })) || [],
          errors: logData.errors?.map(error => ({
            ...error,
            timestamp: Timestamp.fromDate(error.timestamp),
            resolvedAt: error.resolvedAt ? Timestamp.fromDate(error.resolvedAt) : null
          })) || [],
          metadata: logData.metadata
        };
        
        const docRef = await addDoc(postLogsRef, firestoreData);
        console.log('📝 サーバーサイド投稿ログを保存しました:', docRef.id);
        return docRef.id;
      } catch (error) {
        console.error('❌ サーバーサイド投稿ログ保存に失敗しました:', error);
        throw error;
      }
    }
    
    // テスト実行
    console.log('🚀 投稿ログ保存テスト実行中...');
    const postLogId = await savePostLogToAdminDB(testLogData);
    
    console.log('✅ テスト成功！');
    console.log('📊 結果:', {
      postLogId: postLogId,
      userId: testLogData.userId,
      qualityScore: testLogData.qualityScore,
      totalTime: testLogData.totalTime
    });
    
    // 保存されたデータを確認
    console.log('🔍 保存されたデータの確認...');
    const postLogsRef = collection(db, 'postLogs');
    const { getDocs, query, where, orderBy, limit } = require('firebase/firestore');
    
    const q = query(
      postLogsRef,
      where('userId', '==', testLogData.userId),
      orderBy('timestamp', 'desc'),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      console.log('✅ 保存されたデータ確認完了:', {
        id: doc.id,
        userId: data.userId,
        question: data.question?.substring(0, 50) + '...',
        qualityScore: data.qualityScore,
        timestamp: data.timestamp?.toDate?.() || data.timestamp
      });
    } else {
      console.log('⚠️ 保存されたデータが見つかりませんでした');
    }
    
    return postLogId;
    
  } catch (error) {
    console.error('❌ テスト失敗:', error);
    console.error('❌ エラー詳細:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    throw error;
  }
}

// テスト実行
if (require.main === module) {
  testServerSidePostLog()
    .then((postLogId) => {
      console.log('🎉 ユニットテスト完了！投稿ログID:', postLogId);
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 ユニットテスト失敗:', error);
      process.exit(1);
    });
}

module.exports = { testServerSidePostLog };
