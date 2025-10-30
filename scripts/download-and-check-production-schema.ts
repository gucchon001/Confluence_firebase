/**
 * 本番データをダウンロードしてスキーマを確認するスクリプト
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = 'confluence-copilot-ppjye';

async function downloadAndCheckProductionSchema() {
  console.log('='.repeat(80));
  console.log('🔍 Production Data Download and Schema Check');
  console.log('='.repeat(80));
  
  try {
    // 一時ディレクトリにダウンロード
    const tempDir = path.join(process.cwd(), '.temp-production-check');
    const tempLanceDbPath = path.join(tempDir, '.lancedb');
    
    console.log(`\n📥 Downloading from GCS...`);
    console.log(`   Bucket: ${BUCKET_NAME}`);
    console.log(`   Destination: ${tempDir}\n`);
    
    // ディレクトリクリーンアップ
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempLanceDbPath, { recursive: true });
    
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);
    
    // GCSからLanceDBファイルをダウンロード
    const [files] = await bucket.getFiles({ prefix: 'lancedb/confluence.lance' });
    
    if (files.length === 0) {
      console.log('❌ No files found in GCS');
      return;
    }
    
    console.log(`   Found ${files.length} files in GCS\n`);
    
    let downloaded = 0;
    for (const file of files) {
      const relativePath = file.name.replace('lancedb/confluence.lance/', '');
      const destPath = path.join(tempLanceDbPath, relativePath);
      const destDir = path.dirname(destPath);
      
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      
      await file.download({ destination: destPath });
      downloaded++;
      
      if (downloaded % 1000 === 0) {
        console.log(`   Downloaded ${downloaded}/${files.length} files...`);
      }
    }
    
    console.log(`✅ Downloaded ${downloaded} files\n`);
    
    // LanceDBに接続してスキーマ確認
    console.log('📊 Analyzing Production Schema...\n');
    
    const db = await lancedb.connect(tempLanceDbPath);
    const table = await db.openTable('confluence');
    
    const rowCount = await table.countRows();
    console.log(`Total rows: ${rowCount.toLocaleString()}\n`);
    
    // サンプルデータ取得
    const sampleData = await table.query().limit(20).toArray();
    
    console.log('📋 Sample Data Analysis:');
    console.log('-'.repeat(80));
    
    for (let i = 0; i < Math.min(10, sampleData.length); i++) {
      const r = sampleData[i];
      console.log(`\n  Record ${i + 1}:`);
      console.log(`    id: ${r.id} (type: ${typeof r.id})`);
      console.log(`    pageId: ${r.pageId} (type: ${typeof r.pageId})`);
      console.log(`    title: ${r.title?.substring(0, 50)}`);
    }
    
    // 型統計
    const pageIds = sampleData.map(r => r.pageId);
    const types = new Set(pageIds.map(id => typeof id));
    
    console.log(`\n📊 Type Statistics:`);
    console.log(`   - Sample size: ${sampleData.length}`);
    console.log(`   - pageId types: ${Array.from(types).join(', ')}`);
    console.log(`   - All same type: ${types.size === 1}`);
    
    const primaryType = Array.from(types)[0];
    
    console.log(`\n✅ Production Data Type: ${primaryType.toUpperCase()}`);
    
    if (primaryType === 'string') {
      console.log(`\n🎉 Production data is STRING type!`);
      console.log(`   → Float64 fallback is NOT needed`);
      console.log(`   → Simple string comparison will work`);
    } else {
      console.log(`\n⚠️  Production data is ${primaryType.toUpperCase()} type`);
      console.log(`   → Type conversion needed`);
    }
    
    // クエリテスト
    console.log('\n🧪 Query Test:');
    console.log('-'.repeat(80));
    
    const testPageId = String(pageIds[0]);
    
    // String比較テスト
    console.log(`\n  Test: \`pageId\` = '${testPageId}' (string)`);
    try {
      const results = await table.query().where(`\`pageId\` = '${testPageId}'`).limit(5).toArray();
      console.log(`    ✅ SUCCESS: Found ${results.length} results`);
    } catch (error: any) {
      console.log(`    ❌ FAILED: ${error.message.substring(0, 80)}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Check completed');
    console.log('='.repeat(80) + '\n');
    
    // クリーンアップ
    fs.rmSync(tempDir, { recursive: true, force: true });
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

downloadAndCheckProductionSchema().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

