/**
 * 本番環境のLanceDBデータをCloud Storageにアップロードするスクリプト
 * 
 * 使用方法:
 * ```bash
 * npm run upload:production-data
 * ```
 * 
 * 機能:
 * - Confluenceテーブル（confluence.lance）のアップロード
 * - Jiraテーブル（jira_issues.lance）のアップロード（存在する場合）
 * - Lunrキャッシュ（.cache/lunr-index*.msgpack）のアップロード
 * - 古いバージョンの自動削除（オプション）
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import { connect } from '@lancedb/lancedb';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye';
const LOCAL_LANCEDB_PATH = path.join(process.cwd(), '.lancedb');
const LOCAL_CACHE_PATH = path.join(process.cwd(), '.cache');
const CLEANUP_OLD_VERSIONS = process.env.CLEANUP_OLD_VERSIONS !== 'false'; // デフォルト: true

/**
 * ディレクトリ内の全ファイルを再帰的に取得
 */
function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

/**
 * 古いバージョンのファイルを削除
 */
async function cleanupOldVersions(
  bucket: any,
  tableName: string
): Promise<void> {
  if (!CLEANUP_OLD_VERSIONS) {
    console.log(`   ⏩ クリーンアップをスキップします（CLEANUP_OLD_VERSIONS=false）`);
    return;
  }

  const prefix = `lancedb/${tableName}.lance/`;
  const [files] = await bucket.getFiles({ prefix });

  if (files.length === 0) {
    return;
  }

  console.log(`   🧹 古いバージョンを削除中... (${files.length}ファイル)`);
  
  // バッチで削除（最大1000ファイル/リクエスト）
  const BATCH_SIZE = 1000;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(file => file.delete()));
  }

  console.log(`   ✅ 古いバージョンを削除しました`);
}

/**
 * テーブルをアップロード
 */
async function uploadTable(
  bucket: any,
  tableName: string,
  localTablePath: string
): Promise<number> {
  console.log(`\n📤 テーブル '${tableName}' をアップロード中...`);
  console.log(`   Source: ${localTablePath}`);
  console.log(`   Destination: gs://${BUCKET_NAME}/lancedb/${tableName}.lance/`);

  // 古いバージョンを削除
  await cleanupOldVersions(bucket, tableName);

  // ファイル一覧を取得
  if (!fs.existsSync(localTablePath)) {
    console.log(`   ⚠️  テーブルディレクトリが存在しません: ${localTablePath}`);
    return 0;
  }

  const files = getAllFiles(localTablePath);
  if (files.length === 0) {
    console.log(`   ⚠️  アップロードするファイルがありません`);
    return 0;
  }

  console.log(`   📄 ${files.length}ファイルをアップロード中...`);

  let uploadedCount = 0;
  let errorCount = 0;

  // バッチでアップロード（並列数を制限）
  const BATCH_SIZE = 5;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (filePath) => {
      try {
        const relativePath = path.relative(localTablePath, filePath);
        const gcsPath = `lancedb/${tableName}.lance/${relativePath.replace(/\\/g, '/')}`;
        
        await bucket.upload(filePath, {
          destination: gcsPath,
          metadata: {
            cacheControl: 'public, max-age=3600',
          },
        });

        uploadedCount++;
        if (uploadedCount % 100 === 0 || uploadedCount === files.length) {
          console.log(`   📤 進捗: ${uploadedCount}/${files.length} ファイル`);
        }
      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ アップロードエラー: ${filePath} - ${error.message}`);
      }
    });

    await Promise.all(batchPromises);
  }

  if (errorCount > 0) {
    throw new Error(`${errorCount}ファイルのアップロードに失敗しました`);
  }

  console.log(`   ✅ アップロード完了: ${uploadedCount}ファイル`);
  return uploadedCount;
}

/**
 * Lunrキャッシュをアップロード
 */
async function uploadLunrCache(bucket: any): Promise<number> {
  console.log(`\n📤 Lunrキャッシュをアップロード中...`);

  if (!fs.existsSync(LOCAL_CACHE_PATH)) {
    console.log(`   ⚠️  キャッシュディレクトリが存在しません: ${LOCAL_CACHE_PATH}`);
    return 0;
  }

  // Lunrインデックスファイルを検索
  const cacheFiles = fs.readdirSync(LOCAL_CACHE_PATH).filter(file => 
    file.startsWith('lunr-index') && (file.endsWith('.msgpack') || file.endsWith('.json'))
  );

  if (cacheFiles.length === 0) {
    console.log(`   ⚠️  Lunrキャッシュファイルが見つかりません`);
    return 0;
  }

  console.log(`   📄 ${cacheFiles.length}ファイルをアップロード中...`);

  let uploadedCount = 0;
  for (const file of cacheFiles) {
    try {
      const localFilePath = path.join(LOCAL_CACHE_PATH, file);
      
      // ファイルの存在確認
      if (!fs.existsSync(localFilePath)) {
        console.log(`   ⚠️  ファイルが存在しないためスキップ: ${file}`);
        continue;
      }
      
      const gcsPath = `.cache/${file}`;
      
      await bucket.upload(localFilePath, {
        destination: gcsPath,
        metadata: {
          cacheControl: 'public, max-age=3600',
        },
      });

      uploadedCount++;
      console.log(`   ✅ ${file}`);
    } catch (error: any) {
      console.error(`   ❌ アップロードエラー: ${file} - ${error.message}`);
      // エラーが発生しても他のファイルのアップロードを継続
      // throw error; // コメントアウト: 存在しないファイルはスキップして続行
    }
  }

  console.log(`   ✅ Lunrキャッシュアップロード完了: ${uploadedCount}ファイル`);
  return uploadedCount;
}

async function uploadProductionData(): Promise<void> {
  console.log('='.repeat(80));
  console.log('📤 Production Data Upload to Cloud Storage');
  console.log('='.repeat(80));
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Source: ${LOCAL_LANCEDB_PATH}\n`);

  try {
    // ローカルLanceDBディレクトリの存在確認
    if (!fs.existsSync(LOCAL_LANCEDB_PATH)) {
      throw new Error(`LanceDBディレクトリが存在しません: ${LOCAL_LANCEDB_PATH}`);
    }

    // Cloud Storageクライアントの初期化
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);

    // バケットの存在確認
    const [exists] = await bucket.exists();
    if (!exists) {
      throw new Error(`バケット '${BUCKET_NAME}' が存在しません`);
    }

    // LanceDBに接続してテーブル一覧を取得
    console.log('📊 ローカルのLanceDBテーブルを検出中...\n');
    let tableNames: string[] = [];
    
    try {
      const db = await connect(LOCAL_LANCEDB_PATH);
      tableNames = await db.tableNames();
      console.log(`   ✅ ${tableNames.length}個のテーブルが見つかりました:`);
      tableNames.forEach(name => console.log(`      - ${name}`));
    } catch (error: any) {
      console.warn(`   ⚠️  LanceDBへの接続に失敗しました: ${error.message}`);
      console.warn(`   ⚠️  ディレクトリから直接テーブルを検出します...`);
      
      // ディレクトリから直接検出
      const dirs = fs.readdirSync(LOCAL_LANCEDB_PATH).filter(item => {
        const itemPath = path.join(LOCAL_LANCEDB_PATH, item);
        return fs.statSync(itemPath).isDirectory() && item.endsWith('.lance');
      });
      tableNames = dirs.map(dir => dir.replace('.lance', ''));
      console.log(`   ✅ ${tableNames.length}個のテーブルが見つかりました:`);
      tableNames.forEach(name => console.log(`      - ${name}`));
    }

    // テーブルが見つからない場合（差分がない場合など）は警告として処理
    let totalUploaded = 0;
    if (tableNames.length === 0) {
      console.log('\n⚠️  アップロードするテーブルが見つかりません');
      console.log('   これは正常な状態です（差分がない場合など）');
      console.log('   Lunrキャッシュのアップロードを続行します...\n');
    } else {
      // 各テーブルをアップロード
      for (const tableName of tableNames) {
        const localTablePath = path.join(LOCAL_LANCEDB_PATH, `${tableName}.lance`);
        const count = await uploadTable(bucket, tableName, localTablePath);
        totalUploaded += count;
      }
    }

    // Lunrキャッシュをアップロード
    const cacheCount = await uploadLunrCache(bucket);

    // サマリー
    console.log('\n' + '='.repeat(80));
    console.log('📊 Upload Summary');
    console.log('='.repeat(80));
    console.log(`   ${tableNames.length === 0 ? '⚠️' : '✅'} テーブル数: ${tableNames.length}`);
    if (tableNames.length > 0) {
      console.log(`   ✅ アップロードファイル数: ${totalUploaded}`);
    }
    console.log(`   ✅ Lunrキャッシュファイル数: ${cacheCount}`);
    console.log('='.repeat(80) + '\n');

    if (tableNames.length === 0) {
      console.log('✅ Production data upload completed (no tables to upload, but cache uploaded)!\n');
    } else {
      console.log('✅ Production data upload completed successfully!\n');
    }
    
  } catch (error: any) {
    console.error('\n❌ Error uploading production data:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n   Stack trace:\n${error.stack}`);
    }
    throw error;
  }
}

// スクリプト実行
if (require.main === module) {
  uploadProductionData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { uploadProductionData };

