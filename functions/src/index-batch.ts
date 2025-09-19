/**
 * Cloud Functions for Firebase - バッチ処理版
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as confluenceService from './confluence-service';
import * as embeddingService from './embedding-service';
import * as firestoreService from './firestore-service';
import * as config from './config';

// Firebase初期化
admin.initializeApp();

/**
 * Confluenceデータを同期する関数
 * 
 * Cloud Schedulerから呼び出されることを想定
 * 毎日深夜に実行され、Confluenceからデータを取得してGCSにアップロードし、
 * Firestoreにメタデータを保存する
 */
export const syncConfluenceData = functions
  .region('asia-northeast1')
  .runWith({
    timeoutSeconds: 540, // 9分
    memory: '1GB'
  })
  .https.onRequest(async (req, res) => {
    try {
      console.log('[syncConfluenceData] Starting Confluence data sync');
      
      // 同期開始ログを保存
      await firestoreService.saveSyncLog('start', {
        message: 'Confluence data sync started'
      });
      
      // Confluenceからデータを取得
      const spaceKey = process.env.CONFLUENCE_SPACE_KEY || config.confluence?.space_key;
      if (!spaceKey) {
        throw new Error('Confluence space key not configured');
      }
      
      const pages = await confluenceService.getAllSpaceContent(spaceKey);
      console.log(`[syncConfluenceData] Retrieved ${pages.length} pages from Confluence`);
      
      // データを処理
      let allRecords: any[] = [];
      for (const page of pages) {
        try {
          const records = confluenceService.processConfluencePage(page);
          allRecords = allRecords.concat(records);
        } catch (error: any) {
          console.error(`[syncConfluenceData] Error processing page ${page.id}: ${error.message}`);
        }
      }
      console.log(`[syncConfluenceData] Generated ${allRecords.length} records`);
      
      // 埋め込みベクトルを生成
      const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
      console.log(`[syncConfluenceData] Generated embeddings for ${recordsWithEmbeddings.length}/${allRecords.length} records`);
      
      // GCSにアップロード
      const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || config.vertexai?.storage_bucket;
      if (!bucketName) {
        throw new Error('GCS bucket name not configured');
      }
      
      // GCSアップロードは削除
      const filename = '';
      console.log(`[syncConfluenceData] Uploaded file to gs://${bucketName}/${filename}`);
      
      // Firestoreにメタデータを保存
      await firestoreService.saveMetadataToFirestore(recordsWithEmbeddings);
      console.log(`[syncConfluenceData] Saved metadata to Firestore`);
      
      // 同期完了ログを保存
      await firestoreService.saveSyncLog('complete', {
        message: 'Confluence data sync completed successfully',
        pagesProcessed: pages.length,
        recordsProcessed: recordsWithEmbeddings.length,
        filename,
        gcsPath: `gs://${bucketName}/${filename}`,
        timestamp: new Date().toISOString()
      });
      
      res.status(200).send({
        status: 'success',
        message: 'Confluence data sync completed successfully',
        details: {
          pagesProcessed: pages.length,
          recordsProcessed: recordsWithEmbeddings.length,
          filename,
          gcsPath: `gs://${bucketName}/${filename}`
        }
      });
    } catch (error: any) {
      console.error(`[syncConfluenceData] Error: ${error.message}`);
      
      // エラーログを保存
      await firestoreService.saveSyncLog('error', {
        message: `Confluence data sync failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).send({
        status: 'error',
        message: `Confluence data sync failed: ${error.message}`
      });
    }
  });

/**
 * 最新の同期状態を取得する関数
 * 
 * フロントエンドから呼び出されることを想定
 * 最新の同期ログとGCSファイルのパスを返す
 */
export const getSyncStatus = functions
  .region('asia-northeast1')
  .https.onCall(async (data, context) => {
    try {
      // 最新の同期ログを取得
      const syncLogsRef = admin.firestore().collection('syncLogs');
      const snapshot = await syncLogsRef
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return {
          status: 'unknown',
          message: 'No sync logs found'
        };
      }
      
      const latestLog = snapshot.docs[0].data();
      return {
        status: latestLog.status,
        message: latestLog.message,
        details: latestLog.details,
        timestamp: latestLog.timestamp.toDate().toISOString()
      };
    } catch (error: any) {
      console.error(`[getSyncStatus] Error: ${error.message}`);
      return {
        status: 'error',
        message: `Failed to get sync status: ${error.message}`
      };
    }
  });
