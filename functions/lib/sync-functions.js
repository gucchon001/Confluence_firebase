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
exports.manualSyncConfluenceData = exports.syncConfluenceData = void 0;
/**
 * Confluence同期関数
 */
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const confluenceService = __importStar(require("./confluence-service"));
const embeddingService = __importStar(require("./embedding-service"));
const vectorSearchService = __importStar(require("./vector-search-service"));
const firestoreService = __importStar(require("./firestore-service"));
const config = __importStar(require("./config"));
// Firebase初期化（まだ初期化されていない場合）
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Confluenceデータを同期するCloud Function
 */
exports.syncConfluenceData = functions.pubsub
    .schedule('0 2 * * *') // 毎日午前2時に実行
    .timeZone('Asia/Tokyo')
    .onRun(async (context) => {
    var _a, _b, _c, _d;
    try {
        // 同期開始ログ
        await firestoreService.saveSyncLog('start', { message: 'Starting Confluence data sync' });
        // スペースキーを取得
        const spaceKey = process.env.CONFLUENCE_SPACE_KEY || ((_a = config.confluence) === null || _a === void 0 ? void 0 : _a.space_key);
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
        let allRecords = [];
        // 各ページを処理
        for (const page of pages) {
            const records = confluenceService.processConfluencePage(page);
            allRecords = allRecords.concat(records);
        }
        // 埋め込みベクトルを生成
        const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
        // プロジェクトIDを取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || ((_b = config.vertexai) === null || _b === void 0 ? void 0 : _b.project_id);
        const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || ((_c = config.vertexai) === null || _c === void 0 ? void 0 : _c.numeric_project_id);
        if (!projectId || !numericProjectId) {
            throw new Error("Vertex AI project ID not configured");
        }
        // バケット名を決定
        const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || ((_d = config.vertexai) === null || _d === void 0 ? void 0 : _d.storage_bucket) || `${numericProjectId}-vector-search`;
        // バケットが存在するか確認し、なければ作成
        await gcsService.ensureBucketExists(bucketName);
        // GCSにアップロード
        const filename = await gcsService.uploadToGCS(recordsWithEmbeddings, bucketName);
        // Vector Searchにバッチアップロード
        await vectorSearchService.uploadToVectorSearch(filename, bucketName);
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
    }
    catch (error) {
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
exports.manualSyncConfluenceData = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    try {
        // POSTリクエストのみ許可
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }
        // 同期開始ログ
        await firestoreService.saveSyncLog('start', { message: 'Starting manual Confluence data sync' });
        // スペースキーを取得（リクエストボディから、または設定から）
        const spaceKey = req.body.spaceKey || process.env.CONFLUENCE_SPACE_KEY || ((_a = config.confluence) === null || _a === void 0 ? void 0 : _a.space_key);
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
        let allRecords = [];
        // 各ページを処理
        for (const page of pages) {
            const records = confluenceService.processConfluencePage(page);
            allRecords = allRecords.concat(records);
        }
        // 埋め込みベクトルを生成
        const recordsWithEmbeddings = await embeddingService.generateEmbeddings(allRecords);
        // プロジェクトIDを取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || ((_b = config.vertexai) === null || _b === void 0 ? void 0 : _b.project_id);
        const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || ((_c = config.vertexai) === null || _c === void 0 ? void 0 : _c.numeric_project_id);
        if (!projectId || !numericProjectId) {
            throw new Error("Vertex AI project ID not configured");
        }
        // バケット名を決定
        const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || ((_d = config.vertexai) === null || _d === void 0 ? void 0 : _d.storage_bucket) || `${numericProjectId}-vector-search`;
        // バケットが存在するか確認し、なければ作成
        await gcsService.ensureBucketExists(bucketName);
        // GCSにアップロード
        const filename = await gcsService.uploadToGCS(recordsWithEmbeddings, bucketName);
        // Vector Searchにバッチアップロード
        await vectorSearchService.uploadToVectorSearch(filename, bucketName);
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
    }
    catch (error) {
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
//# sourceMappingURL=sync-functions.js.map