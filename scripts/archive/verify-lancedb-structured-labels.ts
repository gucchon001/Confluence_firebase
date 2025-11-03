/**
 * LanceDB内のStructuredLabel直接確認
 */

import * as lancedb from '@lancedb/lancedb';
import { OptimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';
import { config } from 'dotenv';

config();

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       LanceDB StructuredLabel直接確認                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  try {
    const db = await lancedb.connect('.lancedb');
    const table = await db.openTable('confluence');
    
    // 期待ページを直接検索
    const expectedPageTitle = '721_【作成中】学年自動更新バッチ';
    
    console.log(`期待ページを検索: "${expectedPageTitle}"\n`);
    
    const results = await table
      .query()
      .where(`title = '${expectedPageTitle}'`)
      .toArray();
    
    console.log(`検索結果: ${results.length}件\n`);
    
    if (results.length > 0) {
      const record = results[0];
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 LanceDB内のレコード:\n');
      
      console.log(`タイトル: ${record.title}`);
      console.log(`PageId: ${record.pageId}`);
      console.log('');
      
      console.log('StructuredLabel:');
      console.log(`  - category: ${record.structured_category || 'undefined'}`);
      console.log(`  - domain: ${record.structured_domain || 'undefined'}`);
      console.log(`  - feature: ${record.structured_feature || 'undefined'}`);
      console.log(`  - status: ${record.structured_status || 'undefined'}`);
      console.log(`  - priority: ${record.structured_priority || 'undefined'}`);
      console.log(`  - confidence: ${record.structured_confidence || 'undefined'}`);
      console.log(`  - tags: [${(record.structured_tags || []).join(', ')}]`);
      console.log('');
      
      console.log('従来のLabels:');
      console.log(`  [${Array.isArray(record.labels) ? record.labels.join(', ') : 'undefined'}]`);
      console.log('');
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📋 全フィールド一覧:\n');
      
      const keys = Object.keys(record);
      console.log(`全フィールド数: ${keys.length}\n`);
      
      // structured_で始まるフィールドのみ表示
      const structuredFields = keys.filter(k => k.startsWith('structured_'));
      console.log(`structured_フィールド数: ${structuredFields.length}`);
      if (structuredFields.length > 0) {
        structuredFields.forEach(field => {
          console.log(`  - ${field}: ${JSON.stringify(record[field])}`);
        });
      } else {
        console.log('  ❌ structured_フィールドが存在しません');
      }
    } else {
      console.log('❌ 期待ページが見つかりませんでした');
    }
    
    // ランダムに10件取得して統計
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 サンプル統計 (10件):\n');
    
    const samples = await table.query().limit(10).toArray();
    
    let withStructuredLabel = 0;
    samples.forEach((r: any) => {
      const hasStructuredLabel = 
        r.structured_category !== undefined ||
        r.structured_domain !== undefined ||
        r.structured_feature !== undefined;
      if (hasStructuredLabel) {
        withStructuredLabel++;
        console.log(`✅ ${r.title} - domain: ${r.structured_domain}`);
      } else {
        console.log(`❌ ${r.title} - StructuredLabelなし`);
      }
    });
    
    console.log(`\nStructuredLabelあり: ${withStructuredLabel}/10件 (${(withStructuredLabel / 10 * 100).toFixed(1)}%)`);

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


