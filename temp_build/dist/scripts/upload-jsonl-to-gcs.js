"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFileToGCS = uploadFileToGCS;
require("dotenv/config");
const admin = __importStar(require("firebase-admin"));
const storage_1 = require("@google-cloud/storage");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Firebase Admin SDKの初期化
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}
// Storageクライアントの初期化
const storage = new storage_1.Storage();
/**
 * GCSバケットが存在するかチェックし、なければ作成する
 */
async function ensureBucketExists(bucketName) {
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
        }
        else {
            console.log(`Bucket ${bucketName} already exists`);
        }
    }
    catch (error) {
        console.error(`Error checking/creating bucket: ${error.message}`);
        throw new Error(`Failed to ensure bucket exists: ${error.message}`);
    }
}
/**
 * JSONファイルをGCSにアップロードする
 */
async function uploadJsonlToGCS(filePath, bucketName) {
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
    }
    catch (error) {
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
async function saveSyncLog(status, details) {
    try {
        const log = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            operation: 'gcs_upload',
            status,
            details
        };
        await admin.firestore().collection('syncLogs').add(log);
        console.log(`Sync log saved with status: ${status}`);
    }
    catch (error) {
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
        let jsonFiles = [];
        try {
            if (fs.existsSync(absoluteTempDir)) {
                const files = fs.readdirSync(absoluteTempDir);
                jsonFiles = files
                    .filter(file => file.endsWith('.jsonl') || file.endsWith('.json'))
                    .map(file => path.join(absoluteTempDir, file));
                console.log(`Files found in directory: ${files.join(', ')}`);
            }
            else {
                console.log(`Directory does not exist: ${absoluteTempDir}`);
            }
        }
        catch (error) {
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
            }
            catch (error) {
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
    }
    catch (error) {
        console.error('Error in main process:', error.message);
        // エラーログを保存
        await saveSyncLog('error', {
            message: `Upload process failed: ${error.message}`,
            timestamp: new Date().toISOString()
        });
    }
}
// 特定のファイルをアップロードする関数をエクスポート
async function uploadFileToGCS(filePath) {
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
    }
    catch (error) {
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
