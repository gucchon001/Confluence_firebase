/**
 * バッチ更新のテスト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Storage } from '@google-cloud/storage';
import * as vectorSearchBatch from './vector-search-service-batch';

// 環境変数の読み込み
dotenv.config();

/**
 * メイン関数
 */
async function main() {
  try {
    console.log('===== バッチ更新のテスト開始 =====');
    
    // バケット名を取得
    const bucketName = process.env.VERTEX_AI_STORAGE_BUCKET || '122015916118-vector-search';
    
    console.log(`[main] Using GCS bucket: ${bucketName}`);
    
    // バケットが存在するか確認し、なければ作成
    console.log('\n1. GCSバケットの確認/作成');
    // GCS削除済み
    
    // テスト用のデータポイントを作成
    console.log('\n2. テスト用データの作成');
    const testDatapoints = [];
    
    for (let i = 1; i <= 3; i++) {
      const testDatapoint = {
        id: `test-datapoint-batch-${i}`,
        featureVector: Array(768).fill(0).map(() => Math.random() * 2 - 1),
        restricts: [
          {
            namespace: 'title',
            allow_list: [`テストデータポイント${i}`]
          },
          {
            namespace: 'space_key',
            allow_list: ['TEST']
          },
          {
            namespace: 'content_type',
            allow_list: ['test_data']
          }
        ],
        crowding_tag: 'test-datapoint'
      };
      
      testDatapoints.push(testDatapoint);
    }
    
    console.log(`[main] Created ${testDatapoints.length} test datapoints`);
    
    // JSONLファイルを一時的に作成
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const tempFilePath = path.join(tempDir, 'test-batch-datapoints.jsonl');
    const jsonlData = testDatapoints.map(dp => JSON.stringify(dp)).join('\n');
    fs.writeFileSync(tempFilePath, jsonlData);
    
    console.log(`[main] Created temporary JSONL file: ${tempFilePath}`);
    
    // GCSにアップロード
    console.log('\n3. GCSへのJSONLファイルのアップロード');
    
    // 直接ファイルをアップロード
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `test-batch-data-${timestamp}.jsonl`;
    
    const storage = new Storage();
    const bucket = storage.bucket(bucketName);
    await bucket.upload(tempFilePath, {
      destination: filename,
      metadata: {
        contentType: 'application/jsonl'
      }
    });
    
    console.log(`[main] Uploaded file to gs://${bucketName}/${filename}`);
    
    // Vector Searchにバッチアップロード
    console.log('\n4. Vector Searchへのバッチアップロード');
    try {
      await vectorSearchBatch.uploadToVectorSearch(filename, bucketName);
      console.log(`[main] Batch update to Vector Search completed successfully`);
    } catch (error: any) {
      console.error(`[main] Error during batch update: ${error.message}`);
      console.log(`[main] Note: If the error is 404 Not Found, it may indicate that the import method is not available for your Vector Search index or region.`);
      console.log(`[main] Alternative: Use Google Cloud Console to manually import the JSONL file.`);
    }
    
    // 一時ファイルを削除
    try {
      fs.unlinkSync(tempFilePath);
      console.log(`[main] Deleted temporary file: ${tempFilePath}`);
    } catch (error: any) {
      console.warn(`[main] Warning: Failed to delete temporary file: ${error.message}`);
    }
    
    console.log('\n===== バッチ更新のテスト完了 =====');
  } catch (error: any) {
    console.error(`[main] Error: ${error.message}`);
    process.exit(1);
  }
}

// スクリプト実行
main();
