/**
 * Cloud Storage上のLanceDBデータを完全にクリーンアップするスクリプト
 * 
 * 目的: 古いデータベースを完全に削除して、最新のデータベースを再アップロードする準備をする
 * 
 * ⚠️ 警告: このスクリプトは破壊的な操作を行います。実行前に必ずバックアップを確認してください。
 * 
 * 使用方法:
 * ```bash
 * npm run cleanup:lancedb-completely -- --execute
 * ```
 */

import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'
});

const bucketName = process.env.STORAGE_BUCKET || 'confluence-copilot-data';
const bucket = storage.bucket(bucketName);

interface DeleteStats {
  deletedFiles: number;
  totalSize: number;
  errors: number;
}

async function cleanupLanceDBCompletely(execute: boolean = false): Promise<DeleteStats> {
  const stats: DeleteStats = {
    deletedFiles: 0,
    totalSize: 0,
    errors: 0
  };

  console.log('🧹 Cloud Storage上のLanceDBデータを完全にクリーンアップ中...\n');
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'}`);
  console.log(`🔍 Mode: ${execute ? 'EXECUTE (実際に削除します)' : 'DRY RUN (削除しません)'}\n`);

  try {
    const prefix = 'lancedb/confluence.lance/';
    console.log(`📂 検索パス: ${prefix}\n`);

    // すべてのファイルを取得
    const [files] = await bucket.getFiles({ prefix });
    
    if (files.length === 0) {
      console.log('✅ LanceDBデータベースファイルが見つかりませんでした。クリーンアップ不要です。\n');
      return stats;
    }

    console.log(`📊 見つかったファイル数: ${files.length}\n`);

    // ファイル情報を整理
    let totalSize = 0;
    const fileInfo = files.map(file => {
      const size = parseInt(String(file.metadata.size || '0'), 10);
      totalSize += size;
      return {
        name: file.name,
        size: size
      };
    });

    stats.totalSize = totalSize;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 削除対象');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📁 総ファイル数: ${files.length}`);
    console.log(`💾 総サイズ: ${formatBytes(totalSize)}\n`);

    // カテゴリ別の内訳を表示
    const categories = new Map<string, { count: number; size: number }>();
    fileInfo.forEach(file => {
      const parts = file.name.replace(prefix, '').split('/');
      const category = parts[0] || 'root';
      
      if (!categories.has(category)) {
        categories.set(category, { count: 0, size: 0 });
      }
      
      const cat = categories.get(category)!;
      cat.count++;
      cat.size += file.size;
    });

    console.log('📋 カテゴリ別の内訳:');
    for (const [category, info] of Array.from(categories.entries()).sort()) {
      console.log(`   - ${category}/: ${info.count}ファイル (${formatBytes(info.size)})`);
    }
    console.log('');

    if (!execute) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('💡 DRY RUNモード');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('実際の削除は行いませんでした。');
      console.log('削除を実行するには、以下のコマンドを実行してください:');
      console.log('   npm run cleanup:lancedb-completely -- --execute\n');
      console.log('⚠️  警告: この操作は不可逆です。実行前に以下を確認してください:');
      console.log('   1. ローカルに最新のデータベースがあること');
      console.log('   2. 最新のデータベースを再アップロードする準備ができていること');
      console.log('   3. 必要に応じてバックアップを取得していること\n');
      return stats;
    }

    // 削除実行
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⚠️  削除実行中');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`${files.length}ファイルを削除します...\n`);

    // バッチ削除（100ファイルずつ）
    const batchSize = 100;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (file) => {
        try {
          await file.delete();
          stats.deletedFiles++;
          
          if (stats.deletedFiles % 500 === 0) {
            console.log(`   📊 進行状況: ${stats.deletedFiles}/${files.length}ファイル削除完了`);
          }
        } catch (error: any) {
          stats.errors++;
          console.error(`   ❌ 削除失敗: ${file.name} - ${error.message}`);
        }
      }));
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 削除結果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`✅ 削除成功: ${stats.deletedFiles}ファイル`);
    console.log(`💾 削除サイズ: ${formatBytes(stats.totalSize)}`);
    if (stats.errors > 0) {
      console.log(`❌ 削除失敗: ${stats.errors}ファイル\n`);
    } else {
      console.log(`✅ すべてのファイルが正常に削除されました\n`);
    }

    console.log('💡 次のステップ:');
    console.log('   1. ローカルの最新データベースを確認');
    console.log('      → npm run prepare:production');
    console.log('   2. 最新データベースをCloud Storageにアップロード');
    console.log('      → npm run upload:production-data');
    console.log('   3. 再デプロイ');
    console.log('      → git push\n');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error('   スタック:', error.stack);
    process.exit(1);
  }

  return stats;
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
  const execute = args.includes('--execute');
  
  (async () => {
    if (execute) {
      console.log('⚠️  警告: この操作は不可逆です！');
      console.log('   実行前に以下を確認してください:');
      console.log('   1. ローカルに最新のデータベースがあること');
      console.log('   2. 最新のデータベースを再アップロードする準備ができていること');
      console.log('   3. 必要に応じてバックアップを取得していること\n');
      console.log('5秒後に削除を開始します...\n');
      
      // 5秒待機（キャンセル機会を提供）
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    await cleanupLanceDBCompletely(execute);
    console.log('✅ スクリプト完了');
    process.exit(0);
  })().catch((error) => {
    console.error('❌ スクリプトエラー:', error);
    process.exit(1);
  });
}

export { cleanupLanceDBCompletely };

