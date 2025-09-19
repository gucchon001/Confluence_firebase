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
exports.getSyncStatus = exports.syncConfluenceData = void 0;
/**
 * Cloud Functions for Firebase - バッチ処理版
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const confluenceService = __importStar(require("./confluence-service"));
const embeddingService = __importStar(require("./embedding-service"));
const firestoreService = __importStar(require("./firestore-service"));
const config = __importStar(require("./config"));
// Firebase初期化
admin.initializeApp();
/**
 * Confluenceデータを同期する関数
 *
 * Cloud Schedulerから呼び出されることを想定
 * 毎日深夜に実行され、Confluenceからデータを取得してGCSにアップロードし、
 * Firestoreにメタデータを保存する
 */
exports.syncConfluenceData = functions
    .region('asia-northeast1')
    .runWith({
    timeoutSeconds: 540, // 9分
    memory: '1GB'
})
    .https.onRequest(async (req, res) => {
    var _a, _b;
    try {
        console.log('[syncConfluenceData] Starting Confluence data sync');
        // 同期開始ログを保存
        await firestoreService.saveSyncLog('start', {
            message: 'Confluence data sync started'
        });
        // Confluenceからデータを取得
        const spaceKey = process.env.CONFLUENCE_SPACE_KEY || ((_a = config.confluence) === null || _a === void 0 ? void 0 : _a.space_key);
        if (!spaceKey) {
            throw new Error('Confluence space key not configured');
        }
        const pages = await confluenceService.getAllSpaceContent(spaceKey);
        console.log(`[syncConfluenceData] Retrieved ${pages.length} pages from Confluence`);
        // データを処理
        let allRecords = [];
        for (const page of pages) {
            try {
                const records = confluenceService.processConfluencePage(page);
                allRecords = allRecords.concat(records);
            }
            catch (error) {
                console.error(`[syncConfluenceData] Error processing page ${page.id}: ${error.message}`);
            }
        }
        console.log(`[syncConfluenceData] Generated ${allRecords.length} records`);
        // 埋め込みベクトルを生成
        const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
        console.log(`[syncConfluenceData] Generated embeddings for ${recordsWithEmbeddings.length}/${allRecords.length} records`);
        // GCSにアップロード
        const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || ((_b = config.vertexai) === null || _b === void 0 ? void 0 : _b.storage_bucket);
        if (!bucketName) {
            throw new Error('GCS bucket name not configured');
        }
        const filename = await gcsService.uploadToGCS(recordsWithEmbeddings, bucketName);
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
    }
    catch (error) {
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
exports.getSyncStatus = functions
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
    }
    catch (error) {
        console.error(`[getSyncStatus] Error: ${error.message}`);
        return {
            status: 'error',
            message: `Failed to get sync status: ${error.message}`
        };
    }
});
//# sourceMappingURL=index-batch.js.map