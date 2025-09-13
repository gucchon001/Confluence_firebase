/**
 * Google Cloud Storage (GCS) サービス
 */
import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as config from './config';

// Storageクライアントの初期化
const storage = new Storage();

/**
 * GCSバケットが存在するかチェックし、なければ作成する
 * @param bucketName バケット名
 */
export async function ensureBucketExists(bucketName: string): Promise<void> {
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
    } else {
      console.log(`[ensureBucketExists] Bucket ${bucketName} already exists`);
    }
  } catch (error: any) {
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
export async function uploadToGCS(records: any[], bucketName: string): Promise<string> {
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
    const tempFilePath = path.join(os.tmpdir(), `vector-search-data-${uuidv4()}.jsonl`);
    
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
  } catch (error: any) {
    console.error(`[uploadToGCS] Error uploading to GCS: ${error.message}`);
    throw new Error(`Failed to upload to GCS: ${error.message}`);
  }
}
