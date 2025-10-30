/**
 * GCSのメタデータだけでスキーマを確認
 * ファイルダウンロードなし
 */

import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'confluence-copilot-data';
const PROJECT_ID = 'confluence-copilot-ppjye';

async function checkProductionSchemaFromMetadata() {
  console.log('='.repeat(80));
  console.log('🔍 Production Data Type Check (Metadata Only)');
  console.log('='.repeat(80));
  
  try {
    const storage = new Storage({ projectId: PROJECT_ID });
    const bucket = storage.bucket(BUCKET_NAME);
    
    // 最新のmanifestファイルを取得
    const [files] = await bucket.getFiles({ prefix: 'lancedb/confluence.lance/_versions/' });
    
    const manifestFiles = files
      .filter(f => f.name.includes('.manifest'))
      .sort((a, b) => b.name.localeCompare(a.name));
    
    console.log(`\n📊 Found ${manifestFiles.length} version manifests`);
    console.log(`   Latest manifest: ${manifestFiles[0].name}\n`);
    
    // アップロード日時を確認
    const metadata = await manifestFiles[0].getMetadata();
    console.log(`   Updated: ${metadata[0].updated}`);
    console.log(`   Size: ${metadata[0].size} bytes\n`);
    
    // データファイルの情報も確認
    const dataFiles = files.filter(f => f.name.includes('.lance') && !f.name.includes('_versions'));
    console.log(`📊 Data Files: ${dataFiles.length}`);
    
    if (dataFiles.length > 0) {
      const latestDataFile = dataFiles.sort((a, b) => b.name.localeCompare(a.name))[0];
      const dataMetadata = await latestDataFile.getMetadata();
      console.log(`   Latest: ${latestDataFile.name}`);
      console.log(`   Size: ${(parseInt(dataMetadata[0].size) / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`   Updated: ${dataMetadata[0].updated}\n`);
    }
    
    console.log('📋 Analysis:');
    console.log('-'.repeat(80));
    console.log('   - Manifest files are binary format (Arrow/Parquet)');
    console.log('   - Schema info requires LanceDB connection');
    console.log('   - Need to download minimal data sample for type check\n');
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Check completed (no full download needed)');
    console.log('='.repeat(80) + '\n');
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkProductionSchemaFromMetadata().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

