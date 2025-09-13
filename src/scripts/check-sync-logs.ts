import 'dotenv/config';
import * as admin from 'firebase-admin';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

async function checkSyncLogs() {
  try {
    console.log('Checking Confluence sync logs from Firestore...');
    
    // syncLogsコレクションから最新の10件のログを取得
    const syncLogsRef = admin.firestore().collection('syncLogs');
    const snapshot = await syncLogsRef
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    if (snapshot.empty) {
      console.log('No sync logs found in Firestore.');
      return;
    }
    
    console.log(`Found ${snapshot.size} sync logs. Showing latest logs:\n`);
    
    // ログを表示
    snapshot.docs.forEach((doc, index) => {
      const log = doc.data();
      const timestamp = log.timestamp?.toDate() || 'Unknown date';
      
      console.log(`--- Log ${index + 1} ---`);
      console.log(`ID: ${doc.id}`);
      console.log(`Timestamp: ${timestamp}`);
      console.log(`Operation: ${log.operation}`);
      console.log(`Status: ${log.status}`);
      
      if (log.details) {
        console.log('Details:');
        if (log.details.pagesProcessed) console.log(`- Pages processed: ${log.details.pagesProcessed}`);
        if (log.details.recordsProcessed) console.log(`- Records processed: ${log.details.recordsProcessed}`);
        if (log.details.chunksCreated) console.log(`- Chunks created: ${log.details.chunksCreated}`);
        if (log.details.embeddingsGenerated) console.log(`- Embeddings generated: ${log.details.embeddingsGenerated}`);
        if (log.details.filename) console.log(`- Filename: ${log.details.filename}`);
        if (log.details.gcsPath) console.log(`- GCS path: ${log.details.gcsPath}`);
        if (log.details.message) console.log(`- Message: ${log.details.message}`);
      }
      
      console.log('\n');
    });
    
    // chunksコレクションのドキュメント数を確認
    const chunksRef = admin.firestore().collection('chunks');
    const chunksSnapshot = await chunksRef.count().get();
    
    console.log(`Total documents in 'chunks' collection: ${chunksSnapshot.data().count}`);
    
    console.log('\nSync logs check completed.');
    
  } catch (error: any) {
    console.error('Error checking sync logs:', error);
  }
}

checkSyncLogs();
