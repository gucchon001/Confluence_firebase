/**
 * LanceDBのStructuredLabel統合状況確認
 */

import * as lancedb from '@lancedb/lancedb';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       LanceDB StructuredLabel統合状況確認                               ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    const allRecords = await table.query().limit(10).toArray();
    
    console.log(`📊 サンプルレコード（最初の10件）:\n`);
    
    let withStructuredLabel = 0;
    let withoutStructuredLabel = 0;
    
    allRecords.forEach((r: any, i: number) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   pageId: ${r.pageId}`);
      
      // StructuredLabelフィールドの確認
      const hasStructuredLabel = 
        r.structured_category !== undefined ||
        r.structured_domain !== undefined ||
        r.structured_feature !== undefined;
      
      if (hasStructuredLabel) {
        withStructuredLabel++;
        console.log(`   ✅ StructuredLabel: あり`);
        console.log(`   ├─ category: ${r.structured_category}`);
        console.log(`   ├─ domain: ${r.structured_domain}`);
        console.log(`   ├─ feature: ${r.structured_feature}`);
        console.log(`   ├─ status: ${r.structured_status}`);
        console.log(`   ├─ priority: ${r.structured_priority}`);
        console.log(`   ├─ confidence: ${r.structured_confidence?.toFixed(2)}`);
        console.log(`   └─ tags: [${(r.structured_tags || []).join(', ')}]`);
      } else {
        withoutStructuredLabel++;
        console.log(`   ❌ StructuredLabel: なし`);
      }
      console.log('');
    });
    
    // 全レコードの統計
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 統計（サンプル10件）:\n');
    console.log(`   StructuredLabelあり: ${withStructuredLabel}/10件 (${(withStructuredLabel / 10 * 100).toFixed(1)}%)`);
    console.log(`   StructuredLabelなし: ${withoutStructuredLabel}/10件 (${(withoutStructuredLabel / 10 * 100).toFixed(1)}%)`);
    
    // 全レコード数を確認
    const totalRecords = await table.countRows();
    console.log(`\n   総レコード数: ${totalRecords}件\n`);
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 結論:\n');
    
    if (withStructuredLabel === 0) {
      console.log('❌ StructuredLabelがLanceDBに統合されていません');
      console.log('\n推奨アクション:');
      console.log('   1. Firestoreのstructured_labelsを確認');
      console.log('   2. 同期スクリプトを実行:');
      console.log('      npx tsx scripts/sync-firestore-labels-to-lancedb.ts');
    } else if (withStructuredLabel < 10) {
      console.log('⚠️ StructuredLabelが一部のみ統合されています');
      console.log('\n推奨アクション:');
      console.log('   1. 同期スクリプトを再実行');
      console.log('   2. 全レコードで統合完了を確認');
    } else {
      console.log('✅ StructuredLabelが正しく統合されています');
    }

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  } finally {
    const client = OptimizedLanceDBClient.getInstance();
    client.resetConnection();
    await client.disconnect();
  }
}

main();


