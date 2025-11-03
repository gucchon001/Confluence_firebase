/**
 * Cloud Storage上の古いLanceDBファイルをクリーンアップするスクリプト
 * 
 * 目的: pageIdスキーマの古いファイルを削除し、page_idスキーマの最新ファイルのみを残す
 * 
 * 注意: このスクリプトは破壊的な操作を行います。実行前にバックアップを確認してください。
 * 
 * 使用方法:
 * ```bash
 * npm run cleanup:old-lancedb-files
 * ```
 */

import { Storage } from '@google-cloud/storage';
import * as path from 'path';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'
});

const bucketName = process.env.STORAGE_BUCKET || 'confluence-copilot-data';
const bucket = storage.bucket(bucketName);

interface FileInfo {
  name: string;
  size: number;
  updated: Date;
  metadata?: any;
}

/**
 * 最新のマイグレーション済みデータベースを識別する
 * 
 * 基準:
 * - 最新更新日時（2025-11-02以降）
 * - ファイル数（20-30ファイル程度が正常）
 * - データファイルとインデックスファイルの存在
 */
async function identifyLatestDatabase() {
  const prefix = 'lancedb/confluence.lance/';
  const [files] = await bucket.getFiles({ prefix });

  // カテゴリ別に整理
  const fileMap = new Map<string, FileInfo[]>();
  
  files.forEach(file => {
    const relativePath = file.name.replace(prefix, '');
    const parts = relativePath.split('/');
    const category = parts[0] || 'root';
      
    if (!fileMap.has(category)) {
      fileMap.set(category, []);
      }
      
    fileMap.get(category)!.push({
      name: file.name,
      size: parseInt(file.metadata.size || '0', 10),
      updated: new Date(file.metadata.updated || file.metadata.timeCreated || Date.now()),
      metadata: file.metadata
    });
  });

  // 最新更新日時を確認
  const allFiles = Array.from(fileMap.values()).flat();
  const latestUpdate = allFiles.reduce((latest, f) => 
    f.updated > latest ? f.updated : latest, new Date(0)
  );

  // マイグレーション実行日時（2025-11-02）以降のファイルを識別
  const migrationDate = new Date('2025-11-02T00:00:00Z');
  
  // 最新のファイルセットを識別
  const recentFiles = allFiles.filter(f => f.updated >= migrationDate);
  const oldFiles = allFiles.filter(f => f.updated < migrationDate);

  return {
    allFiles,
    recentFiles,
    oldFiles,
    latestUpdate,
    fileMap
  };
}

async function cleanupOldLanceDBFiles() {
  console.log('🧹 Cloud Storage上の古いLanceDBファイルをクリーンアップ中...\n');
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'}\n`);

  try {
    // 最新のデータベースを識別
    console.log('🔍 最新のデータベースを識別中...\n');
    const { allFiles, recentFiles, oldFiles, latestUpdate, fileMap } = await identifyLatestDatabase();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 分析結果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📁 総ファイル数: ${allFiles.length}`);
    console.log(`📅 最新更新日時: ${latestUpdate.toISOString()}`);
    console.log(`✅ 最新ファイル（2025-11-02以降）: ${recentFiles.length}`);
    console.log(`🗑️  古いファイル（2025-11-02以前）: ${oldFiles.length}\n`);

    // カテゴリ別の古いファイル数
    console.log('📋 カテゴリ別の古いファイル数:');
    for (const [category, fileList] of Array.from(fileMap.entries()).sort()) {
      const categoryOldFiles = fileList.filter(f => f.updated < new Date('2025-11-02T00:00:00Z'));
      if (categoryOldFiles.length > 0) {
        const categorySize = categoryOldFiles.reduce((sum, f) => sum + f.size, 0);
        console.log(`   - ${category}/: ${categoryOldFiles.length}ファイル (${formatBytes(categorySize)})`);
      }
    }
    console.log('');

    // 削除対象の確認
    if (oldFiles.length === 0) {
      console.log('✅ 古いファイルは見つかりませんでした。クリーンアップ不要です。\n');
      return;
    }

    const totalOldSize = oldFiles.reduce((sum, f) => sum + f.size, 0);
    console.log(`⚠️  削除対象: ${oldFiles.length}ファイル (${formatBytes(totalOldSize)})\n`);

    // 確認メッセージ
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  重要な警告');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('この操作は破壊的です。以下のファイルが削除されます:');
    console.log(`   - 総ファイル数: ${oldFiles.length}`);
    console.log(`   - 総サイズ: ${formatBytes(totalOldSize)}\n`);
    console.log('削除を続行しますか？ (yes/no)');
    console.log('（実際の削除は実装されていません。安全のため手動で削除してください）\n');

    // 実際の削除は行わない（安全のため）
    // 代わりに、削除すべきファイルのリストを表示
    console.log('📋 削除すべきファイル（サンプル、最初の10件）:');
    oldFiles
      .sort((a, b) => a.updated.getTime() - b.updated.getTime())
      .slice(0, 10)
      .forEach((file, index) => {
        console.log(`   ${index + 1}. ${file.name}`);
        console.log(`      - サイズ: ${formatBytes(file.size)}`);
        console.log(`      - 更新日時: ${file.updated.toISOString()}`);
      });

    if (oldFiles.length > 10) {
      console.log(`   ... 他${oldFiles.length - 10}ファイル\n`);
    }

    console.log('\n💡 推奨アクション:');
    console.log('   1. Cloud Consoleで古いファイルを手動で削除');
    console.log('      → https://console.cloud.google.com/storage/browser/confluence-copilot-data/lancedb');
    console.log('   2. または、gcloudコマンドで一括削除');
    console.log(`      → gcloud storage rm gs://${bucketName}/lancedb/confluence.lance/_transactions/*.txn`);
    console.log('   3. 最新のデータベースを再アップロード');
    console.log('      → npm run upload:production-data\n');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error('   スタック:', error.stack);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// スクリプト実行
if (require.main === module) {
  cleanupOldLanceDBFiles()
    .then(() => {
      console.log('✅ スクリプト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプトエラー:', error);
      process.exit(1);
    });
}

export { cleanupOldLanceDBFiles };

