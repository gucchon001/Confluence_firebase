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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const genkit_js_1 = require("../ai/genkit.js");
const upload_jsonl_to_gcs_1 = require("./upload-jsonl-to-gcs");
const upload_to_vector_search_1 = require("./upload-to-vector-search");
const minimist_1 = __importDefault(require("minimist"));
// Firebase Admin SDKの初期化
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
    });
}
/**
 * HTMLからテキストを抽出する
 */
function extractTextFromHtml(html) {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
/**
 * テキストをチャンクに分割する
 */
function splitTextIntoChunks(text) {
    const CHUNK_SIZE = 1000;
    const chunks = [];
    for (let i = 0; i < text.length; i += CHUNK_SIZE) {
        const chunk = text.substring(i, i + CHUNK_SIZE).trim();
        if (chunk) {
            chunks.push(chunk);
        }
    }
    return chunks;
}
/**
 * Confluenceからページを取得する
 */
async function getConfluencePages(spaceKey, start, limit, lastSyncTime) {
    try {
        console.log(`Fetching Confluence pages from ${start} to ${start + limit - 1}...`);
        const baseUrl = process.env.CONFLUENCE_BASE_URL;
        const username = process.env.CONFLUENCE_USER_EMAIL;
        const apiToken = process.env.CONFLUENCE_API_TOKEN;
        if (!baseUrl || !username || !apiToken) {
            throw new Error('Confluence API credentials not configured');
        }
        const endpoint = `${baseUrl}/wiki/rest/api/content`;
        const params = {
            spaceKey,
            expand: 'body.storage,version,space,metadata.labels',
            start,
            limit
        };
        if (lastSyncTime) {
            console.log(`Fetching pages updated after ${lastSyncTime}`);
            // CQL (Confluence Query Language) を使用してフィルタリング
            params.cql = `lastModified >= "${lastSyncTime}" AND space = "${spaceKey}"`;
        }
        const response = await axios_1.default.get(endpoint, {
            params,
            auth: { username, password: apiToken }
        });
        if (!response.data || !response.data.results)
            return [];
        console.log(`Retrieved ${response.data.results.length} pages`);
        return response.data.results;
    }
    catch (error) {
        console.error('Error fetching Confluence pages:', error.message);
        if (axios_1.default.isAxiosError(error) && error.response) {
            console.error('API response:', error.response.status, error.response.statusText);
        }
        throw error;
    }
}
/**
 * 最後の同期時刻を取得する
 */
async function getLastSyncTime() {
    try {
        console.log('Getting last successful sync time...');
        // 最後の成功したバッチ同期を検索
        const syncLogsRef = admin.firestore().collection('syncLogs');
        const query = syncLogsRef
            .where('operation', '==', 'confluence_batch_sync')
            .where('status', '==', 'complete')
            .orderBy('timestamp', 'desc')
            .limit(1);
        const snapshot = await query.get();
        if (snapshot.empty) {
            console.log('No previous successful sync found');
            return null;
        }
        const lastSync = snapshot.docs[0].data();
        const lastSyncTime = lastSync.timestamp.toDate().toISOString();
        console.log(`Last successful sync was at ${lastSyncTime}`);
        return lastSyncTime;
    }
    catch (error) {
        console.error(`Error getting last sync time: ${error.message}`);
        return null;
    }
}
/**
 * 削除されたページのチャンクをFirestoreから削除する
 */
async function deleteChunksForPages(pageIds) {
    try {
        console.log(`Deleting chunks for ${pageIds.size} deleted pages...`);
        // 削除対象のページIDの配列
        const pageIdArray = Array.from(pageIds);
        // バッチサイズ（Firestoreの制限に合わせる）
        const batchSize = 500;
        let totalDeleted = 0;
        // 各ページIDに対して、関連するチャンクを検索して削除
        for (let i = 0; i < pageIdArray.length; i += batchSize) {
            const batch = admin.firestore().batch();
            let batchCount = 0;
            // このバッチで処理するページID
            const batchPageIds = pageIdArray.slice(i, i + batchSize);
            for (const pageId of batchPageIds) {
                // ページIDに関連するチャンクを検索
                const chunksQuery = admin.firestore().collection('chunks').where('pageId', '==', pageId);
                const chunks = await chunksQuery.get();
                if (chunks.empty) {
                    console.log(`No chunks found for page ${pageId}`);
                    continue;
                }
                console.log(`Deleting ${chunks.size} chunks for page ${pageId}`);
                // 各チャンクをバッチ削除
                chunks.forEach(doc => {
                    batch.delete(doc.ref);
                    batchCount++;
                });
                totalDeleted += chunks.size;
            }
            // バッチ処理を実行
            if (batchCount > 0) {
                await batch.commit();
                console.log(`Deleted ${batchCount} chunks in batch`);
            }
        }
        console.log(`Total chunks deleted: ${totalDeleted}`);
        // 削除ログを保存
        await saveSyncLog('deleted_pages', {
            message: `Deleted chunks for ${pageIds.size} pages`,
            pageIds: Array.from(pageIds),
            chunksDeleted: totalDeleted,
            timestamp: new Date().toISOString()
        });
        return totalDeleted;
    }
    catch (error) {
        console.error(`Error deleting chunks for deleted pages: ${error.message}`);
        throw error;
    }
}
/**
 * Firestoreから登録済みのページIDを取得する
 */
async function getRegisteredPageIds() {
    try {
        console.log('Getting registered page IDs from Firestore...');
        const chunkCollection = admin.firestore().collection('chunks');
        const snapshot = await chunkCollection.get();
        // ページIDを抽出（重複を除去するためにSetを使用）
        const pageIds = new Set();
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.pageId) {
                pageIds.add(data.pageId);
            }
        });
        console.log(`Found ${pageIds.size} registered page IDs in Firestore`);
        return pageIds;
    }
    catch (error) {
        console.error(`Error getting registered page IDs: ${error.message}`);
        return new Set();
    }
}
/**
 * バッチ同期を実行する
 */
async function batchSyncConfluence(isDifferentialSync = false, shouldDelete = true) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        console.log('Starting batch sync of Confluence data...');
        const spaceKey = process.env.CONFLUENCE_SPACE_KEY;
        if (!spaceKey)
            throw new Error('CONFLUENCE_SPACE_KEY not set');
        const gcsBatchRoot = `gs://${process.env.VERTEX_AI_STORAGE_BUCKET}`;
        let lastSyncTime = null;
        if (isDifferentialSync)
            lastSyncTime = await getLastSyncTime();
        await saveSyncLog('start', { message: 'Sync started', lastSyncTime });
        const allConfluencePageIds = await getRegisteredPageIds();
        const processedPageIds = new Set();
        let totalPages = 0, totalChunks = 0, totalEmbeddings = 0, batchCount = 0;
        const batchSize = 50; // ★★★ 元のバッチサイズに戻す ★★★
        let start = 0;
        let hasMore = true;
        while (hasMore) {
            batchCount++;
            try {
                const pages = await getConfluencePages(spaceKey, start, batchSize, isDifferentialSync ? lastSyncTime : undefined);
                if (pages.length === 0) {
                    hasMore = false;
                    break;
                }
                totalPages += pages.length;
                const recordsForBatch = [];
                for (const page of pages) {
                    processedPageIds.add(page.id);
                    const text = extractTextFromHtml(((_b = (_a = page.body) === null || _a === void 0 ? void 0 : _a.storage) === null || _b === void 0 ? void 0 : _b.value) || '');
                    const chunks = splitTextIntoChunks(text);
                    totalChunks += chunks.length;
                    const labels = ((_e = (_d = (_c = page.metadata) === null || _c === void 0 ? void 0 : _c.labels) === null || _d === void 0 ? void 0 : _d.results) === null || _e === void 0 ? void 0 : _e.map(l => l.name)) || [];
                    for (let i = 0; i < chunks.length; i++) {
                        recordsForBatch.push({
                            id: `${page.id}-${i}`, pageId: page.id, title: page.title,
                            spaceKey: ((_f = page.space) === null || _f === void 0 ? void 0 : _f.key) || '', spaceName: ((_g = page.space) === null || _g === void 0 ? void 0 : _g.name) || '',
                            url: `${process.env.CONFLUENCE_BASE_URL}/wiki/spaces/${(_h = page.space) === null || _h === void 0 ? void 0 : _h.key}/pages/${page.id}`,
                            lastUpdated: ((_j = page.version) === null || _j === void 0 ? void 0 : _j.when) || '', chunkIndex: i, content: chunks[i], labels
                        });
                    }
                }
                // ★★★ 埋め込み生成をバッチ処理に変更 ★★★
                console.log(`Generating embeddings for ${recordsForBatch.length} chunks in a batch...`);
                // 埋め込み対象のレコードとそうでないレコードを分割
                const recordsToEmbed = recordsForBatch.filter(r => r.content && r.content.trim() !== '');
                const recordsWithoutContent = recordsForBatch.filter(r => !r.content || r.content.trim() === '');
                let embeddedRecords = [];
                if (recordsToEmbed.length > 0) {
                    const EMBEDDING_BATCH_SIZE = 20; // ペイロードサイズ制限を回避するためのバッチサイズ
                    console.log(`Embedding ${recordsToEmbed.length} records in batches of ${EMBEDDING_BATCH_SIZE}...`);
                    for (let i = 0; i < recordsToEmbed.length; i += EMBEDDING_BATCH_SIZE) {
                        const batchOfRecords = recordsToEmbed.slice(i, i + EMBEDDING_BATCH_SIZE);
                        try {
                            const contentsToEmbed = batchOfRecords.map(r => ({ text: r.content }));
                            const embeddingResponses = await genkit_js_1.ai.embed({
                                embedder: 'googleai/text-embedding-004',
                                content: { content: contentsToEmbed },
                            });
                            const processedBatch = batchOfRecords.map((record, index) => {
                                var _a;
                                const embeddingVector = ((_a = embeddingResponses[index]) === null || _a === void 0 ? void 0 : _a.embedding) || [];
                                const l2 = Math.sqrt(embeddingVector.reduce((s, v) => s + (v * v), 0)) || 1;
                                const normalizedEmbedding = embeddingVector.map((v) => v / l2);
                                return Object.assign(Object.assign({}, record), { embedding: normalizedEmbedding });
                            });
                            embeddedRecords.push(...processedBatch);
                            console.log(`Successfully generated ${processedBatch.length} embeddings in sub-batch.`);
                        }
                        catch (embeddingError) {
                            console.error(`Error generating embeddings for a sub-batch in main batch ${batchCount}:`, embeddingError.message);
                            // 埋め込みに失敗したレコードは空のembeddingで処理を継続
                            const failedBatch = batchOfRecords.map(r => (Object.assign(Object.assign({}, r), { embedding: [] })));
                            embeddedRecords.push(...failedBatch);
                        }
                    }
                    totalEmbeddings += embeddedRecords.length;
                    console.log(`Total embeddings generated for main batch ${batchCount}: ${embeddedRecords.length}`);
                }
                // 埋め込みがなかったレコードも結果に含める
                const allRecordsForBatch = [
                    ...embeddedRecords,
                    ...recordsWithoutContent.map(r => (Object.assign(Object.assign({}, r), { embedding: [] })))
                ];
                // ★★★ データがある場合のみ後続処理を実行 ★★★
                if (allRecordsForBatch.length > 0) {
                    await saveMetadataToFirestore(allRecordsForBatch);
                    const jsonlFileName = await createAndUploadJsonl(allRecordsForBatch, batchCount);
                    await (0, upload_to_vector_search_1.uploadFileToVectorSearch)(jsonlFileName);
                }
                else {
                    console.log("No records to process for this batch.");
                }
                await saveSyncLog('batch_complete', { batch: batchCount, pages: pages.length, chunks: allRecordsForBatch.length });
                console.log(`Batch ${batchCount} completed.`);
                hasMore = false; // ★★★ テスト用にループ抜けを有効化 ★★★
            }
            catch (batchError) {
                console.error(`Error in batch ${batchCount}:`, batchError.message);
                await saveSyncLog('batch_error', { batch: batchCount, message: batchError.message });
            }
            start += batchSize;
        }
        if (shouldDelete) {
            await handleDeletedPages(allConfluencePageIds, processedPageIds);
        }
        console.log(`\nSending final update to Vector Search: ${gcsBatchRoot}/`);
        await (0, upload_to_vector_search_1.uploadFileToVectorSearch)(gcsBatchRoot);
        await saveSyncLog('complete', { totalPages, totalChunks, totalEmbeddings });
        console.log('\nBatch sync completed successfully');
        return { status: 'success', totalPages, totalChunks, totalEmbeddings };
    }
    catch (error) {
        console.error('Error in batch sync:', error.message);
        await saveSyncLog('error', { message: error.message });
        throw error;
    }
}
/**
 * バッチ同期のログを保存する
 * @param operation 操作名
 * @param data ログデータ
 */
async function saveSyncLog(operation, data) {
    try {
        const syncLogsRef = admin.firestore().collection('syncLogs');
        await syncLogsRef.add({
            operation,
            status: 'complete', // バッチ同期の場合は常にcomplete
            data,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`Sync log saved for operation: ${operation}`);
    }
    catch (error) {
        console.error(`Error saving sync log for operation ${operation}: ${error.message}`);
    }
}
/**
 * メタデータをFirestoreに保存する
 * @param records 埋め込みベクトルを含むレコード
 */
async function saveMetadataToFirestore(records) {
    if (!records || records.length === 0) {
        console.log('No metadata records to save.');
        return;
    }
    console.log(`Preparing to save ${records.length} metadata records to Firestore one by one...`);
    const metadataRef = admin.firestore().collection('chunks');
    let successCount = 0;
    let errorCount = 0;
    for (const record of records) {
        try {
            if (record && record.id) {
                const docRef = metadataRef.doc(record.id);
                const { embedding } = record, firestoreData = __rest(record, ["embedding"]);
                await docRef.set(Object.assign(Object.assign({}, firestoreData), { createdAt: admin.firestore.FieldValue.serverTimestamp() }), { merge: true });
                successCount++;
            }
            else {
                console.warn('Skipping invalid record:', record);
                errorCount++;
            }
        }
        catch (error) {
            console.error(`Error saving record ${record.id} to Firestore:`, error.message);
            errorCount++;
        }
    }
    console.log(`Firestore save complete. Success: ${successCount}, Errors: ${errorCount}`);
    if (errorCount > 0) {
        throw new Error(`${errorCount} records failed to save to Firestore.`);
    }
}
/**
 * JSONLファイルを作成してGCSにアップロードする
 * @param records 埋め込みベクトルを含むレコード
 * @param batchNumber バッチ番号
 */
async function createAndUploadJsonl(records, batchNumber) {
    try {
        const filename = `vector-search-data-${new Date().toISOString().split('T')[0]}-batch-${batchNumber}-${Date.now()}.json`;
        const filePath = path.join(process.cwd(), 'temp', filename);
        // JSONLファイルを作成
        const jsonlContent = records.map(record => JSON.stringify(record)).join('\n');
        await fs.promises.writeFile(filePath, jsonlContent);
        console.log(`JSONL file created at ${filePath}`);
        // GCSにアップロード
        const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET;
        if (!bucketName) {
            throw new Error('VERTEX_AI_STORAGE_BUCKET environment variable is not set');
        }
        const gcsPath = `gs://${bucketName}/${filename}`;
        await (0, upload_jsonl_to_gcs_1.uploadFileToGCS)(filePath);
        console.log(`JSONL file uploaded to ${gcsPath}`);
        // アップロードしたファイルのパスを返す
        return filename;
    }
    catch (error) {
        console.error(`Error creating and uploading JSONL file: ${error.message}`);
        throw error;
    }
}
/**
 * 削除されたページを処理する
 * @param allPageIds 全てのConfluenceページID
 * @param lastSyncTime 前回の同期時刻
 */
async function handleDeletedPages(allRegisteredPageIds, processedPageIds) {
    try {
        console.log('\nChecking for deleted pages...');
        const deletedPageIds = new Set();
        for (const pageId of allRegisteredPageIds) {
            if (!processedPageIds.has(pageId)) {
                deletedPageIds.add(pageId);
            }
        }
        const deletedPagesCount = deletedPageIds.size;
        console.log(`Found ${deletedPagesCount} deleted pages`);
        if (deletedPagesCount > 0) {
            await deleteChunksForPages(deletedPageIds);
        }
    }
    catch (error) {
        console.error(`Error handling deleted pages: ${error.message}`);
        throw error;
    }
}
/**
 * スクリプトのエントリーポイント
 */
async function main() {
    const argv = (0, minimist_1.default)(process.argv.slice(2));
    const isAllSync = argv.all || false; // --all フラグをチェック
    // isDifferentialSync は isAllSync の逆
    const isDifferentialSync = !isAllSync;
    const shouldDelete = isDifferentialSync;
    console.log(`Starting sync: All=${isAllSync}, Differential=${isDifferentialSync}, Delete=${shouldDelete}`);
    try {
        const result = await batchSyncConfluence(isDifferentialSync, shouldDelete);
        console.log('Batch sync finished successfully.', result);
        process.exit(0);
    }
    catch (error) {
        console.error('Batch sync failed with an unhandled error:', error);
        process.exit(1);
    }
}
main();
