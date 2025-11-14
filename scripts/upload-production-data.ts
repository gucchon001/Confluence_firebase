/**
 * Production データを Cloud Storage にアップロードするスクリプト
 * 
 * 改善: アップロード前に古いLanceDBバージョンを削除して、最新バージョンのみを保持
 * 環境変数 CLEANUP_OLD_VERSIONS=false でクリーンアップを無効化可能
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

// クリーンアップを有効化するか（デフォルト: true）
const CLEANUP_OLD_VERSIONS = process.env.CLEANUP_OLD_VERSIONS !== 'false';

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

/**
 * 古いLanceDBバージョンを削除
 * アップロード前に実行して、最新バージョンのみを保持
 */
async function cleanupOldVersions(): Promise<void> {
  if (!CLEANUP_OLD_VERSIONS) {
    console.log('⏩ クリーンアップをスキップします (CLEANUP_OLD_VERSIONS=false)');
    return;
  }

  console.log('🧹 古いLanceDBバージョンを削除中...');
  console.log('   ⚠️  注意: この操作により、過去のバージョンに戻れなくなります');
  console.log('');

  const prefix = 'lancedb/confluence.lance/';
  
  try {
    const [files] = await bucket.getFiles({ prefix });
    
    if (files.length === 0) {
      console.log('✅ 削除対象のファイルが見つかりませんでした\n');
      return;
    }

    console.log(`📊 削除対象: ${files.length}ファイル`);
    
    // ファイルサイズを計算
    let totalSize = 0;
    for (const file of files) {
      const size = parseInt(String(file.metadata.size || '0'), 10);
      totalSize += size;
    }
    console.log(`💾 削除サイズ: ${formatBytes(totalSize)}\n`);

    // ファイルを削除
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const file of files) {
      try {
        await file.delete();
        deletedCount++;
      } catch (error) {
        errorCount++;
        console.error(`❌ 削除失敗: ${file.name}`, error);
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 削除結果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ 削除成功: ${deletedCount}ファイル`);
    if (errorCount > 0) {
      console.log(`❌ 削除失敗: ${errorCount}ファイル`);
    }
    console.log(`💾 削除サイズ: ${formatBytes(totalSize)}`);
    console.log('✅ 古いバージョンの削除が完了しました\n');

  } catch (error) {
    console.error('❌ クリーンアップ中にエラーが発生しました:', error);
    throw error;
  }
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
    // アップロード前に古いバージョンを削除（最新バージョンのみを保持）
    await cleanupOldVersions();

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

