/**
 * Confluence同期関数
 */
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as confluenceService from './confluence-service';
import * as embeddingService from './embedding-service';
// removed Vertex AI vector search usage
import * as firestoreService from './firestore-service';
import * as config from './config';

// Firebase初期化（まだ初期化されていない場合）
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Confluenceデータを同期するCloud Function
 */
export const syncConfluenceData = functions.pubsub
  .schedule('0 2 * * *') // 毎日午前2時に実行
  .timeZone('Asia/Tokyo')
  .onRun(async (context) => {
    try {
      // 同期開始ログ
      await firestoreService.saveSyncLog('start', { message: 'Starting Confluence data sync' });
      
      // スペースキーを取得
      const spaceKey = process.env.CONFLUENCE_SPACE_KEY || config.confluence?.space_key;
      
      if (!spaceKey) {
        throw new Error("Confluence space key not configured");
      }
      
      // Confluenceからすべてのコンテンツを取得
      const pages = await confluenceService.getAllSpaceContent(spaceKey);
      
      if (pages.length === 0) {
        console.log('[syncConfluenceData] No pages found in space');
        await firestoreService.saveSyncLog('complete', { message: 'No pages found in space' });
        return null;
      }
      
      // すべてのレコードを格納する配列
      let allRecords: any[] = [];
      
      // 各ページを処理
      for (const page of pages) {
        const records = confluenceService.processConfluencePage(page);
        allRecords = allRecords.concat(records);
      }
      
      // 埋め込みベクトルを生成
      const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
      
      // プロジェクトIDを取得
      const projectId = process.env.VERTEX_AI_PROJECT_ID || config.vertexai?.project_id;
      const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || config.vertexai?.numeric_project_id;
      
      if (!projectId || !numericProjectId) {
        throw new Error("Vertex AI project ID not configured");
      }
      
      // バケット名を決定
      const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || config.vertexai?.storage_bucket || `${numericProjectId}-vector-search`;
      
      // GCS関連は削除
      const filename = '';
      
      // Vertex AI vector search 連携は削除
      
      // Firestoreにメタデータを保存
      await firestoreService.saveMetadataToFirestore(recordsWithEmbeddings);
      
      // 同期完了ログ
      await firestoreService.saveSyncLog('complete', {
        message: 'Confluence data sync completed successfully',
        pagesProcessed: pages.length,
        recordsProcessed: recordsWithEmbeddings.length,
        filename
      });
      
      console.log(`[syncConfluenceData] Sync completed successfully for ${pages.length} pages and ${recordsWithEmbeddings.length} records`);
      return null;
    } catch (error: any) {
      console.error(`[syncConfluenceData] Error syncing Confluence data: ${error.message}`);
      
      // エラーログ
      await firestoreService.saveSyncLog('error', {
        message: `Error syncing Confluence data: ${error.message}`,
        stack: error.stack
      });
      
      throw new Error(`Failed to sync Confluence data: ${error.message}`);
    }
  });

/**
 * 手動でConfluenceデータを同期するHTTPトリガー関数
 */
export const manualSyncConfluenceData = functions.https.onRequest(async (req, res) => {
  try {
    // POSTリクエストのみ許可
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    
    // 同期開始ログ
    await firestoreService.saveSyncLog('start', { message: 'Starting manual Confluence data sync' });
    
    // スペースキーを取得（リクエストボディから、または設定から）
    const spaceKey = req.body.spaceKey || process.env.CONFLUENCE_SPACE_KEY || config.confluence?.space_key;
    
    if (!spaceKey) {
      throw new Error("Confluence space key not provided");
    }
    
    // Confluenceからすべてのコンテンツを取得
    const pages = await confluenceService.getAllSpaceContent(spaceKey);
    
    if (pages.length === 0) {
      console.log('[manualSyncConfluenceData] No pages found in space');
      await firestoreService.saveSyncLog('complete', { message: 'No pages found in space' });
      res.status(200).send({ message: 'No pages found in space' });
      return;
    }
    
    // すべてのレコードを格納する配列
    let allRecords: any[] = [];
    
    // 各ページを処理
    for (const page of pages) {
      const records = confluenceService.processConfluencePage(page);
      allRecords = allRecords.concat(records);
    }
    
    // 埋め込みベクトルを生成
    const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
    
    // プロジェクトIDを取得
    const projectId = process.env.VERTEX_AI_PROJECT_ID || config.vertexai?.project_id;
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || config.vertexai?.numeric_project_id;
    
    if (!projectId || !numericProjectId) {
      throw new Error("Vertex AI project ID not configured");
    }
    
    // バケット名を決定
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || config.vertexai?.storage_bucket || `${numericProjectId}-vector-search`;
    
    // GCS関連は削除
    const filename = '';
    
    // Vertex AI vector search 連携は削除
    
    // Firestoreにメタデータを保存
    await firestoreService.saveMetadataToFirestore(recordsWithEmbeddings);
    
    // 同期完了ログ
    await firestoreService.saveSyncLog('complete', {
      message: 'Manual Confluence data sync completed successfully',
      pagesProcessed: pages.length,
      recordsProcessed: recordsWithEmbeddings.length,
      filename
    });
    
    console.log(`[manualSyncConfluenceData] Sync completed successfully for ${pages.length} pages and ${recordsWithEmbeddings.length} records`);
    
    // 成功レスポンスを返す
    res.status(200).send({
      message: 'Confluence data sync completed successfully',
      pagesProcessed: pages.length,
      recordsProcessed: recordsWithEmbeddings.length,
      filename
    });
  } catch (error: any) {
    console.error(`[manualSyncConfluenceData] Error syncing Confluence data: ${error.message}`);
    
    // エラーログ
    await firestoreService.saveSyncLog('error', {
      message: `Error syncing Confluence data: ${error.message}`,
      stack: error.stack
    });
    
    // エラーレスポンスを返す
    res.status(500).send({
      error: `Failed to sync Confluence data: ${error.message}`
    });
  }
});
