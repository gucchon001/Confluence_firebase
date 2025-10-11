/**
 * Production データを Cloud Storage にアップロードするスクリプト
 */

import { Storage } from '@google-cloud/storage';
import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import * as path from 'path';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'
});

const bucketName = process.env.STORAGE_BUCKET || 'confluence-copilot-data';
const bucket = storage.bucket(bucketName);

interface UploadStats {
  filesUploaded: number;
  totalSize: number;
  errors: number;
}

async function uploadFile(localPath: string, bucketPath: string): Promise<number> {
  try {
    const stat = statSync(localPath);
    console.log(`📤 Uploading ${localPath} -> ${bucketPath} (${formatBytes(stat.size)})`);
    
    await bucket.upload(localPath, {
      destination: bucketPath,
      metadata: {
        cacheControl: 'public, max-age=3600',
        metadata: {
          uploadedAt: new Date().toISOString(),
          originalPath: localPath
        }
      },
    });
    
    console.log(`✅ Uploaded ${bucketPath}`);
    return stat.size;
  } catch (error) {
    console.error(`❌ Failed to upload ${localPath}:`, error);
    throw error;
  }
}

async function uploadDirectory(
  localPath: string,
  bucketPath: string,
  stats: UploadStats
): Promise<void> {
  if (!existsSync(localPath)) {
    console.warn(`⚠️  Directory not found: ${localPath}`);
    return;
  }

  const files = readdirSync(localPath);
  
  for (const file of files) {
    const localFilePath = join(localPath, file);
    const stat = statSync(localFilePath);
    
    if (stat.isDirectory()) {
      await uploadDirectory(localFilePath, `${bucketPath}/${file}`, stats);
    } else {
      try {
        const size = await uploadFile(localFilePath, `${bucketPath}/${file}`);
        stats.filesUploaded++;
        stats.totalSize += size;
      } catch (error) {
        stats.errors++;
        console.error(`Failed to upload ${localFilePath}`);
      }
    }
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function main() {
  console.log('🚀 Starting production data upload...');
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Project: ${process.env.GOOGLE_CLOUD_PROJECT}`);
  console.log('');

  const stats: UploadStats = {
    filesUploaded: 0,
    totalSize: 0,
    errors: 0
  };

  const startTime = Date.now();

  try {
    // LanceDB データをアップロード
    console.log('📥 Uploading LanceDB data...');
    await uploadDirectory('.lancedb/confluence.lance', 'lancedb/confluence.lance', stats);
    console.log('');

    // ドメイン知識をアップロード
    console.log('📥 Uploading domain knowledge...');
    await uploadDirectory('data/domain-knowledge-v2', 'domain-knowledge-v2', stats);
    console.log('');

    // キャッシュをアップロード
    console.log('📥 Uploading cache...');
    await uploadDirectory('.cache', '.cache', stats);
    console.log('');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('🎉 Upload completed!');
    console.log('');
    console.log('📊 Statistics:');
    console.log(`  Files uploaded: ${stats.filesUploaded}`);
    console.log(`  Total size: ${formatBytes(stats.totalSize)}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Duration: ${duration}s`);

    if (stats.errors > 0) {
      console.warn(`⚠️  ${stats.errors} files failed to upload`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

