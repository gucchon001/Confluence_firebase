/**
 * LanceDBテーブルスキーマ確認スクリプト
 */

import * as lancedb from '@lancedb/lancedb';

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║   LanceDBテーブルスキーマ確認スクリプト                              ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    // スキーマを取得
    const schema = table.schema;
    
    console.log('📋 現在のテーブルスキーマ:');
    console.log('');
    
    if (schema && schema.fields) {
      schema.fields.forEach((field: any, index: number) => {
        console.log(`  ${index + 1}. ${field.name}: ${field.type} (nullable: ${field.nullable})`);
      });
    } else {
      console.log('  ⚠️ スキーマ情報が取得できませんでした');
    }
    
    console.log('');
    
    // structured_*フィールドの存在確認
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
    
    console.log('🔍 StructuredLabelフィールドの存在確認:');
    console.log('');
    
    const hasStructuredFields = structuredFields.filter(field => {
      if (schema && schema.fields) {
        return schema.fields.some((f: any) => f.name === field);
      }
      return false;
    });
    
    if (hasStructuredFields.length > 0) {
      console.log(`  ✅ StructuredLabelフィールドが存在します: ${hasStructuredFields.length}件`);
      hasStructuredFields.forEach(field => {
        console.log(`    - ${field}`);
      });
    } else {
      console.log('  ❌ StructuredLabelフィールドが存在しません');
      console.log('  ⚠️ テーブルを再作成する必要があります');
    }
    
    console.log('');
    
    // データ件数を確認
    const count = await table.countRows();
    console.log(`📊 データ件数: ${count}件`);
    console.log('');
    
    // サンプルデータを取得してフィールドの存在を確認
    if (count > 0) {
      console.log('🔍 サンプルデータでStructuredLabelフィールドを確認中...');
      console.log('');
      
      const dummyVector = new Array(768).fill(0);
      const sampleData = await table.search(dummyVector).limit(1).toArray();
      
      if (sampleData.length > 0) {
        const sample = sampleData[0];
        const sampleKeys = Object.keys(sample);
        
        const hasStructuredFieldsInData = structuredFields.filter(field => sampleKeys.includes(field));
        
        if (hasStructuredFieldsInData.length > 0) {
          console.log(`  ✅ サンプルデータにStructuredLabelフィールドが存在します: ${hasStructuredFieldsInData.length}件`);
          hasStructuredFieldsInData.forEach(field => {
            const value = sample[field as keyof typeof sample];
            console.log(`    - ${field}: ${value !== undefined && value !== null ? (Array.isArray(value) ? `[${value.length}件]` : String(value)) : 'null'}`);
          });
        } else {
          console.log('  ❌ サンプルデータにStructuredLabelフィールドが存在しません');
          console.log('  ⚠️ マイグレーションが必要です');
        }
        
        console.log('');
      }
    }
    
    console.log('✅ 確認完了\n');
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
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

