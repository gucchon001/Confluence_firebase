"use strict";
/**
 * GCSバケットの内容を確認するテスト
 */
Object.defineProperty(exports, "__esModule", { value: true });
const storage_1 = require("@google-cloud/storage");
/**
 * GCSバケットの内容を一覧表示する
 */
async function listBucketContents() {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || `vertex-ai-vector-search-${projectId}`;
        console.log(`[listBucketContents] Listing contents of bucket: ${bucketName}`);
        // Cloud Storageクライアントの初期化
        const storage = new storage_1.Storage();
        // バケットの存在確認
        const [bucketExists] = await storage.bucket(bucketName).exists();
        if (!bucketExists) {
            console.log(`[listBucketContents] Bucket ${bucketName} does not exist`);
            return;
        }
        // ファイル一覧の取得
        const [files] = await storage.bucket(bucketName).getFiles();
        console.log(`[listBucketContents] Found ${files.length} files in bucket ${bucketName}`);
        // ファイル一覧を表示
        files.forEach((file, index) => {
            console.log(`${index + 1}. ${file.name} (${file.metadata.size} bytes, ${file.metadata.timeCreated})`);
        });
        // 最新のファイルを取得
        if (files.length > 0) {
            // 作成日時でソート
            const sortedFiles = [...files].sort((a, b) => {
                const timeA = new Date(a.metadata.timeCreated || Date.now()).getTime();
                const timeB = new Date(b.metadata.timeCreated || Date.now()).getTime();
                return timeB - timeA; // 降順（最新が先頭）
            });
            const latestFile = sortedFiles[0];
            console.log(`\n[listBucketContents] Latest file: ${latestFile.name}`);
            console.log(`- Created: ${latestFile.metadata.timeCreated}`);
            console.log(`- Size: ${latestFile.metadata.size} bytes`);
            // ファイルの内容を取得（最初の10行のみ）
            console.log(`\n[listBucketContents] Content of latest file (first 10 lines):`);
            const [content] = await latestFile.download();
            const contentStr = content.toString('utf-8');
            const lines = contentStr.split('\n');
            lines.slice(0, 10).forEach((line, i) => {
                console.log(`Line ${i + 1}: ${line.substring(0, 500)}${line.length > 500 ? '...' : ''}`);
            });
            // JSONLの最初のレコードを解析して構造を確認
            if (lines.length > 0) {
                try {
                    console.log(`\n[listBucketContents] Structure of first record:`);
                    const firstRecord = JSON.parse(lines[0]);
                    // フィールド名の一覧を表示
                    console.log(`- Fields: ${Object.keys(firstRecord).join(', ')}`);
                    // IDフィールドの値を表示
                    if (firstRecord.id) {
                        console.log(`- ID: ${firstRecord.id}`);
                    }
                    else if (firstRecord.datapoint_id) {
                        console.log(`- Datapoint ID: ${firstRecord.datapoint_id}`);
                    }
                    // ベクトルフィールドの名前と次元数を表示
                    if (firstRecord.embedding) {
                        console.log(`- Embedding field: 'embedding' (${firstRecord.embedding.length} dimensions)`);
                    }
                    else if (firstRecord.featureVector) {
                        console.log(`- Embedding field: 'featureVector' (${firstRecord.featureVector.length} dimensions)`);
                    }
                    else if (firstRecord.feature_vector) {
                        console.log(`- Embedding field: 'feature_vector' (${firstRecord.feature_vector.length} dimensions)`);
                    }
                    // restrictsフィールドの内容を表示
                    if (firstRecord.restricts) {
                        console.log(`- Restricts: ${JSON.stringify(firstRecord.restricts)}`);
                    }
                    // crowding_tagフィールドの値を表示
                    if (firstRecord.crowding_tag) {
                        console.log(`- Crowding tag: ${firstRecord.crowding_tag}`);
                    }
                }
                catch (parseError) {
                    console.error(`[listBucketContents] Error parsing JSON: ${parseError}`);
                }
            }
        }
    }
    catch (error) {
        console.error(`[listBucketContents] Error listing bucket contents:`, error);
    }
}
/**
 * メイン関数
 */
async function main() {
    try {
        console.log('===== GCSバケット内容確認テスト開始 =====');
        // 環境変数の表示
        console.log('環境変数:');
        console.log('- VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
        console.log('- VERTEX_AI_STORAGE_BUCKET:', process.env.VERTEX_AI_STORAGE_BUCKET);
        console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
        // GCSバケットの内容を一覧表示
        console.log('\nGCSバケットの内容を確認');
        await listBucketContents();
        console.log('\n===== GCSバケット内容確認テスト完了 =====');
    }
    catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-gcs-content.js.map