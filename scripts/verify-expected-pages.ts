/**
 * 期待ページがLanceDBに存在するか確認
 */

import * as lancedb from '@lancedb/lancedb';

const EXPECTED_PAGES = [
  '046_【FIX】退会機能',
  '164_【FIX】教室削除機能',
  '168_【FIX】教室コピー機能',
  '014_【FIX】応募機能',
  '721_【FIX】塾講師-学年・職業更新機能'
];

async function main() {
  console.log('🔍 期待ページ存在確認\n');
  
  const db = await lancedb.connect('.lancedb');
  const table = await db.openTable('confluence');
  const all = await table.query().limit(10000).toArray();
  
  console.log(`📊 総レコード数: ${all.length}件\n`);
  
  for (const expected of EXPECTED_PAGES) {
    const found = all.filter((r: any) => r.title === expected);
    
    if (found.length > 0) {
      console.log(`✅ "${expected}": ${found.length}件`);
    } else {
      console.log(`❌ "${expected}": 見つかりません`);
      
      // 類似タイトルを検索
      const similar = all.filter((r: any) => {
        const title = String(r.title || '').toLowerCase();
        const expectedLower = expected.toLowerCase();
        
        // 数字部分を抽出
        const expectedNum = expected.match(/^\d+/)?.[0];
        if (expectedNum && title.startsWith(expectedNum)) {
          return true;
        }
        
        // キーワードマッチ
        const keywords = expectedLower.split(/[_【】\s]+/).filter(k => k.length > 1);
        return keywords.some(kw => title.includes(kw));
      }).slice(0, 5);
      
      if (similar.length > 0) {
        console.log(`   類似ページ:`);
        similar.forEach(s => console.log(`     - ${s.title}`));
      }
    }
    console.log();
  }
}

main().catch(console.error);

