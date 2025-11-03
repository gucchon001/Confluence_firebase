/**
 * 本番環境のLanceDBスキーマ確認スクリプト
 * 
 * Cloud Storage FUSE経由で本番データを読み込み、スキーマを確認
 */

import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function checkProductionSchema() {
  try {
    console.log('='.repeat(80));
    console.log('🔍 Production LanceDB Schema Analysis');
    console.log('='.repeat(80));
    
    // Cloud Storage FUSEを使用して本番データを読み込む
    const productionPath = path.resolve('/tmp/lancedb');
    const dbPath = productionPath;
    
    console.log(`\n📂 Production Database Path: ${dbPath}`);
    console.log(`📂 Working Directory: ${process.cwd()}\n`);
    
    // ファイルの存在確認
    const fs = require('fs');
    const dbExists = fs.existsSync(dbPath);
    console.log(`📁 Database directory exists: ${dbExists}`);
    
    if (!dbExists) {
      console.log('❌ Database not found. Waiting for Cloud Storage FUSE to mount...');
      console.log('   This script should be run on the server after data is downloaded.\n');
      return;
    }
    
    // ディレクトリ内容を確認
    const files = fs.readdirSync(dbPath);
    console.log(`📁 Files in database directory: ${files.join(', ')}\n`);
    
    const db = await lancedb.connect(dbPath);
    const table = await db.openTable('confluence');
    
    console.log('✅ Connected to Production LanceDB\n');
    
    // テーブル統計情報を取得
    const rowCount = await table.countRows();
    console.log(`📊 Production Table Statistics:`);
    console.log(`   - Total rows: ${rowCount.toLocaleString()}\n`);
    
    // サンプルデータを取得（10件）
    const sampleData = await table.query().limit(10).toArray();
    
    if (sampleData.length === 0) {
      console.log('❌ No data found in production table');
      return;
    }
    
    console.log(`📋 Analyzing ${sampleData.length} sample records from production...\n`);
    
    // 各フィールドの詳細な型情報を収集
    const fieldInfo: Record<string, { name: string; type: string; value: any }> = {};
    
    for (const record of sampleData) {
      for (const [key, value] of Object.entries(record)) {
        if (!fieldInfo[key]) {
          fieldInfo[key] = {
            name: key,
            type: typeof value,
            value: value,
          };
        }
        
        // 型が異なる場合は更新
        if (typeof value !== fieldInfo[key].type) {
          fieldInfo[key].type = 'mixed';
        }
      }
    }
    
    // スキーマ情報を出力
    console.log('📊 Production Schema Field Analysis:');
    console.log('-'.repeat(80));
    
    for (const key of Object.keys(fieldInfo).sort()) {
      const info = fieldInfo[key];
      let valueStr = String(info.value);
      
      // 長すぎる場合は省略
      if (valueStr.length > 60) {
        valueStr = valueStr.substring(0, 60) + '...';
      }
      
      // 配列の場合は長さを表示
      if (Array.isArray(info.value)) {
        valueStr = `Array[${info.value.length}] ${typeof info.value[0] === 'number' ? '(numeric)' : ''}`;
      }
      
      console.log(`  ${key.padEnd(20)} | type: ${info.type.padEnd(10)} | example: ${valueStr}`);
    }
    
    console.log('\n');
    
    // pageIdの詳細分析
    console.log('🔍 Detailed pageId Analysis (Production):');
    console.log('-'.repeat(80));
    
    const pageIds = sampleData.map(r => r.pageId);
    const firstPageId = pageIds[0];
    
    console.log(`  First pageId value: ${firstPageId}`);
    console.log(`  Type: ${typeof firstPageId}`);
    console.log(`  Is Number: ${typeof firstPageId === 'number'}`);
    console.log(`  As String: "${String(firstPageId)}"`);
    
    // 全pageIdの型をチェック
    const types = new Set(pageIds.map(id => typeof id));
    console.log(`  All types in sample: ${Array.from(types).join(', ')}`);
    
    // 実例
    console.log(`\n  Example values:`);
    pageIds.slice(0, 5).forEach((id, idx) => {
      console.log(`    [${idx}] value: ${id}, type: ${typeof id}, as number: ${Number(id)}`);
    });
    
    console.log('\n');
    
    // クエリテスト
    console.log('🧪 Production Query Type Testing:');
    console.log('-'.repeat(80));
    
    const testPageId = String(firstPageId);
    
    // テスト1: 文字列比較
    console.log(`\n  Test 1: \`pageId\` = '${testPageId}' (string with quotes)`);
    try {
      const result1 = await table.query().where(`\`pageId\` = '${testPageId}'`).limit(1).toArray();
      console.log(`    ✅ SUCCESS: Found ${result1.length} results`);
    } catch (error: any) {
      console.log(`    ❌ FAILED: ${error.message.substring(0, 100)}`);
    }
    
    // テスト2: 数値比較
    console.log(`\n  Test 2: \`pageId\` = ${testPageId} (numeric, no quotes)`);
    try {
      const result2 = await table.query().where(`\`pageId\` = ${testPageId}`).limit(1).toArray();
      console.log(`    ✅ SUCCESS: Found ${result2.length} results`);
    } catch (error: any) {
      console.log(`    ❌ FAILED: ${error.message.substring(0, 100)}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Production schema check completed');
    console.log('='.repeat(80) + '\n');
    
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    console.error('Stack:', error.stack);
  }
}

checkProductionSchema().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Script error:', error);
  process.exit(1);
});

