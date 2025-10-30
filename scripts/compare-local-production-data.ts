/**
 * ローカルと本番のデータ型比較スクリプト
 */

import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = 'confluence-copilot-ppjye';

async function compareData() {
  console.log('='.repeat(80));
  console.log('🔍 Local vs Production Data Type Comparison');
  console.log('='.repeat(80));
  
  // ローカルデータの分析
  console.log('\n📊 LOCAL DATA ANALYSIS:');
  console.log('-'.repeat(80));
  
  const localDbPath = path.resolve(process.cwd(), '.lancedb');
  const localDb = await lancedb.connect(localDbPath);
  const localTable = await localDb.openTable('confluence');
  const localCount = await localTable.countRows();
  const localSample = await localTable.query().limit(5).toArray();
  
  console.log(`Total rows: ${localCount.toLocaleString()}`);
  console.log(`Sample pageId types:`);
  localSample.forEach((r, i) => {
    console.log(`  [${i}] pageId: ${r.pageId} (type: ${typeof r.pageId})`);
  });
  
  // GCS上のデータの調査
  console.log('\n📊 GCS DATA INVESTIGATION:');
  console.log('-'.repeat(80));
  
  const storage = new Storage({ projectId: PROJECT_ID });
  const bucket = storage.bucket(BUCKET_NAME);
  
  // GCS上のLanceDBファイルをリスト
  const [files] = await bucket.getFiles({ prefix: 'lancedb/confluence.lance' });
  
  console.log(`\nGCS files in lancedb/confluence.lance:`);
  console.log(`Total files: ${files.length}`);
  
  for (const file of files.slice(0, 5)) {
    const metadata = await file.getMetadata();
    console.log(`\n  ${file.name}:`);
    console.log(`    Size: ${parseInt(metadata[0].size || '0') / 1024 / 1024} MB`);
    console.log(`    Updated: ${metadata[0].updated}`);
  }
  
  if (files.length === 0) {
    console.log('\n⚠️  No files found in GCS at lancedb/confluence.lance');
    console.log('   This might explain the type mismatch!');
    console.log('   Run: npm run upload:production-data');
  } else {
    console.log('\n✅ Files found in GCS');
    console.log('   If type mismatch persists, the data might need re-upload');
  }
  
  console.log('\n' + '='.repeat(80));
}

compareData().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

