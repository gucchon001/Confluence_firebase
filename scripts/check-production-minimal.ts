/**
 * 最小限のダウンロードで本番データの型を確認
 * 1つのデータファイルのみをダウンロードしてスキーマをチェック
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';
import { existsSync, mkdirSync, rmSync } from 'fs';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = 'confluence-copilot-ppjye';
const GCS_LANCEDB_PATH = 'lancedb/confluence.lance';
const TEMP_DOWNLOAD_DIR = path.resolve(process.cwd(), '.lancedb_minimal_check');

async function checkProductionMinimal() {
  console.log('='.repeat(80));
  console.log('🔍 Minimal Production Data Type Check');
  console.log('='.repeat(80));

  // 一時ディレクトリの準備
  if (existsSync(TEMP_DOWNLOAD_DIR)) {
    rmSync(TEMP_DOWNLOAD_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEMP_DOWNLOAD_DIR, { recursive: true });

  try {
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);

    console.log(`\n📥 Finding minimal data files...`);

    // データファイル（.lance）のみを取得
    const [files] = await bucket.getFiles({ prefix: GCS_LANCEDB_PATH });
    const dataFiles = files.filter(f => 
      f.name.endsWith('.lance') && 
      !f.name.includes('_versions') &&
      !f.name.includes('manifest')
    );

    if (dataFiles.length === 0) {
      console.log('❌ No data files found');
      return;
    }

    // 最小の3つのファイルを選択（テーブル構造に必要）
    const sortedFiles = dataFiles.sort((a, b) => parseInt(a.metadata.size) - parseInt(b.metadata.size));
    const filesToDownload = sortedFiles.slice(0, 3);
    
    console.log(`📊 Selected ${filesToDownload.length} smallest files:`);
    filesToDownload.forEach((file, idx) => {
      console.log(`   ${idx + 1}. ${file.name} (${(parseInt(file.metadata.size) / (1024 * 1024)).toFixed(2)} MB)`);
    });

    // 複数ファイルをダウンロード
    console.log(`\n📥 Downloading files...`);
    for (const file of filesToDownload) {
      const relativePath = path.relative(GCS_LANCEDB_PATH, file.name);
      const destPath = path.join(TEMP_DOWNLOAD_DIR, relativePath);
      const destDir = path.dirname(destPath);

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      await file.download({ destination: destPath });
      console.log(`   ✅ ${relativePath}`);
    }

    // LanceDBに接続してスキーマを確認
    console.log(`\n📊 Analyzing schema...`);
    const db = await lancedb.connect(TEMP_DOWNLOAD_DIR);
    const table = await db.openTable('confluence');

    const rowCount = await table.countRows();
    console.log(`   - Rows in sample: ${rowCount.toLocaleString()}`);

    // サンプルデータを取得して型を確認
    const sampleData = await table.query().limit(3).toArray();

    if (sampleData.length === 0) {
      console.log('❌ No data in sample file');
      return;
    }

    console.log('\n📋 Sample Data Types:');
    console.log('-'.repeat(80));

    const pageIdTypes = new Set<string>();
    for (let i = 0; i < sampleData.length; i++) {
      const record = sampleData[i];
      const pageId = record.pageId;
      const id = record.id;

      pageIdTypes.add(typeof pageId);

      console.log(`\n  Record ${i + 1}:`);
      console.log(`    id: ${id} (type: ${typeof id})`);
      console.log(`    pageId: ${pageId} (type: ${typeof pageId})`);
    }

    console.log('\n📊 Type Analysis:');
    console.log(`   - pageId types found: ${Array.from(pageIdTypes).join(', ')}`);
    console.log(`   - All pageIds same type: ${pageIdTypes.size === 1}`);
    console.log(`   - Primary type: ${Array.from(pageIdTypes)[0] || 'N/A'}`);

    if (pageIdTypes.size === 1 && Array.from(pageIdTypes)[0] === 'string') {
      console.log('\n✅ Production pageId is STRING type');
    } else if (pageIdTypes.size === 1 && Array.from(pageIdTypes)[0] === 'number') {
      console.log('\n⚠️  Production pageId is NUMBER (Float64) type');
    } else {
      console.log('\n❌ Production pageId types are MIXED');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Minimal check completed');
    console.log('='.repeat(80) + '\n');

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
  } finally {
    // クリーンアップ
    if (existsSync(TEMP_DOWNLOAD_DIR)) {
      rmSync(TEMP_DOWNLOAD_DIR, { recursive: true, force: true });
      console.log('🧹 Cleanup completed');
    }
  }
}

if (require.main === module) {
  checkProductionMinimal();
}
