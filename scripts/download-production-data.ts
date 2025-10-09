/**
 * 本番環境用データダウンロードスクリプト
 * Cloud Storageから必要なデータをダウンロード
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = 'confluence-copilot-ppjye';

interface DownloadTask {
  remotePath: string;
  localPath: string;
  required: boolean;
}

const downloadTasks: DownloadTask[] = [
  {
    remotePath: 'lancedb/confluence.lance',
    localPath: '.lancedb/confluence.lance',
    required: true
  },
  {
    remotePath: 'domain-knowledge-v2/final-domain-knowledge-v2.json',
    localPath: 'data/domain-knowledge-v2/final-domain-knowledge-v2.json',
    required: true
  },
  {
    remotePath: 'domain-knowledge-v2/keyword-lists-v2.json',
    localPath: 'data/domain-knowledge-v2/keyword-lists-v2.json',
    required: true
  },
  {
    remotePath: '.cache/lunr-index.json',
    localPath: '.cache/lunr-index.json',
    required: false
  }
];

async function downloadDirectory(
  storage: Storage,
  remotePath: string,
  localPath: string
): Promise<void> {
  console.log(`📥 Downloading ${remotePath} -> ${localPath}`);
  
  const bucket = storage.bucket(BUCKET_NAME);
  const [files] = await bucket.getFiles({ prefix: remotePath });
  
  if (files.length === 0) {
    console.warn(`⚠️  No files found at ${remotePath}`);
    return;
  }
  
  for (const file of files) {
    const relativePath = file.name.replace(remotePath, '');
    const destPath = path.join(localPath, relativePath);
    const destDir = path.dirname(destPath);
    
    // ディレクトリを作成
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    try {
      await file.download({ destination: destPath });
      // console.log(`  ✓ ${relativePath}`);
    } catch (error) {
      console.error(`  ✗ Failed to download ${file.name}:`, error);
      throw error;
    }
  }
  
  console.log(`✅ Downloaded ${files.length} files`);
}

async function downloadFile(
  storage: Storage,
  remotePath: string,
  localPath: string
): Promise<void> {
  console.log(`📥 Downloading ${remotePath} -> ${localPath}`);
  
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(remotePath);
  
  const [exists] = await file.exists();
  if (!exists) {
    console.warn(`⚠️  File not found: ${remotePath}`);
    return;
  }
  
  const localDir = path.dirname(localPath);
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  
  await file.download({ destination: localPath });
  console.log(`✅ Downloaded`);
}

async function main() {
  console.log('🚀 Starting production data download...');
  console.log(`📦 Bucket: ${BUCKET_NAME}`);
  console.log(`🌍 Project: ${PROJECT_ID}`);
  console.log('');
  
  const storage = new Storage({
    projectId: PROJECT_ID
  });
  
  let hasErrors = false;
  
  for (const task of downloadTasks) {
    try {
      // ディレクトリかファイルかを判定
      if (task.remotePath.endsWith('.lance') || task.remotePath.includes('.lance/')) {
        // LanceDBディレクトリ
        await downloadDirectory(storage, task.remotePath, task.localPath);
      } else if (task.remotePath.endsWith('.json')) {
        // JSONファイル
        await downloadFile(storage, task.remotePath, task.localPath);
      } else {
        // その他のディレクトリ
        await downloadDirectory(storage, task.remotePath, task.localPath);
      }
    } catch (error) {
      console.error(`❌ Failed to download ${task.remotePath}:`, error);
      if (task.required) {
        hasErrors = true;
      }
    }
    console.log('');
  }
  
  if (hasErrors) {
    console.error('❌ Some required files failed to download');
    process.exit(1);
  }
  
  console.log('🎉 All data downloaded successfully!');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main as downloadProductionData };

