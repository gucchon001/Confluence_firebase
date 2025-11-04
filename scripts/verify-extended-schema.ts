/**
 * 拡張スキーマの適用状況を確認するスクリプト
 */

import * as lancedb from '@lancedb/lancedb';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   拡張スキーマ適用状況確認スクリプト                                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    // データ件数を確認
    const count = await table.countRows();
    console.log(`📊 データ件数: ${count}件\n`);
    
    if (count === 0) {
      console.log('⚠️ データが存在しません\n');
      return;
    }
    
    // サンプルデータを取得
    const dummyVector = new Array(768).fill(0);
    const sampleData = await table.search(dummyVector).limit(10).toArray();
    
    console.log('🔍 サンプルデータ（10件）で拡張スキーマを確認中...\n');
    
    // StructuredLabelフィールドの存在確認
    const structuredFields = [
      'structured_category',
      'structured_domain',
      'structured_feature',
      'structured_priority',
      'structured_status',
      'structured_version',
      'structured_tags',
      'structured_confidence',
      'structured_content_length',
      'structured_is_valid'
    ];
    
    let fieldsPresentCount = 0;
    let labelsIntegratedCount = 0;
    let featureSetCount = 0;
    
    sampleData.forEach((record: any, index: number) => {
      const hasFields = structuredFields.every(field => record[field] !== undefined);
      if (hasFields) {
        fieldsPresentCount++;
      }
      
      const hasLabel = record.structured_category || record.structured_domain || record.structured_feature;
      if (hasLabel) {
        labelsIntegratedCount++;
      }
      
      if (record.structured_feature) {
        featureSetCount++;
      }
      
      if (index < 3) {
        console.log(`  ${index + 1}. ${record.title || 'N/A'}`);
        console.log(`     - structured_feature: ${record.structured_feature || '空'}`);
        console.log(`     - structured_domain: ${record.structured_domain || '空'}`);
        console.log(`     - structured_category: ${record.structured_category || '空'}`);
        console.log('');
      }
    });
    
    console.log('📊 確認結果:');
    console.log(`  - 拡張スキーマフィールドが存在する: ${fieldsPresentCount}/${sampleData.length}件`);
    console.log(`  - StructuredLabelが統合されている: ${labelsIntegratedCount}/${sampleData.length}件`);
    console.log(`  - structured_featureが設定されている: ${featureSetCount}/${sampleData.length}件\n`);
    
    // 特定のページID（教室削除機能）を確認
    console.log('🔍 特定のページID（718373062: 教室削除機能）を確認中...\n');
    const targetPageId = 718373062;
    const targetRecords = await table.query().where(`page_id = ${targetPageId}`).limit(2).toArray();
    
    if (targetRecords.length > 0) {
      console.log(`✅ ページID ${targetPageId} が見つかりました（${targetRecords.length}チャンク）\n`);
      targetRecords.forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. title: ${record.title}`);
        console.log(`     - structured_feature: ${record.structured_feature || '空'}`);
        console.log(`     - structured_domain: ${record.structured_domain || '空'}`);
        console.log(`     - structured_category: ${record.structured_category || '空'}`);
        console.log(`     - structured_tags: ${Array.isArray(record.structured_tags) ? record.structured_tags.join(', ') : '空'}`);
        console.log('');
      });
      
      if (targetRecords[0].structured_feature) {
        console.log('✅ このページにはStructuredLabelが統合されています\n');
      } else {
        console.log('⚠️ このページにはStructuredLabelが統合されていません\n');
      }
    } else {
      console.log(`⚠️ ページID ${targetPageId} が見つかりませんでした\n`);
    }
    
    // 最終判定
    console.log('═══════════════════════════════════════════════════════════════\n');
    if (fieldsPresentCount === sampleData.length && labelsIntegratedCount > 0) {
      console.log('✅ 拡張スキーマは正常に適用されています\n');
    } else {
      console.log('⚠️ 拡張スキーマの適用に問題がある可能性があります\n');
    }
    
  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error('   スタック:', error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main().then(() => {
    process.exit(0);
  }).catch((error) => {
    console.error('❌ スクリプト実行エラー:', error);
    process.exit(1);
  });
}

