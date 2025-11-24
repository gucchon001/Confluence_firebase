/**
 * GCS (Google Cloud Storage) へのLunrキャッシュ保存・読み込みヘルパー
 * 
 * 機能:
 * - LunrキャッシュファイルをGCSにアップロード
 * - GCSからLunrキャッシュファイルをダウンロード
 * - 本番環境（Cloud Run）でのみ有効化
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { appConfig } from '../config/app-config';

// GCS設定
const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || appConfig.firebase.projectId || 'confluence-copilot-ppjye';
const GCS_CACHE_PREFIX = '.cache';

/**
 * GCSクライアントを取得（シングルトン）
 */
let gcsClient: Storage | null = null;
function getGCSClient(): Storage | null {
  // 本番環境（Cloud Run）でのみ有効化
  if (!appConfig.deployment.isCloudRun) {
    return null;
  }

  if (!gcsClient) {
    try {
      gcsClient = new Storage({ projectId: PROJECT_ID });
    } catch (error) {
      console.error('[GCSCacheHelper] Failed to initialize GCS client:', error);
      return null;
    }
  }
  return gcsClient;
}

/**
 * LunrキャッシュファイルをGCSにアップロード
 * 
 * @param localFilePath ローカルファイルパス
 * @param tableName テーブル名（confluence, jira_issuesなど）
 * @returns アップロード成功時true
 */
export async function uploadLunrCacheToGCS(
  localFilePath: string,
  tableName: string = 'confluence'
): Promise<boolean> {
  const client = getGCSClient();
  if (!client) {
    // 開発環境ではスキップ
    return false;
  }

  try {
    const bucket = client.bucket(BUCKET_NAME);
    const fileName = path.basename(localFilePath);
    
    // GCSパス: .cache/lunr-index.json または .cache/lunr-index-{tableName}.json
    const gcsPath = `${GCS_CACHE_PREFIX}/${fileName}`;
    
    // ファイルの存在確認
    if (!fs.existsSync(localFilePath)) {
      console.warn(`[GCSCacheHelper] Local file not found: ${localFilePath}`);
      return false;
    }

    await bucket.upload(localFilePath, {
      destination: gcsPath,
      metadata: {
        cacheControl: 'public, max-age=3600',
      },
    });

    console.log(`[GCSCacheHelper] ✅ Uploaded Lunr cache to GCS: ${gcsPath}`);
    return true;
  } catch (error) {
    // エラーが発生しても処理を継続（GCSアップロードはオプション）
    console.warn(`[GCSCacheHelper] Failed to upload Lunr cache to GCS: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * GCSからLunrキャッシュファイルをダウンロード
 * 
 * @param localFilePath ローカルファイルパス（保存先）
 * @param tableName テーブル名（confluence, jira_issuesなど）
 * @returns ダウンロード成功時true
 */
export async function downloadLunrCacheFromGCS(
  localFilePath: string,
  tableName: string = 'confluence'
): Promise<boolean> {
  const client = getGCSClient();
  if (!client) {
    // 開発環境ではスキップ
    return false;
  }

  try {
    const bucket = client.bucket(BUCKET_NAME);
    const fileName = path.basename(localFilePath);
    
    // GCSパス: .cache/lunr-index.json または .cache/lunr-index-{tableName}.json
    const gcsPath = `${GCS_CACHE_PREFIX}/${fileName}`;
    
    const file = bucket.file(gcsPath);
    
    // ファイルの存在確認
    const [exists] = await file.exists();
    if (!exists) {
      console.log(`[GCSCacheHelper] GCS file not found: ${gcsPath}`);
      return false;
    }

    // ローカルディレクトリの準備
    const localDir = path.dirname(localFilePath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }

    // ダウンロード
    await file.download({ destination: localFilePath });
    
    console.log(`[GCSCacheHelper] ✅ Downloaded Lunr cache from GCS: ${gcsPath} -> ${localFilePath}`);
    return true;
  } catch (error) {
    // エラーが発生しても処理を継続（GCSダウンロードはオプション）
    console.warn(`[GCSCacheHelper] Failed to download Lunr cache from GCS: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * GCSからLunrキャッシュファイルを検索（MessagePackとJSONの両方を試す）
 * 
 * @param cacheDir ローカルキャッシュディレクトリ
 * @param tableName テーブル名（confluence, jira_issuesなど）
 * @returns ダウンロード成功時true
 */
export async function tryDownloadLunrCacheFromGCS(
  cacheDir: string,
  tableName: string = 'confluence'
): Promise<boolean> {
  const client = getGCSClient();
  if (!client) {
    // 開発環境ではスキップ
    return false;
  }

  try {
    const bucket = client.bucket(BUCKET_NAME);
    
    // ファイル名のパターンを生成
    const baseFileName = tableName === 'confluence' 
      ? 'lunr-index'
      : `lunr-index-${tableName}`;
    
    // MessagePack形式を優先的に試す
    const msgpackFileName = `${baseFileName}.msgpack`;
    const msgpackPath = path.join(cacheDir, msgpackFileName);
    const msgpackGcsPath = `${GCS_CACHE_PREFIX}/${msgpackFileName}`;
    
    const msgpackFile = bucket.file(msgpackGcsPath);
    const [msgpackExists] = await msgpackFile.exists();
    
    if (msgpackExists) {
      const localDir = path.dirname(msgpackPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      await msgpackFile.download({ destination: msgpackPath });
      console.log(`[GCSCacheHelper] ✅ Downloaded MessagePack cache from GCS: ${msgpackGcsPath}`);
      return true;
    }

    // JSON形式を試す
    const jsonFileName = `${baseFileName}.json`;
    const jsonPath = path.join(cacheDir, jsonFileName);
    const jsonGcsPath = `${GCS_CACHE_PREFIX}/${jsonFileName}`;
    
    const jsonFile = bucket.file(jsonGcsPath);
    const [jsonExists] = await jsonFile.exists();
    
    if (jsonExists) {
      const localDir = path.dirname(jsonPath);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      await jsonFile.download({ destination: jsonPath });
      console.log(`[GCSCacheHelper] ✅ Downloaded JSON cache from GCS: ${jsonGcsPath}`);
      return true;
    }

    console.log(`[GCSCacheHelper] No cache found in GCS for table: ${tableName}`);
    return false;
  } catch (error) {
    // エラーが発生しても処理を継続（GCSダウンロードはオプション）
    console.warn(`[GCSCacheHelper] Failed to download Lunr cache from GCS: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

