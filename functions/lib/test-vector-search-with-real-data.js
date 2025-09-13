"use strict";
/**
 * 実際のデータを使用したVector Search APIのクエリテスト
 *
 * GCSバケットから実際のデータを取得し、そのベクトルを使用してクエリを実行する
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const google_auth_library_1 = require("google-auth-library");
const storage_1 = require("@google-cloud/storage");
const fs = __importStar(require("fs"));
const readline = __importStar(require("readline"));
/**
 * Google Cloud認証情報を取得する
 *
 * @returns アクセストークン
 */
async function getGoogleCloudToken() {
    try {
        console.log('[getGoogleCloudToken] Starting token acquisition process');
        const auth = new google_auth_library_1.GoogleAuth({
            scopes: 'https://www.googleapis.com/auth/cloud-platform'
        });
        const client = await auth.getClient();
        const token = await client.getAccessToken();
        if (!token || !token.token) {
            throw new Error('Failed to get access token');
        }
        return token.token;
    }
    catch (error) {
        console.error('[getGoogleCloudToken] Error getting Google Cloud token:', error);
        throw new Error(`Failed to get Google Cloud token: ${error.message}`);
    }
}
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
 * JSONLファイルから最初のレコードのベクトルを取得する
 *
 * @param filePath JSONLファイルのパス
 * @returns 最初のレコードのベクトル
 */
async function getFirstRecordVector(filePath) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`[getFirstRecordVector] Getting first record vector from file: ${filePath}`);
            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            let firstLine = '';
            rl.on('line', (line) => {
                if (!firstLine) {
                    firstLine = line;
                    rl.close();
                }
            });
            rl.on('close', () => {
                if (!firstLine) {
                    reject(new Error('File is empty'));
                    return;
                }
                try {
                    const record = JSON.parse(firstLine);
                    // ベクトルフィールドの取得
                    let vector = [];
                    let id = '';
                    if (record.embedding) {
                        vector = record.embedding;
                        console.log(`[getFirstRecordVector] Found 'embedding' field with ${vector.length} dimensions`);
                    }
                    else if (record.featureVector) {
                        vector = record.featureVector;
                        console.log(`[getFirstRecordVector] Found 'featureVector' field with ${vector.length} dimensions`);
                    }
                    else if (record.feature_vector) {
                        vector = record.feature_vector;
                        console.log(`[getFirstRecordVector] Found 'feature_vector' field with ${vector.length} dimensions`);
                    }
                    else {
                        reject(new Error('No vector field found in record'));
                        return;
                    }
                    // IDフィールドの取得
                    if (record.id) {
                        id = record.id;
                        console.log(`[getFirstRecordVector] Found 'id' field: ${id}`);
                    }
                    else if (record.datapoint_id) {
                        id = record.datapoint_id;
                        console.log(`[getFirstRecordVector] Found 'datapoint_id' field: ${id}`);
                    }
                    else {
                        id = 'unknown-id';
                        console.log(`[getFirstRecordVector] No ID field found, using default: ${id}`);
                    }
                    resolve({ vector, id });
                }
                catch (parseError) {
                    reject(new Error(`Error parsing JSON: ${parseError}`));
                }
            });
            rl.on('error', (error) => {
                reject(new Error(`Error reading file: ${error}`));
            });
        }
        catch (error) {
            reject(new Error(`Error getting first record vector: ${error}`));
        }
    });
}
/**
 * Vector Search APIにクエリを実行する（実際のデータを使用）
 *
 * @param vector 実際のデータのベクトル
 * @param id 実際のデータのID
 */
async function queryVectorSearchWithRealData(vector, id) {
    try {
        // 環境変数から設定値を取得
        const projectId = process.env.VERTEX_AI_PROJECT_ID || '122015916118';
        const location = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
        const endpointId = process.env.VERTEX_AI_ENDPOINT_ID || '1435927001503367168';
        const deployedIndexId = process.env.VERTEX_AI_DEPLOYED_INDEX_ID || 'confluence_embeddings_endp_1757347487752';
        // 認証トークンの取得
        const token = await getGoogleCloudToken();
        // エンドポイントURLの構築
        const endpoint = `https://663364514.${location}-${projectId}.vdb.vertexai.goog/v1/projects/${projectId}/locations/${location}/indexEndpoints/${endpointId}:findNeighbors`;
        console.log(`[queryVectorSearchWithRealData] Using endpoint: ${endpoint}`);
        console.log(`[queryVectorSearchWithRealData] Using vector from ID: ${id} (${vector.length} dimensions)`);
        // リクエストボディを構築
        const requestBody = {
            deployedIndexId: deployedIndexId,
            queries: [
                {
                    datapoint: {
                        featureVector: vector.map(Number),
                    },
                    neighborCount: 10,
                    distanceThreshold: 0.0
                },
            ],
        };
        console.log(`[queryVectorSearchWithRealData] Sending request...`);
        // APIリクエストを送信
        const response = await axios_1.default.post(endpoint, requestBody, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        });
        // レスポンスを処理
        console.log('[queryVectorSearchWithRealData] Response status:', response.status);
        console.log('[queryVectorSearchWithRealData] Response data:', JSON.stringify(response.data, null, 2));
        // 結果の詳細を表示
        if (response.data.nearestNeighbors &&
            response.data.nearestNeighbors[0] &&
            response.data.nearestNeighbors[0].neighbors &&
            response.data.nearestNeighbors[0].neighbors.length > 0) {
            const neighbors = response.data.nearestNeighbors[0].neighbors;
            console.log(`[queryVectorSearchWithRealData] Found ${neighbors.length} results`);
            neighbors.forEach((neighbor, index) => {
                console.log(`\nResult #${index + 1}:`);
                console.log(`- ID: ${neighbor.datapoint.id || neighbor.datapoint.datapointId || 'Unknown'}`);
                console.log(`- Distance: ${neighbor.distance}`);
                // restrictsからタイトルを取得（存在する場合）
                if (neighbor.datapoint.restricts && Array.isArray(neighbor.datapoint.restricts)) {
                    const titleRestrict = neighbor.datapoint.restricts.find((r) => r.namespace === 'title');
                    if (titleRestrict && titleRestrict.allow_list && titleRestrict.allow_list.length > 0) {
                        console.log(`- Title: ${titleRestrict.allow_list[0]}`);
                    }
                }
            });
        }
        else {
            console.log('[queryVectorSearchWithRealData] No results found');
        }
    }
    catch (error) {
        console.error('[queryVectorSearchWithRealData] Error querying Vector Search API:', error);
        // エラーの詳細情報を出力
        if (error.response) {
            console.error('[queryVectorSearchWithRealData] API response error:', {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            });
        }
        else if (error.request) {
            console.error('[queryVectorSearchWithRealData] No response received:', error.request);
        }
        else {
            console.error('[queryVectorSearchWithRealData] Request error:', error.message);
        }
    }
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
        console.log('===== 実際のデータを使用したVector Search APIクエリテスト開始 =====');
        // 環境変数の表示
        console.log('環境変数:');
        console.log('- VERTEX_AI_PROJECT_ID:', process.env.VERTEX_AI_PROJECT_ID);
        console.log('- VERTEX_AI_LOCATION:', process.env.VERTEX_AI_LOCATION);
        console.log('- VERTEX_AI_INDEX_ID:', process.env.VERTEX_AI_INDEX_ID);
        console.log('- VERTEX_AI_ENDPOINT_ID:', process.env.VERTEX_AI_ENDPOINT_ID);
        console.log('- VERTEX_AI_DEPLOYED_INDEX_ID:', process.env.VERTEX_AI_DEPLOYED_INDEX_ID);
        console.log('- GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
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
                // 最初のレコードのベクトルを取得
                const { vector, id } = await getFirstRecordVector(filePath);
                // Vector Search APIにクエリを実行
                await queryVectorSearchWithRealData(vector, id);
                // 一時ファイルを削除
                cleanupTempFile(filePath);
            }
            catch (bucketError) {
                console.error(`[main] Error testing bucket ${bucketName}:`, bucketError);
            }
        }
        console.log('\n===== 実際のデータを使用したVector Search APIクエリテスト完了 =====');
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
//# sourceMappingURL=test-vector-search-with-real-data.js.map