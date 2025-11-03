/**
 * Cloud Storage上のLanceDBデータベースの状態を確認するスクリプト
 * 
 * 目的: 古いpageIdスキーマのファイルが残っていないか確認
 * 
 * 使用方法:
 * ```bash
 * npm run check:cloud-storage-lancedb
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

async function checkCloudStorageLanceDB() {
  console.log('🔍 Cloud Storage上のLanceDBデータベースの状態を確認中...\n');
  console.log(`📦 Bucket: ${bucketName}`);
  console.log(`🌍 Project: ${process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye'}\n`);

  try {
    // LanceDBデータのディレクトリを確認
    const prefix = 'lancedb/confluence.lance/';
    console.log(`📂 検索パス: ${prefix}\n`);

    const [files] = await bucket.getFiles({ prefix });
    
    if (files.length === 0) {
      console.log('⚠️ LanceDBデータベースファイルが見つかりませんでした');
      console.log('   → データベースがアップロードされていない可能性があります\n');
      return;
    }

    console.log(`📊 見つかったファイル数: ${files.length}\n`);

    // ファイルを整理
    const fileMap = new Map<string, FileInfo[]>();
    
    files.forEach(file => {
      const relativePath = file.name.replace(prefix, '');
      const parts = relativePath.split('/');
      const category = parts[0] || 'root';
      
      if (!fileMap.has(category)) {
        fileMap.set(category, []);
      }
      
      fileMap.get(category)!.push({
        name: relativePath,
        size: parseInt(file.metadata.size || '0', 10),
        updated: new Date(file.metadata.updated || file.metadata.timeCreated || Date.now()),
        metadata: file.metadata
      });
    });

    // カテゴリ別に表示
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ファイル構造');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let totalSize = 0;
    let latestUpdate = new Date(0);

    for (const [category, fileList] of Array.from(fileMap.entries()).sort()) {
      const categorySize = fileList.reduce((sum, f) => sum + f.size, 0);
      totalSize += categorySize;
      
      const categoryLatest = fileList.reduce((latest, f) => 
        f.updated > latest ? f.updated : latest, new Date(0)
      );
      if (categoryLatest > latestUpdate) {
        latestUpdate = categoryLatest;
      }

      console.log(`📁 ${category}/ (${fileList.length}ファイル, ${formatBytes(categorySize)})`);
      
      // 最新更新日時を表示
      if (categoryLatest.getTime() > 0) {
        console.log(`   📅 最新更新: ${categoryLatest.toISOString()}`);
      }
      
      // 主要ファイルを表示
      if (category === 'data' || category === '_indices') {
        const topFiles = fileList
          .sort((a, b) => b.size - a.size)
          .slice(0, 3);
        
        topFiles.forEach(file => {
          console.log(`   - ${path.basename(file.name)} (${formatBytes(file.size)})`);
        });
        
        if (fileList.length > 3) {
          console.log(`   ... 他${fileList.length - 3}ファイル`);
        }
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 サマリー');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`📁 総ファイル数: ${files.length}`);
    console.log(`💾 総サイズ: ${formatBytes(totalSize)}`);
    console.log(`📅 最新更新日時: ${latestUpdate.toISOString()}`);
    
    // ファイル数から判断
    console.log('\n🔍 スキーマ確認:');
    if (files.length >= 20) {
      console.log('   ✅ 十分なファイル数が存在します（インデックスを含む）');
    } else {
      console.log('   ⚠️ ファイル数が少ない可能性があります');
    }

    // 最新更新日時の確認
    const hoursSinceUpdate = (Date.now() - latestUpdate.getTime()) / (1000 * 60 * 60);
    console.log(`\n📅 最終更新から経過時間: ${hoursSinceUpdate.toFixed(1)}時間`);
    
    if (hoursSinceUpdate < 24) {
      console.log('   ✅ 最近更新されています（page_idスキーマである可能性が高い）');
    } else {
      console.log('   ⚠️ 24時間以上経過しています（古いpageIdスキーマの可能性）');
    }

    // データファイルの存在確認
    const hasDataFiles = fileMap.has('data') && fileMap.get('data')!.length > 0;
    const hasIndices = fileMap.has('_indices') && fileMap.get('_indices')!.length > 0;
    
    console.log('\n📋 データベース構造:');
    console.log(`   - データファイル: ${hasDataFiles ? '✅ 存在' : '❌ 見つかりません'}`);
    console.log(`   - インデックスファイル: ${hasIndices ? '✅ 存在' : '❌ 見つかりません'}`);

    // 推奨アクション
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 推奨アクション');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (hoursSinceUpdate < 24 && hasDataFiles && hasIndices) {
      console.log('✅ Cloud Storage上のデータベースは最新です');
      console.log('   → page_idスキーマのデータベースがアップロードされています');
      console.log('   → 本番環境で正しく動作するはずです\n');
    } else {
      console.log('⚠️ 古いデータベースの可能性があります');
      console.log('   → 以下の手順で最新のデータベースをアップロードしてください:\n');
      console.log('   1. ローカルでデータベースをマイグレーション済みであることを確認');
      console.log('      → npm run prepare:production');
      console.log('   2. マイグレーション済みデータベースをCloud Storageにアップロード');
      console.log('      → npm run upload:production-data');
      console.log('   3. デプロイを再実行（またはインスタンスを再起動）\n');
    }

    // スキーマの直接確認は難しいため、推奨事項を表示
    console.log('💡 注意: Cloud Storage上のファイル名からはスキーマを直接確認できません');
    console.log('   → データベースファイルをダウンロードしてスキーマを確認する必要があります');
    console.log('   → または、本番環境でスキーマエラーが発生するかどうかで判断できます\n');

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
  checkCloudStorageLanceDB()
    .then(() => {
      console.log('✅ スクリプト完了');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ スクリプトエラー:', error);
      process.exit(1);
    });
}

export { checkCloudStorageLanceDB };

