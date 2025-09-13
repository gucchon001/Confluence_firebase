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
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveMetadataToFirestore = saveMetadataToFirestore;
exports.saveSyncLog = saveSyncLog;
exports.fetchContentsFromFirestore = fetchContentsFromFirestore;
/**
 * Firestore サービス
 */
const admin = __importStar(require("firebase-admin"));
// Firebaseが初期化されていない場合は初期化
if (!admin.apps.length) {
    admin.initializeApp();
}
/**
 * Firestoreにメタデータを保存する
 * @param records レコードの配列
 */
async function saveMetadataToFirestore(records) {
    try {
        console.log(`[saveMetadataToFirestore] Saving metadata for ${records.length} records to Firestore`);
        const batch = admin.firestore().batch();
        const chunkCollection = admin.firestore().collection('chunks');
        // 各レコードに対してバッチ書き込み
        for (const record of records) {
            const docId = `${record.pageId}-${record.chunkIndex}`;
            const docRef = chunkCollection.doc(docId);
            // 埋め込みベクトルを除外したメタデータを保存
            const { embedding } = record, metadata = __rest(record, ["embedding"]);
            batch.set(docRef, Object.assign(Object.assign({}, metadata), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
        }
        // バッチ書き込みを実行
        await batch.commit();
        console.log(`[saveMetadataToFirestore] Metadata saved successfully`);
    }
    catch (error) {
        console.error(`[saveMetadataToFirestore] Error saving metadata to Firestore: ${error.message}`);
        throw new Error(`Failed to save metadata to Firestore: ${error.message}`);
    }
}
/**
 * 同期ログを保存する
 * @param status ステータス ('start' | 'complete' | 'error')
 * @param details 詳細情報
 */
async function saveSyncLog(status, details) {
    try {
        const log = {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            operation: 'confluence_sync',
            status,
            details
        };
        await admin.firestore().collection('syncLogs').add(log);
        console.log(`[saveSyncLog] Sync log saved with status: ${status}`);
    }
    catch (error) {
        console.error(`[saveSyncLog] Error saving sync log: ${error.message}`);
    }
}
/**
 * 検索結果からFirestoreでメタデータを取得
 * @param searchResults 検索結果の配列
 * @returns メタデータ付きの検索結果
 */
async function fetchContentsFromFirestore(searchResults) {
    try {
        console.log(`[fetchContentsFromFirestore] Fetching metadata for ${searchResults.length} search results`);
        // 検索結果のIDを取得
        const ids = searchResults.map(result => result.id);
        if (ids.length === 0) {
            return [];
        }
        // バッチでドキュメントを取得
        const chunks = await Promise.all(ids.map(async (id) => {
            const doc = await admin.firestore().collection('chunks').doc(id).get();
            return doc.exists ? Object.assign({ id }, doc.data()) : null;
        }));
        // 検索結果とコンテンツを結合
        const resultsWithContent = searchResults.map((result, index) => {
            const chunk = chunks[index];
            if (!chunk) {
                return Object.assign(Object.assign({}, result), { content: '内容が見つかりませんでした。' });
            }
            return Object.assign(Object.assign({}, result), { content: chunk.content, url: chunk.url, lastUpdated: chunk.lastUpdated, spaceName: chunk.spaceName, labels: chunk.labels || [] });
        });
        console.log(`[fetchContentsFromFirestore] Successfully fetched metadata for ${resultsWithContent.length} results`);
        return resultsWithContent;
    }
    catch (error) {
        console.error(`[fetchContentsFromFirestore] Error fetching contents from Firestore: ${error.message}`);
        return searchResults.map(result => (Object.assign(Object.assign({}, result), { content: 'エラーが発生しました。' })));
    }
}
//# sourceMappingURL=firestore-service.js.map