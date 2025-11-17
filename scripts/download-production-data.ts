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
const GCS_LANCEDB_PATH = 'lancedb/confluence.lance';
const LOCAL_LANCEDB_PATH = path.join(process.cwd(), '.lancedb');

async function downloadProductionData(): Promise<void> {
  console.log('='.repeat(80));
  console.log('📥 Production Data Download from Cloud Storage');
  console.log('='.repeat(80));
  console.log(`   Bucket: ${BUCKET_NAME}`);
  console.log(`   Source: ${GCS_LANCEDB_PATH}`);
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

    // GCSからLanceDBファイルをダウンロード
    console.log('📥 Downloading files from Cloud Storage...\n');
    const [files] = await bucket.getFiles({ prefix: GCS_LANCEDB_PATH + '/' });

    if (files.length === 0) {
      throw new Error(`No files found at ${GCS_LANCEDB_PATH}/`);
    }

    console.log(`   Found ${files.length} files to download\n`);

    // リトライ機能付きダウンロード
    const downloadWithRetry = async (file: any, maxRetries: number = 3): Promise<boolean> => {
      const relativePath = file.name.replace(GCS_LANCEDB_PATH + '/', '');
      const localFilePath = path.join(LOCAL_LANCEDB_PATH, 'confluence.lance', relativePath);
      
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
            const relativePath = file.name.replace(GCS_LANCEDB_PATH + '/', '');
            console.log(`   ✅ ${relativePath}`);
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
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 Download Summary');
    console.log('='.repeat(80));
    console.log(`   ✅ Downloaded: ${downloadedCount} files`);
    console.log(`   ⏩ Skipped: ${skippedCount} files`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount} files`);
    }
    console.log('='.repeat(80) + '\n');

    if (errorCount > 0) {
      throw new Error(`Failed to download ${errorCount} file(s)`);
    }

    // ダウンロード完了の確認
    const downloadedFiles = fs.readdirSync(path.join(LOCAL_LANCEDB_PATH, 'confluence.lance'));
    if (downloadedFiles.length === 0) {
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

