import 'dotenv/config';
import * as admin from 'firebase-admin';
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { promisify } from 'util';

// Firebase Admin SDKの初期化
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

// Storageクライアントの初期化
const storage = new Storage();

/**
 * GCSバケットが存在するかチェックし、なければ作成する
 */
async function ensureBucketExists(bucketName: string): Promise<void> {
  try {
    console.log(`Checking if bucket ${bucketName} exists`);
    
    const [exists] = await storage.bucket(bucketName).exists();
    
    if (!exists) {
      console.log(`Bucket ${bucketName} does not exist, creating it`);
      await storage.createBucket(bucketName, {
        location: 'asia-northeast1',
        storageClass: 'STANDARD'
      });
      console.log(`Bucket ${bucketName} created successfully`);
    } else {
      console.log(`Bucket ${bucketName} already exists`);
    }
  } catch (error: any) {
    console.error(`Error checking/creating bucket: ${error.message}`);
    throw new Error(`Failed to ensure bucket exists: ${error.message}`);
  }
}

/**
 * JSONファイルをGCSにアップロードする
 */
async function uploadJsonlToGCS(filePath: string, bucketName: string): Promise<string> {
  try {
    console.log(`Uploading file ${filePath} to gs://${bucketName}/`);
    
    // ファイル名を取得
    const filename = path.basename(filePath);
    
    // バケットの直下に配置（Vector Search の仕様に準拠）
    // GCSにアップロード
    await storage.bucket(bucketName).upload(filePath, {
      destination: filename
    });
    
    console.log(`File uploaded successfully to gs://${bucketName}/${filename}`);
    
    // 同期ログを保存
    await saveSyncLog('gcs_upload_complete', {
      message: `File ${filename} uploaded to GCS successfully`,
      filename,
      gcsPath: `gs://${bucketName}/${filename}`,
      timestamp: new Date().toISOString()
    });
    
    return filename;
  } catch (error: any) {
    console.error(`Error uploading to GCS: ${error.message}`);
    
    // エラーログを保存
    await saveSyncLog('gcs_upload_error', {
      message: `Failed to upload file ${filePath} to GCS: ${error.message}`,
      filename: path.basename(filePath),
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
}

/**
 * 同期ログを保存する
 */
async function saveSyncLog(status: string, details: any): Promise<void> {
  try {
    const log = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      operation: 'gcs_upload',
      status,
      details
    };
    
    await admin.firestore().collection('syncLogs').add(log);
    
    console.log(`Sync log saved with status: ${status}`);
  } catch (error: any) {
    console.error(`Error saving sync log: ${error.message}`);
  }
}

/**
 * メイン関数
 */
async function main() {
  try {
    // 環境変数の確認
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
    
    if (!bucketName) {
      throw new Error('VERTEX_AI_STORAGE_BUCKET environment variable is not set');
    }
    
    console.log(`Starting upload of JSON/JSONL files to GCS bucket: ${bucketName}`);
    
    // バケットの存在確認
    await ensureBucketExists(bucketName);
    
    // tempディレクトリ内のJSONLとJSONファイルを検索
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    console.log(`Looking for JSON/JSONL files in directory: ${tempDir}`);
    
    // 絶対パスを使用
    const absoluteTempDir = path.resolve(tempDir);
    console.log(`Absolute path: ${absoluteTempDir}`);
    
    // ファイル一覧を直接取得
    let jsonFiles: string[] = [];
    try {
      if (fs.existsSync(absoluteTempDir)) {
        const files = fs.readdirSync(absoluteTempDir);
        jsonFiles = files
          .filter(file => file.endsWith('.jsonl') || file.endsWith('.json'))
          .map(file => path.join(absoluteTempDir, file));
        console.log(`Files found in directory: ${files.join(', ')}`);
      } else {
        console.log(`Directory does not exist: ${absoluteTempDir}`);
      }
    } catch (error: any) {
      console.error(`Error reading directory: ${error.message}`);
    }
    
    console.log(`Found ${jsonFiles.length} JSON/JSONL files in temp directory`);
    
    if (jsonFiles.length === 0) {
      console.log('No JSON/JSONL files found to upload');
      return;
    }
    
    // 開始ログを保存
    await saveSyncLog('start', {
      message: `Starting upload of ${jsonFiles.length} JSON/JSONL files to GCS`,
      timestamp: new Date().toISOString()
    });
    
    // 各ファイルをアップロード
    const uploadedFiles = [];
    for (const filePath of jsonFiles) {
      try {
        const filename = await uploadJsonlToGCS(filePath, bucketName);
        uploadedFiles.push(filename);
        console.log(`Uploaded ${filePath} to gs://${bucketName}/${filename}`);
      } catch (error: any) {
        console.error(`Failed to upload ${filePath}: ${error.message}`);
      }
    }
    
    // 完了ログを保存
    await saveSyncLog('complete', {
      message: `Completed upload of JSON/JSONL files to GCS`,
      filesUploaded: uploadedFiles.length,
      filenames: uploadedFiles,
      timestamp: new Date().toISOString()
    });
    
    console.log(`\nUpload process completed`);
    console.log(`Total files uploaded: ${uploadedFiles.length}/${jsonFiles.length}`);
    
  } catch (error: any) {
    console.error('Error in main process:', error.message);
    
    // エラーログを保存
    await saveSyncLog('error', {
      message: `Upload process failed: ${error.message}`,
      timestamp: new Date().toISOString()
    });
  }
}

// 特定のファイルをアップロードする関数をエクスポート
export async function uploadFileToGCS(filePath: string): Promise<string | null> {
  try {
    // 環境変数の確認
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
    
    if (!bucketName) {
      throw new Error('VERTEX_AI_STORAGE_BUCKET environment variable is not set');
    }
    
    // バケットの存在確認
    await ensureBucketExists(bucketName);
    
    // ファイルをアップロード
    const filename = await uploadJsonlToGCS(filePath, bucketName);
    return filename;
  } catch (error: any) {
    console.error(`Error uploading file ${filePath} to GCS: ${error.message}`);
    return null;
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (require.main === module) {
  main()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
