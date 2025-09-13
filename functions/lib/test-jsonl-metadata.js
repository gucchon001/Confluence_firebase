"use strict";
/**
 * JSONLファイルのメタデータ内容を確認するテスト
 *
 * GCSバケットからJSONLファイルを取得し、複数のレコードのメタデータ内容を詳細に確認する
 */
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
const storage_1 = require("@google-cloud/storage");
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
/**
 * GCSバケットから最新のJSONLファイルを取得する
 *
 * @param bucketName GCSバケット名
 * @returns 最新のJSONLファイルのパス
 */
async function getLatestJsonlFile(bucketName) {
    try {
        console.log(`[getLatestJsonlFile] Getting latest JSONL file from bucket: ${bucketName}`);
        // Cloud Storageクライアントの初期化
        const storage = new storage_1.Storage();
        // バケットの存在確認
        const [bucketExists] = await storage.bucket(bucketName).exists();
        if (!bucketExists) {
            throw new Error(`Bucket ${bucketName} does not exist`);
        }
        // ファイル一覧の取得
        const [files] = await storage.bucket(bucketName).getFiles();
        if (files.length === 0) {
            throw new Error(`No files found in bucket ${bucketName}`);
        }
        // JSONLファイルのみをフィルタリング
        const jsonlFiles = files.filter(file => file.name.endsWith('.jsonl'));
        if (jsonlFiles.length === 0) {
            throw new Error(`No JSONL files found in bucket ${bucketName}`);
        }
        // 作成日時でソート
        const sortedFiles = [...jsonlFiles].sort((a, b) => {
            const timeA = new Date(a.metadata.timeCreated || Date.now()).getTime();
            const timeB = new Date(b.metadata.timeCreated || Date.now()).getTime();
            return timeB - timeA; // 降順（最新が先頭）
        });
        const latestFile = sortedFiles[0];
        console.log(`[getLatestJsonlFile] Latest JSONL file: ${latestFile.name}`);
        console.log(`- Created: ${latestFile.metadata.timeCreated}`);
        console.log(`- Size: ${latestFile.metadata.size} bytes`);
        // ファイルの内容を取得
        const [content] = await latestFile.download();
        const contentStr = content.toString('utf-8');
        // 一時ファイルに保存
        const tempFilePath = `./temp-${Date.now()}.jsonl`;
        fs.writeFileSync(tempFilePath, contentStr);
        return {
            filePath: tempFilePath,
            content: contentStr
        };
    }
    catch (error) {
        console.error('[getLatestJsonlFile] Error getting latest JSONL file:', error);
        throw error;
    }
}
/**
 * JSONLファイルから複数のレコードを取得し、メタデータを確認する
 *
 * @param filePath JSONLファイルのパス
 * @param count 取得するレコード数
 */
async function checkJsonlMetadata(filePath, count = 20) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`[checkJsonlMetadata] Checking metadata in file: ${filePath}`);
            console.log(`[checkJsonlMetadata] Reading ${count} records`);
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            const records = [];
            let lineCount = 0;
            rl.on('line', (line) => {
                if (lineCount < count) {
                    try {
                        const record = JSON.parse(line);
                        records.push(record);
                        lineCount++;
                    }
                    catch (parseError) {
                        console.error(`[checkJsonlMetadata] Error parsing line ${lineCount + 1}:`, parseError);
                    }
                }
            });
            rl.on('close', () => {
                console.log(`[checkJsonlMetadata] Read ${records.length} records`);
                // レコードの構造を分析
                if (records.length > 0) {
                    // 最初のレコードの構造を表示
                    const firstRecord = records[0];
                    console.log('\n[checkJsonlMetadata] First record structure:');
                    console.log(JSON.stringify(firstRecord, null, 2));
                    // すべてのレコードのフィールドを確認
                    const fields = new Set();
                    records.forEach(record => {
                        Object.keys(record).forEach(key => fields.add(key));
                    });
                    console.log(`\n[checkJsonlMetadata] All fields found in records: ${Array.from(fields).join(', ')}`);
                    // メタデータの有無を確認
                    const hasMetadata = records.some(record => record.metadata);
                    console.log(`[checkJsonlMetadata] Records contain metadata field: ${hasMetadata ? 'Yes' : 'No'}`);
                    // restrictsフィールドの内容を確認
                    const hasRestricts = records.some(record => record.restricts);
                    console.log(`[checkJsonlMetadata] Records contain restricts field: ${hasRestricts ? 'Yes' : 'No'}`);
                    if (hasRestricts) {
                        console.log('\n[checkJsonlMetadata] Restricts field details:');
                        // タイトルの確認
                        const titleRestricts = records.map(record => {
                            if (record.restricts && Array.isArray(record.restricts)) {
                                const titleRestrict = record.restricts.find((r) => r.namespace === 'title');
                                if (titleRestrict && titleRestrict.allow_list && titleRestrict.allow_list.length > 0) {
                                    return titleRestrict.allow_list[0];
                                }
                            }
                            return null;
                        });
                        console.log('- Title restricts:');
                        titleRestricts.forEach((title, index) => {
                            console.log(`  Record #${index + 1}: ${title || 'No title'}`);
                        });
                        // content_typeの確認
                        const contentTypes = records.map(record => {
                            if (record.restricts && Array.isArray(record.restricts)) {
                                const contentTypeRestrict = record.restricts.find((r) => r.namespace === 'content_type');
                                if (contentTypeRestrict && contentTypeRestrict.allow_list && contentTypeRestrict.allow_list.length > 0) {
                                    return contentTypeRestrict.allow_list[0];
                                }
                            }
                            return null;
                        });
                        console.log('- Content type restricts:');
                        const contentTypeSet = new Set(contentTypes.filter(Boolean));
                        console.log(`  Unique content types: ${Array.from(contentTypeSet).join(', ')}`);
                    }
                    // IDフィールドの内容を確認
                    if (records.some(record => record.id)) {
                        console.log('\n[checkJsonlMetadata] ID field details:');
                        const ids = records.map(record => record.id);
                        console.log(`- IDs: ${ids.join(', ')}`);
                        // IDの形式を分析
                        const idPatterns = new Set();
                        ids.forEach(id => {
                            if (id) {
                                const parts = id.split('-');
                                if (parts.length > 1) {
                                    const pattern = `${parts[0]}-...-${parts[parts.length - 1]}`;
                                    idPatterns.add(pattern);
                                }
                                else {
                                    idPatterns.add(id);
                                }
                            }
                        });
                        console.log(`- ID patterns: ${Array.from(idPatterns).join(', ')}`);
                    }
                    // crowding_tagフィールドの内容を確認
                    if (records.some(record => record.crowding_tag)) {
                        console.log('\n[checkJsonlMetadata] Crowding tag field details:');
                        const crowdingTags = records.map(record => record.crowding_tag);
                        console.log(`- Crowding tags: ${crowdingTags.join(', ')}`);
                    }
                    // embeddingフィールドの内容を確認
                    if (records.some(record => record.embedding)) {
                        console.log('\n[checkJsonlMetadata] Embedding field details:');
                        const embeddingLengths = records.map(record => record.embedding ? record.embedding.length : 0);
                        console.log(`- Embedding dimensions: ${embeddingLengths[0]}`);
                        console.log(`- All records have same embedding dimension: ${new Set(embeddingLengths).size === 1 ? 'Yes' : 'No'}`);
                        // embeddingの一部を表示
                        const firstEmbedding = records[0].embedding;
                        if (firstEmbedding && firstEmbedding.length > 0) {
                            console.log(`- First 5 values of first embedding: ${firstEmbedding.slice(0, 5).join(', ')}`);
                        }
                    }
                    // featureVectorフィールドの内容を確認
                    if (records.some(record => record.featureVector)) {
                        console.log('\n[checkJsonlMetadata] Feature vector field details:');
                        const featureVectorLengths = records.map(record => record.featureVector ? record.featureVector.length : 0);
                        console.log(`- Feature vector dimensions: ${featureVectorLengths[0]}`);
                        console.log(`- All records have same feature vector dimension: ${new Set(featureVectorLengths).size === 1 ? 'Yes' : 'No'}`);
                    }
                }
                resolve();
            });
            rl.on('error', (error) => {
                reject(new Error(`Error reading file: ${error}`));
            });
        }
        catch (error) {
            reject(new Error(`Error checking JSONL metadata: ${error}`));
        }
    });
}
/**
 * 一時ファイルを削除する
 *
 * @param filePath 削除するファイルのパス
 */
function cleanupTempFile(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[cleanupTempFile] Deleted temporary file: ${filePath}`);
        }
    }
    catch (error) {
        console.error(`[cleanupTempFile] Error deleting temporary file: ${error}`);
    }
}
/**
 * メイン関数
 */
async function main() {
    let tempFilePath = '';
    try {
        console.log('===== JSONLファイルのメタデータ確認テスト開始 =====');
        // バケット名の設定
        const buckets = [
            '122015916118-vector-search',
            'confluence-copilot-ppjye-vector-search'
        ];
        // 各バケットでテストを実行
        for (const bucketName of buckets) {
            console.log(`\n===== バケット ${bucketName} のテスト =====`);
            try {
                // 最新のJSONLファイルを取得
                const { filePath, content } = await getLatestJsonlFile(bucketName);
                tempFilePath = filePath;
                // JSONLファイルのメタデータを確認
                await checkJsonlMetadata(filePath, 20);
                // 一時ファイルを削除
                cleanupTempFile(filePath);
            }
            catch (bucketError) {
                console.error(`[main] Error testing bucket ${bucketName}:`, bucketError);
            }
        }
        console.log('\n===== JSONLファイルのメタデータ確認テスト完了 =====');
    }
    catch (error) {
        console.error('[main] Error in test execution:', error);
        // エラーが発生した場合も一時ファイルを削除
        if (tempFilePath) {
            cleanupTempFile(tempFilePath);
        }
        process.exit(1);
    }
}
// スクリプト実行
main();
//# sourceMappingURL=test-jsonl-metadata.js.map