/**
 * 本番データの型を最小限のダウンロードで確認
 * テーブルのスキーマ情報を読むために必要な最小限のファイルのみをダウンロード
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = 'confluence-copilot-ppjye';
const GCS_PREFIX = 'lancedb/confluence.lance';
const TEMP_DIR = path.join(process.cwd(), '.temp-prod-type-check');

async function checkProductionTypeFast() {
  console.log('='.repeat(80));
  console.log('🔍 Production Data Type Check (Fast)');
  console.log('='.repeat(80));

  // クリーンアップ
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });

  try {
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);
    const [files] = await bucket.getFiles({ prefix: GCS_PREFIX });

    console.log(`\n📊 Found ${files.length} files in GCS\n`);

    // 重要なファイルを特定
    const versionFiles = files.filter(f => f.name.includes('_versions/'));
    const dataFiles = files.filter(f => 
      f.name.endsWith('.lance') && 
      !f.name.includes('_versions') &&
      !f.name.includes('manifest')
    );

    console.log(`   Version files: ${versionFiles.length}`);
    console.log(`   Data files: ${dataFiles.length}\n`);

    // より多くのファイルをダウンロードしてスキーマを読み取る
    // スキーマ情報を含む可能性のあるファイルも追加
    const manifestFiles = files.filter(f => f.name.endsWith('.manifest'));
    const filesToDownload = [
      ...versionFiles,              // 全てのバージョンファイル
      ...manifestFiles.slice(0, 10), // 最初の10個のマニフェストファイル
      ...dataFiles.slice(0, 5)      // 最初の5個のデータファイル（スキーマ情報を含む可能性）
    ];

    console.log(`📥 Downloading ${filesToDownload.length} essential files...\n`);

    for (const file of filesToDownload) {
      const relativePath = file.name.replace(GCS_PREFIX + '/', '');
      const destPath = path.join(TEMP_DIR, relativePath);
      const destDir = path.dirname(destPath);

      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      await file.download({ destination: destPath });
      
      const size = (file.metadata.size / 1024).toFixed(2);
      console.log(`   ✅ ${path.basename(relativePath)} (${size} KB)`);
    }

    console.log(`\n✅ Downloaded essential files\n`);

    // 接続を試みる（ダミーファイルが必要な場合は注意）
    try {
      console.log('📊 Attempting to connect to LanceDB...\n');
      const db = await lancedb.connect(TEMP_DIR);
      const table = await db.openTable('confluence');

      const rowCount = await table.countRows();
      console.log(`   ✅ Connected! Rows: ${rowCount.toLocaleString()}\n`);

      // サンプル取得
      const sampleData = await table.query().limit(5).toArray();

      if (sampleData.length === 0) {
        console.log('⚠️  No data found in sample\n');
      } else {
        console.log('📋 Sample Data Types:');
        console.log('-'.repeat(80));

        const pageIdTypes = new Set<string>();
        for (let i = 0; i < sampleData.length; i++) {
          const r = sampleData[i];
          const pageId = r.pageId;
          pageIdTypes.add(typeof pageId);

          console.log(`\n  Record ${i + 1}:`);
          console.log(`    pageId: ${pageId} (type: ${typeof pageId})`);
          console.log(`    title: ${r.title?.substring(0, 50)}`);
        }

        console.log('\n📊 Type Analysis:');
        console.log(`   - pageId types found: ${Array.from(pageIdTypes).join(', ')}`);
        console.log(`   - Consistent type: ${pageIdTypes.size === 1}`);
        
        const primaryType = Array.from(pageIdTypes)[0];
        
        if (primaryType === 'string') {
          console.log('\n✅ PRODUCTION pageId is STRING type');
        } else if (primaryType === 'number') {
          console.log('\n⚠️  PRODUCTION pageId is NUMBER (Float64) type');
        } else {
          console.log('\n❌ PRODUCTION pageId types are MIXED');
        }
      }

    } catch (connectError: any) {
      console.log(`⚠️  Could not connect: ${connectError.message}`);
      console.log(`\n💡 This usually means more files are needed.`);
      console.log(`   The schema info is distributed across multiple files.\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ Type check completed');
    console.log('='.repeat(80) + '\n');

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    // クリーンアップ
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
  }
}

if (require.main === module) {
  checkProductionTypeFast();
}
