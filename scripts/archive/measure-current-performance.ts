/**
 * 現在のパフォーマンス測定
 */

import { config } from 'dotenv';
config();

async function measureCurrentPerformance() {
  console.log('\n================================================================================');
  console.log('🎯 現在のパフォーマンス測定');
  console.log('================================================================================\n');
  
  console.log('テストケース:');
  console.log('  1. 会員退会機能の仕様を教えて');
  console.log('  2. 教室登録の手順を教えて');
  console.log('  3. 急募機能の詳細を教えて\n');
  
  const testQueries = [
    '会員退会機能の仕様を教えて',
    '教室登録の手順を教えて',
    '急募機能の詳細を教えて'
  ];
  
  const { searchLanceDB } = await import('../src/lib/lancedb-search-client');
  
  const results: Array<{ query: string; time: number; resultCount: number }> = [];
  
  for (const query of testQueries) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`📝 クエリ: "${query}"`);
    console.log(`${'─'.repeat(80)}`);
    
    const searchStart = Date.now();
    const searchResults = await searchLanceDB({
      query,
      topK: 50,
      useLunrIndex: true,  // BM25検索を有効化
      labelFilters: { includeMeetingNotes: false }
    });
    const searchTime = Date.now() - searchStart;
    
    results.push({
      query,
      time: searchTime,
      resultCount: searchResults.length
    });
    
    console.log(`⏱️  検索時間: ${searchTime}ms (${(searchTime / 1000).toFixed(2)}秒)`);
    console.log(`📄 結果数: ${searchResults.length}件`);
    console.log(`🏆 Top 3:`);
    for (let i = 0; i < Math.min(3, searchResults.length); i++) {
      console.log(`   ${i+1}. ${searchResults[i].title}`);
    }
    
    // 次のクエリまで少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 パフォーマンスサマリー');
  console.log(`${'='.repeat(80)}\n`);
  
  let totalTime = 0;
  results.forEach((r, i) => {
    console.log(`${i+1}. ${r.query.substring(0, 30)}...`);
    console.log(`   検索時間: ${r.time}ms (${(r.time / 1000).toFixed(2)}秒)`);
    console.log(`   結果数: ${r.resultCount}件\n`);
    totalTime += r.time;
  });
  
  const averageTime = totalTime / results.length;
  
  console.log(`${'─'.repeat(80)}`);
  console.log(`平均検索時間: ${averageTime}ms (${(averageTime / 1000).toFixed(2)}秒)`);
  console.log(`${'─'.repeat(80)}\n`);
  
  console.log('🎯 目標達成状況:\n');
  if (averageTime < 5000) {
    console.log('   🎉 目標達成！平均5秒以内');
  } else if (averageTime < 10000) {
    console.log('   ✅ 良好！平均10秒以内');
  } else if (averageTime < 15000) {
    console.log('   ⚠️  平均15秒以内（改善の余地あり）');
  } else {
    console.log(`   ❌ さらなる最適化が必要（現在: ${(averageTime / 1000).toFixed(2)}秒）`);
  }
  
  console.log(`\n${'='.repeat(80)}\n`);
}

measureCurrentPerformance().catch(console.error);

