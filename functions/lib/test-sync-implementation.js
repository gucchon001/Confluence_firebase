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
/**
 * Confluence同期実装のテスト
 */
const dotenv = __importStar(require("dotenv"));
const admin = __importStar(require("firebase-admin"));
const confluenceService = __importStar(require("./confluence-service"));
const embeddingService = __importStar(require("./embedding-service"));
const gcsService = __importStar(require("./gcs-service"));
const firestoreService = __importStar(require("./firestore-service"));
const config = __importStar(require("./config"));
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
    var _a, _b, _c, _d;
    try {
        console.log('===== Confluence同期実装のテスト開始 =====');
        // スペースキーを取得
        const spaceKey = process.env.CONFLUENCE_SPACE_KEY || ((_a = config.confluence) === null || _a === void 0 ? void 0 : _a.space_key);
        if (!spaceKey) {
            throw new Error("Confluence space key not configured");
        }
        console.log(`[main] Using Confluence space key: ${spaceKey}`);
        // バケット名を決定
        const projectId = process.env.VERTEX_AI_PROJECT_ID || ((_b = config.vertexai) === null || _b === void 0 ? void 0 : _b.project_id);
        const numericProjectId = process.env.VERTEX_AI_NUMERIC_PROJECT_ID || ((_c = config.vertexai) === null || _c === void 0 ? void 0 : _c.numeric_project_id);
        if (!projectId || !numericProjectId) {
            throw new Error("Vertex AI project ID not configured");
        }
        const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || ((_d = config.vertexai) === null || _d === void 0 ? void 0 : _d.storage_bucket) || `${numericProjectId}-vector-search`;
        console.log(`[main] Using GCS bucket: ${bucketName}`);
        // バケットが存在するか確認し、なければ作成
        console.log('\n1. GCSバケットの確認/作成');
        await gcsService.ensureBucketExists(bucketName);
        // テスト用に一部のページのみ取得
        console.log('\n2. Confluenceからページデータを取得（テスト用に最大5件）');
        const pages = await confluenceService.getAllSpaceContent(spaceKey);
        const limitedPages = pages.slice(0, 5);
        console.log(`[main] Retrieved ${limitedPages.length} pages for testing`);
        // すべてのレコードを格納する配列
        let allRecords = [];
        // 各ページを処理
        console.log('\n3. ページデータの処理');
        for (const page of limitedPages) {
            console.log(`[main] Processing page: ${page.title}`);
            try {
                const records = confluenceService.processConfluencePage(page);
                allRecords = allRecords.concat(records);
            }
            catch (error) {
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
        const filename = await gcsService.uploadToGCS(recordsWithEmbeddings, bucketName);
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
        }
        catch (error) {
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
    }
    catch (error) {
        console.error(`[main] Error: ${error.message}`);
        console.error(error.stack);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-sync-implementation.js.map