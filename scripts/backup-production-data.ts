/**
 * 本番環境のデータをバックアップ・アーカイブするスクリプト
 * Cloud Storageの現在のデータをアーカイブディレクトリにコピー
 */

import { Storage } from '@google-cloud/storage';
import * as path from 'path';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'
});

const bucketName = process.env.STORAGE_BUCKET || 'confluence-copilot-data';
const bucket = storage.bucket(bucketName);

interface BackupStats {
  filesBackedUp: number;
  totalSize: number;
  errors: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

async function copyFile(sourcePath: string, destPath: string, stats: BackupStats): Promise<void> {
  try {
    const sourceFile = bucket.file(sourcePath);
    const [exists] = await sourceFile.exists();
    
    if (!exists) {
      console.warn(`⚠️  Source file not found: ${sourcePath}`);
      return;
    }
    
    const [metadata] = await sourceFile.getMetadata();
    const size = parseInt(metadata.size || '0', 10);
    
    // ファイルをコピー
    await sourceFile.copy(bucket.file(destPath));
    
    stats.filesBackedUp++;
    stats.totalSize += size;
    
    console.log(`  ✅ ${sourcePath} -> ${destPath} (${formatBytes(size)})`);
  } catch (error) {
    stats.errors++;
    console.error(`  ❌ Failed to copy ${sourcePath}:`, error);
  }
}

async function copyDirectory(
  sourcePrefix: string,
  destPrefix: string,
  stats: BackupStats
): Promise<void> {
  console.log(`📁 Copying directory: ${sourcePrefix} -> ${destPrefix}`);
  
  const [files] = await bucket.getFiles({ prefix: sourcePrefix });
  
  if (files.length === 0) {
    console.warn(`⚠️  No files found at ${sourcePrefix}`);
    return;
  }
  
  console.log(`   Found ${files.length} files`);
  
  for (const file of files) {
    const relativePath = file.name.replace(sourcePrefix, '').replace(/^\//, '');
    const destPath = path.join(destPrefix, relativePath).replace(/\\/g, '/');
    
    await copyFile(file.name, destPath, stats);
  }
  
  console.log(`   ✅ Copied ${files.length} files\n`);
}

async function main() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '_' + 
                   new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
  const archivePath = `archive/lancedb-backup-${timestamp}`;
  
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   本番環境データバックアップ・アーカイブスクリプト                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Project: ${process.env.GOOGLE_CLOUD_PROJECT}`);
  console.log(`📂 Archive Path: ${archivePath}`);
  console.log(`📅 Timestamp: ${timestamp}\n`);
  
  const stats: BackupStats = {
    filesBackedUp: 0,
    totalSize: 0,
    errors: 0
  };
  
  const startTime = Date.now();
  
  try {
    // LanceDBデータをバックアップ
    console.log('📥 Backing up LanceDB data...');
    await copyDirectory(
      'lancedb/confluence.lance/',
      `${archivePath}/lancedb/confluence.lance/`,
      stats
    );
    
    // ドメイン知識をバックアップ
    console.log('📥 Backing up domain knowledge...');
    await copyDirectory(
      'domain-knowledge-v2/',
      `${archivePath}/domain-knowledge-v2/`,
      stats
    );
    
    // キャッシュをバックアップ（オプション）
    console.log('📥 Backing up cache...');
    await copyDirectory(
      '.cache/',
      `${archivePath}/.cache/`,
      stats
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('═══════════════════════════════════════════════════════════════\n');
    console.log('🎉 Backup completed!');
    console.log('');
    console.log('📊 Statistics:');
    console.log(`  Files backed up: ${stats.filesBackedUp}`);
    console.log(`  Total size: ${formatBytes(stats.totalSize)}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Duration: ${duration}s`);
    console.log(`  Archive path: ${archivePath}\n`);
    
    if (stats.errors > 0) {
      console.warn(`⚠️  ${stats.errors} files failed to backup`);
      process.exit(1);
    }
    
    console.log('✅ バックアップが正常に完了しました');
    console.log(`📂 アーカイブ場所: gs://${bucketName}/${archivePath}\n`);
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as backupProductionData };

