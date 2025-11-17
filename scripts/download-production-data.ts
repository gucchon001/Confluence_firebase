/**
 * 本番環境のLanceDBデータをCloud Storageからダウンロードするスクリプト
 * 
 * 使用方法:
 * ```bash
 * npm run download:production-data
 * ```
 * 
 * または、ビルド時に自動実行されます（conditional-download.js経由）
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'confluence-copilot-ppjye';
const LOCAL_LANCEDB_PATH = path.join(process.cwd(), '.lancedb');
const LOCAL_CACHE_PATH = path.join(process.cwd(), '.cache');

/**
 * テーブルをダウンロード
 */
async function downloadTable(
  bucket: any,
  tableName: string,
  gcsPrefix: string
): Promise<number> {
  console.log(`\n📥 テーブル '${tableName}' をダウンロード中...`);
  console.log(`   Source: gs://${BUCKET_NAME}/${gcsPrefix}/`);
  console.log(`   Destination: ${path.join(LOCAL_LANCEDB_PATH, `${tableName}.lance`)}\n`);

  const [files] = await bucket.getFiles({ prefix: gcsPrefix + '/' });

  if (files.length === 0) {
    console.log(`   ⚠️  ファイルが見つかりません: ${gcsPrefix}/`);
    return 0;
  }

  console.log(`   📄 ${files.length}ファイルをダウンロード中...`);

  // リトライ機能付きダウンロード
  const downloadWithRetry = async (file: any, maxRetries: number = 3): Promise<boolean> => {
    const relativePath = file.name.replace(gcsPrefix + '/', '');
    const localFilePath = path.join(LOCAL_LANCEDB_PATH, `${tableName}.lance`, relativePath);
    
    // ディレクトリを作成
    const localDir = path.dirname(localFilePath);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    
    // 既に存在する場合はスキップ（オプション）
    if (fs.existsSync(localFilePath)) {
      return false; // ダウンロード不要
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await file.download({ destination: localFilePath });
        return true; // ダウンロード成功
      } catch (error: any) {
        if (attempt === maxRetries) {
          console.error(`  ❌ Failed to download after ${maxRetries} attempts: ${relativePath}`);
          throw error;
        }
        console.log(`  ⚠️  Retry ${attempt}/${maxRetries} for ${relativePath}...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 指数バックオフ
      }
    }
    return false;
  };
  
  let downloadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  // バッチでダウンロード（並列数を制限して接続エラーを防ぐ）
  const BATCH_SIZE = 5;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map(async (file) => {
      try {
        const downloaded = await downloadWithRetry(file);
        if (downloaded) {
          downloadedCount++;
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        errorCount++;
        console.error(`   ❌ ${file.name}: ${error.message}`);
      }
    });
    
    await Promise.all(batchPromises);
    
    // 進捗表示
    if (i + BATCH_SIZE < files.length) {
      console.log(`   Progress: ${Math.min(i + BATCH_SIZE, files.length)}/${files.length} files\n`);
    }
  }

  if (errorCount > 0) {
    throw new Error(`Failed to download ${errorCount} file(s) for table ${tableName}`);
  }

  console.log(`   ✅ ダウンロード完了: ${downloadedCount}ファイル（スキップ: ${skippedCount}ファイル）`);
  return downloadedCount;
}

/**
 * Lunrキャッシュをダウンロード
 */
async function downloadLunrCache(bucket: any): Promise<number> {
  console.log(`\n📥 Lunrキャッシュをダウンロード中...`);

  // キャッシュディレクトリの準備
  if (!fs.existsSync(LOCAL_CACHE_PATH)) {
    fs.mkdirSync(LOCAL_CACHE_PATH, { recursive: true });
  }

  // Lunrインデックスファイルを検索
  const [files] = await bucket.getFiles({ prefix: '.cache/lunr-index' });

  if (files.length === 0) {
    console.log(`   ⚠️  Lunrキャッシュファイルが見つかりません`);
    return 0;
  }

  console.log(`   📄 ${files.length}ファイルをダウンロード中...`);

  let downloadedCount = 0;
  for (const file of files) {
    try {
      const fileName = path.basename(file.name);
      const localFilePath = path.join(LOCAL_CACHE_PATH, fileName);
      
      await file.download({ destination: localFilePath });
      downloadedCount++;
      console.log(`   ✅ ${fileName}`);
    } catch (error: any) {
      console.error(`   ❌ ダウンロードエラー: ${file.name} - ${error.message}`);
      throw error;
    }
  }

  console.log(`   ✅ Lunrキャッシュダウンロード完了: ${downloadedCount}ファイル`);
  return downloadedCount;
}

async function downloadProductionData(): Promise<void> {
  console.log('='.repeat(80));
  console.log('📥 Production Data Download from Cloud Storage');
  console.log('='.repeat(80));
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Project: ${PROJECT_ID}`);
  console.log(`   Destination: ${LOCAL_LANCEDB_PATH}\n`);

  try {
    // ローカルディレクトリの準備
    if (!fs.existsSync(LOCAL_LANCEDB_PATH)) {
      fs.mkdirSync(LOCAL_LANCEDB_PATH, { recursive: true });
      console.log(`✅ Created directory: ${LOCAL_LANCEDB_PATH}\n`);
    }

    // Cloud Storageクライアントの初期化
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);

    // GCSからテーブル一覧を取得
    console.log('📊 Cloud Storageのテーブルを検出中...\n');
    const [allFiles] = await bucket.getFiles({ prefix: 'lancedb/' });
    
    // テーブル名を抽出（lancedb/{tableName}.lance/ の形式）
    const tableNames = new Set<string>();
    allFiles.forEach(file => {
      const match = file.name.match(/^lancedb\/([^\/]+)\.lance\//);
      if (match) {
        tableNames.add(match[1]);
      }
    });

    if (tableNames.size === 0) {
      throw new Error('アップロードされているテーブルが見つかりません');
    }

    console.log(`   ✅ ${tableNames.size}個のテーブルが見つかりました:`);
    const tableNamesArray = Array.from(tableNames);
    tableNamesArray.forEach(name => console.log(`      - ${name}`));
    console.log('');

    // 各テーブルをダウンロード
    let totalDownloaded = 0;
    for (const tableName of tableNames) {
      const gcsPrefix = `lancedb/${tableName}.lance`;
      const count = await downloadTable(bucket, tableName, gcsPrefix);
      totalDownloaded += count;
    }

    // Lunrキャッシュをダウンロード
    const cacheCount = await downloadLunrCache(bucket);

    // サマリー
    console.log('\n' + '='.repeat(80));
    console.log('📊 Download Summary');
    console.log('='.repeat(80));
    console.log(`   ✅ テーブル数: ${tableNames.size}`);
    console.log(`   ✅ ダウンロードファイル数: ${totalDownloaded}`);
    console.log(`   ✅ Lunrキャッシュファイル数: ${cacheCount}`);
    console.log('='.repeat(80) + '\n');

    // ダウンロード完了の確認
    const downloadedTables = fs.readdirSync(LOCAL_LANCEDB_PATH).filter(item => {
      const itemPath = path.join(LOCAL_LANCEDB_PATH, item);
      return fs.statSync(itemPath).isDirectory() && item.endsWith('.lance');
    });

    if (downloadedTables.length === 0) {
      throw new Error('Downloaded directory is empty');
    }

    console.log('✅ Production data download completed successfully!\n');
    
  } catch (error: any) {
    console.error('\n❌ Error downloading production data:');
    console.error(`   ${error.message}`);
    if (error.stack) {
      console.error(`\n   Stack trace:\n${error.stack}`);
    }
    throw error;
  }
}

// スクリプト実行
if (require.main === module) {
  downloadProductionData()
    .then(() => {
      console.log('✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Script failed:', error);
      process.exit(1);
    });
}

export { downloadProductionData };

