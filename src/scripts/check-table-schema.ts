/**
 * テーブルスキーマの確認
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function checkTableSchema(): Promise<void> {
  console.log('🔍 テーブルスキーマの確認');
  console.log('='.repeat(80));
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // サンプルレコードの取得
    const sampleRecords = await tbl.query().limit(2).toArray();
    
    console.log(`\n=== サンプルレコードの構造 ===`);
    for (const record of sampleRecords) {
      console.log(`\n--- レコード: ${record.id} ---`);
      console.log('フィールド一覧:');
      for (const [key, value] of Object.entries(record)) {
        const type = typeof value;
        const isArray = Array.isArray(value);
        const hasToArray = value && typeof (value as any).toArray === 'function';
        
        console.log(`  ${key}: ${type}${isArray ? ' (Array)' : ''}${hasToArray ? ' (ArrowArray)' : ''}`);
        
        if (key === 'vector' && value) {
          if (hasToArray) {
            const vectorArray = (value as any).toArray();
            console.log(`    ベクトル次元数: ${vectorArray.length}`);
            console.log(`    ベクトル範囲: ${Math.min(...vectorArray).toFixed(4)} ～ ${Math.max(...vectorArray).toFixed(4)}`);
          } else if (isArray) {
            console.log(`    ベクトル次元数: ${value.length}`);
            console.log(`    ベクトル範囲: ${Math.min(...value).toFixed(4)} ～ ${Math.max(...value).toFixed(4)}`);
          }
        }
      }
    }
    
    // テーブル情報
    const count = await tbl.countRows();
    console.log(`\n=== テーブル情報 ===`);
    console.log(`総レコード数: ${count}`);
    
  } catch (error) {
    console.error('❌ スキーマ確認エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ スキーマ確認完了');
}

if (require.main === module) {
  checkTableSchema();
}

export { checkTableSchema };
