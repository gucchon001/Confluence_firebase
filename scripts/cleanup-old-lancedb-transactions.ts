/**
 * Cloud Storage上の古いトランザクションファイルを安全に削除するスクリプト
 * 
 * 目的: 2025-11-02以前の古いトランザクションファイルを削除
 * 
 * 安全性:
 * - トランザクションファイルは履歴のみで、削除しても現在のデータに影響しない
 * - 削除前に確認を要求
 * 
 * 使用方法:
 * ```bash
 * npm run cleanup:old-lancedb-transactions
 * ```
 */

import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'
});

const bucketName = process.env.STORAGE_BUCKET || 'confluence-copilot-data';
const bucket = storage.bucket(bucketName);

interface FileInfo {
  name: string;
  size: number;
  updated: Date;
}

async function cleanupOldTransactions(dryRun: boolean = true) {
  console.log('🧹 Cloud Storage上の古いトランザクションファイルをクリーンアップ中...\n');
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'}`);
  console.log(`🔍 Mode: ${dryRun ? 'DRY RUN (実際の削除は行いません)' : 'DELETE (実際に削除します)'}\n`);

  try {
    const prefix = 'lancedb/confluence.lance/_transactions/';
    const [files] = await bucket.getFiles({ prefix });

    if (files.length === 0) {
      console.log('✅ トランザクションファイルが見つかりませんでした\n');
      return;
    }

    console.log(`📊 見つかったファイル数: ${files.length}\n`);

    // マイグレーション実行日時（2025-11-02）以降のファイルを識別
    const migrationDate = new Date('2025-11-02T00:00:00Z');
    
    const fileList: FileInfo[] = files.map(file => ({
      name: file.name,
      size: parseInt(file.metadata.size || '0', 10),
      updated: new Date(file.metadata.updated || file.metadata.timeCreated || Date.now())
    }));

    const oldFiles = fileList.filter(f => f.updated < migrationDate);
    const recentFiles = fileList.filter(f => f.updated >= migrationDate);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 分析結果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📁 総ファイル数: ${fileList.length}`);
    console.log(`✅ 最新ファイル（2025-11-02以降）: ${recentFiles.length}`);
    console.log(`🗑️  古いファイル（2025-11-02以前）: ${oldFiles.length}`);

    const totalOldSize = oldFiles.reduce((sum, f) => sum + f.size, 0);
    console.log(`📦 削除対象サイズ: ${formatBytes(totalOldSize)}\n`);

    if (oldFiles.length === 0) {
      console.log('✅ 古いトランザクションファイルは見つかりませんでした。クリーンアップ不要です。\n');
      return;
    }

    // サンプル表示
    console.log('📋 削除対象ファイル（サンプル、最初の10件）:');
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

    if (dryRun) {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 DRY RUNモード');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('実際の削除は行いませんでした。');
      console.log('削除を実行するには、以下のコマンドを実行してください:');
      console.log('   npm run cleanup:old-lancedb-transactions -- --execute\n');
    } else {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  削除実行');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`${oldFiles.length}ファイルを削除します...\n`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const file of oldFiles) {
        try {
          await bucket.file(file.name).delete();
          deletedCount++;
          
          if (deletedCount % 100 === 0) {
            console.log(`   📊 進行状況: ${deletedCount}/${oldFiles.length}ファイル削除完了`);
          }
        } catch (error: any) {
          errorCount++;
          console.error(`   ❌ 削除失敗: ${file.name} - ${error.message}`);
        }
      }

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 削除結果');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log(`✅ 削除成功: ${deletedCount}ファイル`);
      if (errorCount > 0) {
        console.log(`❌ 削除失敗: ${errorCount}ファイル\n`);
      } else {
        console.log(`✅ すべてのファイルが正常に削除されました\n`);
      }
    }

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
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  
  cleanupOldTransactions(dryRun)
    .then(() => {
      console.log('✅ スクリプト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプトエラー:', error);
      process.exit(1);
    });
}

export { cleanupOldTransactions };

