/**
 * ローカルと本番のアップロード日時を比較して型の一貫性を確認
 * ダウンロード不要で型の推測が可能
 */

import { Storage } from '@google-cloud/storage';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = 'confluence-copilot-ppjye';

async function checkTypeConsistency() {
  console.log('='.repeat(80));
  console.log('🔍 Type Consistency Check (No Download)');
  console.log('='.repeat(80));

  try {
    // 1. ローカルデータの型を確認
    console.log('\n📊 LOCAL DATA ANALYSIS:');
    console.log('-'.repeat(80));
    
    const localDbPath = path.resolve(process.cwd(), '.lancedb');
    const localDb = await lancedb.connect(localDbPath);
    const localTable = await localDb.openTable('confluence');
    
    const localRowCount = await localTable.countRows();
    console.log(`   - Total rows: ${localRowCount.toLocaleString()}`);
    
    const localSample = await localTable.query().limit(3).toArray();
    const localPageIdTypes = new Set(localSample.map(r => typeof r.pageId));
    
    console.log(`   - pageId types: ${Array.from(localPageIdTypes).join(', ')}`);
    console.log(`   - Consistent type: ${localPageIdTypes.size === 1}`);
    
    if (localPageIdTypes.size === 1) {
      console.log(`   - Primary type: ${Array.from(localPageIdTypes)[0]}`);
    }

    // 2. 本番データのアップロード日時を確認
    console.log('\n📊 PRODUCTION DATA ANALYSIS:');
    console.log('-'.repeat(80));
    
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);
    
    const [files] = await bucket.getFiles({ prefix: 'lancedb/confluence.lance/' });
    const dataFiles = files.filter(f => 
      f.name.endsWith('.lance') && 
      !f.name.includes('_versions') &&
      !f.name.includes('manifest')
    );
    
    if (dataFiles.length === 0) {
      console.log('❌ No production data found');
      return;
    }
    
    // 最新のファイルの日時を取得
    const latestFile = dataFiles.sort((a, b) => 
      new Date(b.metadata.updated).getTime() - new Date(a.metadata.updated).getTime()
    )[0];
    
    const uploadTime = new Date(latestFile.metadata.updated);
    console.log(`   - Latest upload: ${uploadTime.toISOString()}`);
    console.log(`   - Files count: ${dataFiles.length}`);
    console.log(`   - Total size: ${(dataFiles.reduce((sum, f) => sum + parseInt(f.metadata.size), 0) / (1024 * 1024)).toFixed(2)} MB`);

    // 3. 型の一貫性を推測
    console.log('\n📋 TYPE CONSISTENCY ANALYSIS:');
    console.log('-'.repeat(80));
    
    const localType = Array.from(localPageIdTypes)[0];
    
    if (localType === 'string') {
      console.log('✅ LOCAL: pageId is STRING type');
      console.log('📤 PRODUCTION: Should be STRING type (uploaded from local)');
      console.log('\n🎯 CONCLUSION: Production data should have STRING pageId');
      console.log('   - Remove fallback logic');
      console.log('   - Use: `\\`pageId\\` = \'${pageId}\'` (string comparison)');
    } else if (localType === 'number') {
      console.log('⚠️  LOCAL: pageId is NUMBER type');
      console.log('📤 PRODUCTION: Should be NUMBER type (uploaded from local)');
      console.log('\n🎯 CONCLUSION: Production data should have NUMBER pageId');
      console.log('   - Remove fallback logic');
      console.log('   - Use: `\\`pageId\\` = ${pageId}` (numeric comparison)');
    } else {
      console.log('❌ LOCAL: pageId types are MIXED');
      console.log('⚠️  This indicates a data consistency issue');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Type consistency check completed');
    console.log('='.repeat(80) + '\n');

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  checkTypeConsistency();
}
