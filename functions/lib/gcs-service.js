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
exports.ensureBucketExists = ensureBucketExists;
exports.uploadToGCS = uploadToGCS;
/**
 * Google Cloud Storage (GCS) サービス
 */
const storage_1 = require("@google-cloud/storage");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const uuid_1 = require("uuid");
// Storageクライアントの初期化
const storage = new storage_1.Storage();
/**
 * GCSバケットが存在するかチェックし、なければ作成する
 * @param bucketName バケット名
 */
async function ensureBucketExists(bucketName) {
    try {
        console.log(`[ensureBucketExists] Checking if bucket ${bucketName} exists`);
        const [exists] = await storage.bucket(bucketName).exists();
        if (!exists) {
            console.log(`[ensureBucketExists] Bucket ${bucketName} does not exist, creating it`);
            await storage.createBucket(bucketName, {
                location: 'asia-northeast1',
                storageClass: 'STANDARD'
            });
            console.log(`[ensureBucketExists] Bucket ${bucketName} created successfully`);
        }
        else {
            console.log(`[ensureBucketExists] Bucket ${bucketName} already exists`);
        }
    }
    catch (error) {
        console.error(`[ensureBucketExists] Error checking/creating bucket: ${error.message}`);
        throw new Error(`Failed to ensure bucket exists: ${error.message}`);
    }
}
/**
 * Vector Search用のJSONLファイルを生成してGCSにアップロードする
 * @param records レコードの配列
 * @param bucketName バケット名
 * @returns アップロードされたファイル名
 */
async function uploadToGCS(records, bucketName) {
    try {
        console.log(`[uploadToGCS] Preparing to upload ${records.length} records to GCS`);
        // データポイントの準備
        const datapoints = records.map((record) => {
            // Vector Search用のデータポイントを生成
            const datapoint = {
                id: `${record.pageId}-${record.chunkIndex}`,
                featureVector: record.embedding.map(Number),
                restricts: [
                    {
                        namespace: "title",
                        allow_list: [record.title]
                    },
                    {
                        namespace: "space_key",
                        allow_list: [record.spaceKey]
                    },
                    {
                        namespace: "content_type",
                        allow_list: ["confluence_page"]
                    }
                ],
                crowding_tag: record.pageId
            };
            // ラベルがある場合は追加
            if (record.labels && record.labels.length > 0) {
                datapoint.restricts.push({
                    namespace: "label",
                    allow_list: record.labels
                });
            }
            return datapoint;
        });
        // JSONLファイルを生成
        const jsonlData = datapoints.map(dp => JSON.stringify(dp)).join('\n');
        // 一時ファイルのパスを生成
        const tempFilePath = path.join(os.tmpdir(), `vector-search-data-${(0, uuid_1.v4)()}.jsonl`);
        // 一時ファイルに書き込み
        fs.writeFileSync(tempFilePath, jsonlData);
        // ファイル名を生成
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const filename = `vector-search-data-${timestamp}.jsonl`;
        // GCSにアップロード
        console.log(`[uploadToGCS] Uploading file to gs://${bucketName}/${filename}`);
        await storage.bucket(bucketName).upload(tempFilePath, {
            destination: filename
        });
        // 一時ファイルを削除
        fs.unlinkSync(tempFilePath);
        console.log(`[uploadToGCS] File uploaded successfully to gs://${bucketName}/${filename}`);
        return filename;
    }
    catch (error) {
        console.error(`[uploadToGCS] Error uploading to GCS: ${error.message}`);
        throw new Error(`Failed to upload to GCS: ${error.message}`);
    }
}
//# sourceMappingURL=gcs-service.js.map