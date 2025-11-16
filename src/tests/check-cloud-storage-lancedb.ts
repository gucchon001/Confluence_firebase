/**
 * Cloud Storage上のLanceDBデータを確認するスクリプト
 * 
 * 本番環境のCloud Storageに保存されているLanceDBデータの存在と状態を確認します。
 * 
 * 実行方法:
 *   npm run check:cloud-storage-lancedb
 *   または
 *   npx tsx src/tests/check-cloud-storage-lancedb.ts
 */

import { Storage } from '@google-cloud/storage';
import * as path from 'path';

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from './test-helpers/env-loader';
loadTestEnv();

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye';
const GCS_LANCEDB_PATH = 'lancedb/confluence.lance';

interface CloudStorageCheckResult {
  success: boolean;
  bucketExists: boolean;
  filesFound: number;
  totalSize: number;
  latestUpdate?: string;
  errors: string[];
}

async function checkCloudStorageLanceDB(): Promise<CloudStorageCheckResult> {
  const result: CloudStorageCheckResult = {
    success: false,
    bucketExists: false,
    filesFound: 0,
    totalSize: 0,
    errors: []
  };

  console.log('='.repeat(60));
  console.log('🔍 Cloud Storage LanceDBデータ確認');
  console.log('='.repeat(60));
  console.log(`📦 バケット: ${BUCKET_NAME}`);
  console.log(`📂 パス: ${GCS_LANCEDB_PATH}`);
  console.log(`🔑 プロジェクト: ${PROJECT_ID}`);
  console.log('');

  try {
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);

    // バケットの存在確認
    console.log('📋 バケットの存在確認中...');
    const [exists] = await bucket.exists();
    result.bucketExists = exists;

    if (!exists) {
      result.errors.push(`バケット '${BUCKET_NAME}' が存在しません`);
      console.log(`❌ バケット '${BUCKET_NAME}' が存在しません`);
      return result;
    }

    console.log(`✅ バケット '${BUCKET_NAME}' が存在します`);
    console.log('');

    // ファイル一覧の取得
    console.log('📥 ファイル一覧を取得中...');
    const [files] = await bucket.getFiles({ prefix: GCS_LANCEDB_PATH });

    if (files.length === 0) {
      result.errors.push(`パス '${GCS_LANCEDB_PATH}' にファイルが見つかりません`);
      console.log(`❌ パス '${GCS_LANCEDB_PATH}' にファイルが見つかりません`);
      return result;
    }

    result.filesFound = files.length;
    console.log(`✅ ${files.length}個のファイルが見つかりました`);
    console.log('');

    // ファイルサイズの合計と最新更新日時を計算
    let totalSize = 0;
    let latestUpdate: Date | null = null;

    console.log('📊 ファイル情報を取得中...');
    for (const file of files) {
      try {
        const [metadata] = await file.getMetadata();
        const size = parseInt(metadata.size || '0', 10);
        totalSize += size;

        const updated = new Date(metadata.updated || metadata.timeCreated || '');
        if (!latestUpdate || updated > latestUpdate) {
          latestUpdate = updated;
        }
      } catch (error: any) {
        result.errors.push(`ファイル '${file.name}' のメタデータ取得に失敗: ${error.message}`);
      }
    }

    result.totalSize = totalSize;
    result.latestUpdate = latestUpdate?.toISOString();

    // 結果表示
    console.log('📊 確認結果:');
    console.log('-'.repeat(60));
    console.log(`✅ バケット: ${BUCKET_NAME}`);
    console.log(`✅ ファイル数: ${result.filesFound.toLocaleString()}個`);
    console.log(`✅ 合計サイズ: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
    if (latestUpdate) {
      console.log(`✅ 最新更新: ${latestUpdate.toISOString()}`);
    }
    console.log('');

    // 主要ファイルの確認
    const manifestFiles = files.filter(f => f.name.includes('.manifest'));
    const dataFiles = files.filter(f => 
      f.name.endsWith('.lance') && 
      !f.name.includes('_versions') &&
      !f.name.includes('manifest')
    );

    console.log('📋 ファイル種別:');
    console.log(`   - データファイル: ${dataFiles.length}個`);
    console.log(`   - マニフェストファイル: ${manifestFiles.length}個`);
    console.log('');

    if (dataFiles.length === 0) {
      result.errors.push('データファイル（.lance）が見つかりません');
      console.log('⚠️  データファイル（.lance）が見つかりません');
    } else {
      console.log('✅ データファイルが存在します');
    }

    if (manifestFiles.length === 0) {
      result.errors.push('マニフェストファイルが見つかりません');
      console.log('⚠️  マニフェストファイルが見つかりません');
    } else {
      console.log('✅ マニフェストファイルが存在します');
    }

    result.success = result.errors.length === 0;

    if (result.success) {
      console.log('');
      console.log('='.repeat(60));
      console.log('✅ Cloud Storage上のLanceDBデータは正常です');
      console.log('='.repeat(60));
    } else {
      console.log('');
      console.log('='.repeat(60));
      console.log('⚠️  Cloud Storage上のLanceDBデータに問題があります');
      console.log('='.repeat(60));
      console.log('エラー:');
      result.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }

    return result;
  } catch (error: any) {
    result.errors.push(`予期しないエラー: ${error.message}`);
    console.error('❌ エラーが発生しました:', error);
    return result;
  }
}

// メイン実行
if (require.main === module) {
  checkCloudStorageLanceDB()
    .then((result) => {
      if (result.success) {
        process.exit(0);
      } else {
        console.error('❌ チェックが失敗しました');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

export { checkCloudStorageLanceDB };

