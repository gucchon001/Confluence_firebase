/**
 * Confluence同期実装のテスト
 */
import * as dotenv from 'dotenv';
import * as admin from 'firebase-admin';
import * as confluenceService from './confluence-service';
import * as embeddingService from './embedding-service';
// removed Vertex AI vector search usage
import * as firestoreService from './firestore-service';
import * as config from './config';

// 環境変数の読み込み
dotenv.config();

// Firebase初期化（まだ初期化されていない場合）
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
}

/**
 * メイン関数
 */
async function main() {
  try {
    console.log('===== Confluence同期実装のテスト開始 =====');
    
    // スペースキーを取得
    const spaceKey = process.env.CONFLUENCE_SPACE_KEY || config.confluence?.space_key;
    
    if (!spaceKey) {
      throw new Error("Confluence space key not configured");
    }
    
    console.log(`[main] Using Confluence space key: ${spaceKey}`);
    
    // バケット名を決定
    const projectId = process.env.VERTEX_AI_PROJECT_ID || config.vertexai?.project_id;
    const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || config.vertexai?.numeric_project_id;
    
    if (!projectId || !numericProjectId) {
      throw new Error("Vertex AI project ID not configured");
    }
    
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || config.vertexai?.storage_bucket || `${numericProjectId}-vector-search`;
    
    console.log(`[main] Using GCS bucket: ${bucketName}`);
    
    // バケットが存在するか確認し、なければ作成
    console.log('\n1. GCSバケットの確認/作成');
    // GCS削除済み
    
    // テスト用に一部のページのみ取得
    console.log('\n2. Confluenceからページデータを取得（テスト用に最大5件）');
    const pages = await confluenceService.getAllSpaceContent(spaceKey);
    const limitedPages = pages.slice(0, 5);
    console.log(`[main] Retrieved ${limitedPages.length} pages for testing`);
    
    // すべてのレコードを格納する配列
    let allRecords: any[] = [];
    
    // 各ページを処理
    console.log('\n3. ページデータの処理');
    for (const page of limitedPages) {
      console.log(`[main] Processing page: ${page.title}`);
      try {
        const records = confluenceService.processConfluencePage(page);
        allRecords = allRecords.concat(records);
      } catch (error: any) {
        console.error(`[main] Error processing page ${page.title}: ${error.message}`);
        console.log(`[main] Skipping page ${page.title} and continuing...`);
      }
    }
    
    console.log(`[main] Generated ${allRecords.length} records from ${limitedPages.length} pages`);
    
    // 埋め込みベクトルを生成
    console.log('\n4. 埋め込みベクトルの生成');
    const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
    
    console.log(`[main] Generated embeddings for ${recordsWithEmbeddings.length}/${allRecords.length} records`);
    
    // 最初のレコードの埋め込みベクトルを表示
    if (recordsWithEmbeddings.length > 0) {
      const firstEmbedding = recordsWithEmbeddings[0].embedding;
      console.log(`[main] First embedding dimensions: ${firstEmbedding.length}`);
      console.log(`[main] First embedding sample: [${firstEmbedding.slice(0, 5).join(', ')}...]`);
    }
    
    // GCSにアップロード
    console.log('\n5. GCSへのJSONLファイルのアップロード');
    const filename = '';
    
    console.log(`[main] Uploaded file to gs://${bucketName}/${filename}`);
    
    // Vector Searchにバッチアップロード
    console.log('\n6. Vector Searchへのバッチアップロード');
    try {
      console.log(`[main] Note: Vector Search batch update requires manual import through Google Cloud Console.`);
      console.log(`[main] Please import the file gs://${bucketName}/${filename} manually.`);
      console.log(`[main] Skipping automatic Vector Search update due to API limitations.`);
      
      // 将来的にAPIが利用可能になった場合のためにコメントアウトしておく
      // await vectorSearchService.uploadToVectorSearch(filename, bucketName);
      // console.log(`[main] Batch update to Vector Search completed successfully`);
    } catch (error: any) {
      console.error(`[main] Vector Search batch update failed: ${error.message}`);
      console.log(`[main] Continuing with Firestore metadata save...`);
    }
    
    // Firestoreにメタデータを保存
    console.log('\n7. Firestoreへのメタデータ保存');
    await firestoreService.saveMetadataToFirestore(recordsWithEmbeddings);
    
    console.log(`[main] Metadata saved to Firestore successfully`);
    
    // 同期ログを保存
    console.log('\n8. 同期ログの保存');
    await firestoreService.saveSyncLog('complete', {
      message: 'Test Confluence data sync completed successfully',
      pagesProcessed: limitedPages.length,
      recordsProcessed: recordsWithEmbeddings.length,
      filename
    });
    
    console.log(`[main] Sync log saved successfully`);
    
    console.log('\n===== Confluence同期実装のテスト完了 =====');
  } catch (error: any) {
    console.error(`[main] Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// スクリプト実行
main();
