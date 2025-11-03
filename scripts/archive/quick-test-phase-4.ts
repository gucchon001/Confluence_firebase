/**
 * Phase 4簡易テスト - Case 1のみ確認
 */

import { searchLanceDB } from '../src/lib/lancedb-search-client';

async function quickTest() {
  console.log('\n🧪 Phase 4簡易テスト（Case 1: 教室コピー）\n');
  
  const query = '教室をコピーする';
  console.log(`Query: "${query}"\n`);
  
  const results = await searchLanceDB({
    query,
    topK: 10,
    useLunrIndex: true,
    labelFilters: { includeMeetingNotes: false },
  });
  
  console.log(`\n📊 検索結果: ${results.length}件\n`);
  
  // 上位10件を表示
  console.log('🏆 上位10件:\n');
  results.forEach((r, idx) => {
    const num = (r.title || '').match(/^(\d{3})_/)?.[1] || '???';
    const sourceType = r._sourceType || r.source || 'unknown';
    const kgInfo = r._kgWeight ? ` [KG: ${r._kgWeight.toFixed(2)}]` : '';
    console.log(`${idx + 1}. [${num}] ${r.title}${kgInfo}`);
    console.log(`   Source: ${sourceType}, Score: ${r.score?.toFixed(2) || 'N/A'}`);
  });
  
  // 168を検索
  const found168 = results.some(r => (r.title || '').includes('168_'));
  console.log(`\n結果: ${found168 ? '✅ 168発見' : '❌ 168未発見'}\n`);
  
  process.exit(found168 ? 0 : 1);
}

quickTest().catch(err => {
  console.error('❌ エラー:', err);
  process.exit(1);
});

