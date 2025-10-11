/**
 * Scheduled Confluence Sync - Cloud Functions for Firebase
 * 
 * 定期的にConfluenceからデータを同期し、Cloud Storageにアップロードする
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { Storage } from '@google-cloud/storage';
import { execSync } from 'child_process';
import * as logger from 'firebase-functions/logger';
import * as path from 'path';

const storage = new Storage();
const bucketName = 'confluence-copilot-data';

/**
 * 毎日午前2時（JST）に差分同期を実行
 */
export const dailyDifferentialSync = onSchedule({
  schedule: '0 2 * * *',      // cron: 毎日午前2時（JST）
  timeZone: 'Asia/Tokyo',
  timeoutSeconds: 3600,         // 1時間
  memory: '2GiB',
  region: 'asia-northeast1',
  secrets: [
    'confluence_api_token',
    'gemini_api_key'
  ]
}, async (event) => {
  logger.info('🔄 Starting daily differential sync', {
    scheduleTime: event.scheduleTime,
    jobName: event.jobName
  });

  try {
    // 既存データをダウンロード
    logger.info('📥 Downloading existing data from Cloud Storage...');
    await downloadFromStorage();

    // 差分同期を実行
    logger.info('🔄 Running differential sync...');
    execSync('npm run sync:confluence:differential', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONFLUENCE_API_TOKEN: process.env.CONFLUENCE_API_TOKEN,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        CONFLUENCE_BASE_URL: 'https://giginc.atlassian.net',
        CONFLUENCE_USER_EMAIL: 'kanri@jukust.jp',
        CONFLUENCE_SPACE_KEY: 'CLIENTTOMO'
      },
      stdio: 'inherit'
    });

    // Cloud Storageにアップロード
    logger.info('📤 Uploading data to Cloud Storage...');
    await uploadToStorage();

    logger.info('✅ Daily differential sync completed successfully', {
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Daily differential sync failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
});

/**
 * 毎週日曜日午前3時（JST）に完全同期を実行
 */
export const weeklyFullSync = onSchedule({
  schedule: '0 3 * * 0',        // cron: 毎週日曜日午前3時（JST）
  timeZone: 'Asia/Tokyo',
  timeoutSeconds: 3600,         // 1時間（最大値）
  memory: '4GiB',               // メモリを増やす
  region: 'asia-northeast1',
  secrets: [
    'confluence_api_token',
    'gemini_api_key'
  ]
}, async (event) => {
  logger.info('🔄 Starting weekly full sync', {
    scheduleTime: event.scheduleTime,
    jobName: event.jobName
  });

  try {
    // 完全同期を実行
    logger.info('🔄 Running full sync...');
    execSync('npm run sync:confluence:batch', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONFLUENCE_API_TOKEN: process.env.CONFLUENCE_API_TOKEN,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        CONFLUENCE_BASE_URL: 'https://giginc.atlassian.net',
        CONFLUENCE_USER_EMAIL: 'kanri@jukust.jp',
        CONFLUENCE_SPACE_KEY: 'CLIENTTOMO'
      },
      stdio: 'inherit'
    });

    // Cloud Storageにアップロード
    logger.info('📤 Uploading data to Cloud Storage...');
    await uploadToStorage();

    logger.info('✅ Weekly full sync completed successfully', {
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Weekly full sync failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
});

/**
 * 手動同期トリガー用HTTPエンドポイント
 */
export const manualSync = onRequest({
  region: 'asia-northeast1',
  timeoutSeconds: 3600,
  memory: '2GiB',
  cors: true,
  secrets: [
    'confluence_api_token',
    'gemini_api_key',
    'sync_secret'
  ]
}, async (req, res) => {
  // 認証チェック
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.SYNC_SECRET}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    logger.warn('Unauthorized sync attempt', {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const syncType = req.body?.syncType || 'differential';
  
  if (!['differential', 'full'].includes(syncType)) {
    res.status(400).json({ error: 'Invalid syncType. Use "differential" or "full"' });
    return;
  }

  logger.info(`🔄 Starting manual ${syncType} sync`, {
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  try {
    // 差分同期の場合は既存データをダウンロード
    if (syncType === 'differential') {
      logger.info('📥 Downloading existing data...');
      await downloadFromStorage();
    }

    // 同期を実行
    const syncCommand = syncType === 'full' 
      ? 'npm run sync:confluence:batch'
      : 'npm run sync:confluence:differential';
    
    logger.info(`🔄 Running ${syncType} sync...`);
    execSync(syncCommand, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CONFLUENCE_API_TOKEN: process.env.CONFLUENCE_API_TOKEN,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY,
        CONFLUENCE_BASE_URL: 'https://giginc.atlassian.net',
        CONFLUENCE_USER_EMAIL: 'kanri@jukust.jp',
        CONFLUENCE_SPACE_KEY: 'CLIENTTOMO'
      },
      stdio: 'inherit'
    });

    // Cloud Storageにアップロード
    logger.info('📤 Uploading data to Cloud Storage...');
    await uploadToStorage();

    logger.info(`✅ Manual ${syncType} sync completed successfully`);

    res.status(200).json({
      success: true,
      syncType,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error(`❌ Manual ${syncType} sync failed`, {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Cloud Storageからデータをダウンロード
 */
async function downloadFromStorage(): Promise<void> {
  const bucket = storage.bucket(bucketName);
  
  const directories = [
    { prefix: 'lancedb/confluence.lance/', localPath: '.lancedb/confluence.lance/' },
    { prefix: 'domain-knowledge-v2/', localPath: 'data/domain-knowledge-v2/' },
    { prefix: '.cache/', localPath: '.cache/' }
  ];

  for (const dir of directories) {
    try {
      const [files] = await bucket.getFiles({ prefix: dir.prefix });
      
      if (files.length === 0) {
        logger.warn(`No files found for prefix: ${dir.prefix}`);
        continue;
      }

      logger.info(`Downloading ${files.length} files from ${dir.prefix}...`);
      
      for (const file of files) {
        const localPath = path.join(
          process.cwd(),
          dir.localPath,
          file.name.replace(dir.prefix, '')
        );
        
        await file.download({ destination: localPath });
      }
      
      logger.info(`✅ Downloaded ${dir.prefix}`);
    } catch (error) {
      logger.error(`Failed to download ${dir.prefix}`, { error });
    }
  }
}

/**
 * Cloud Storageにデータをアップロード
 */
async function uploadToStorage(): Promise<void> {
  const bucket = storage.bucket(bucketName);
  
  const directories = [
    { localPath: '.lancedb/confluence.lance', prefix: 'lancedb/confluence.lance/' },
    { localPath: 'data/domain-knowledge-v2', prefix: 'domain-knowledge-v2/' },
    { localPath: '.cache', prefix: '.cache/' }
  ];

  for (const dir of directories) {
    try {
      logger.info(`Uploading ${dir.localPath}...`);
      
      await bucket.upload(dir.localPath, {
        destination: dir.prefix,
        metadata: {
          cacheControl: 'public, max-age=3600',
          metadata: {
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      logger.info(`✅ Uploaded ${dir.localPath}`);
    } catch (error) {
      logger.error(`Failed to upload ${dir.localPath}`, { error });
      throw error;
    }
  }
}

/**
 * ヘルスチェック用エンドポイント
 */
export const syncStatus = onRequest({
  region: 'asia-northeast1',
  cors: true
}, async (req, res) => {
  const bucket = storage.bucket(bucketName);
  
  try {
    // 最終更新日時を取得
    const [files] = await bucket.getFiles({
      prefix: 'lancedb/confluence.lance/_versions.json',
      maxResults: 1
    });
    
    if (files.length === 0) {
      res.status(200).json({
        status: 'no-data',
        message: 'No sync data found'
      });
      return;
    }
    
    const file = files[0];
    const [metadata] = await file.getMetadata();
    
    res.status(200).json({
      status: 'ok',
      lastSync: metadata.updated,
      size: metadata.size,
      name: metadata.name
    });
  } catch (error) {
    logger.error('Failed to get sync status', { error });
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

