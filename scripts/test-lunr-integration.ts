/**
 * LunrSearchClient統合テスト
 */
import { defaultLanceDBSearchClient } from '../src/lib/lancedb-search-client';
import { lunrInitializer } from '../src/lib/lunr-initializer';

async function testLunrIntegration() {
  console.log('🔍 LunrSearchClient統合テスト開始\n');

  try {
    // 1. Lunrインデックスの初期化確認
    console.log('1. Lunrインデックス初期化確認...');
    if (!lunrInitializer.isReady()) {
      console.log('   Lunrインデックスが初期化されていません。初期化を開始します...');
      await lunrInitializer.initializeAsync();
    }
    console.log('   ✅ Lunrインデックス初期化完了');

    // 2. 検索テストクエリ
    const testQueries = [
      '教室管理の仕様は',
      'ログイン機能の詳細を教えて',
      '急募の設定箇所は',
      '要件定義の手順',
      'パスワード再設定機能'
    ];

    console.log('\n2. 検索テスト実行...');
    
    for (const query of testQueries) {
      console.log(`\n🔍 クエリ: "${query}"`);
      console.log('─'.repeat(50));
      
      try {
        const startTime = Date.now();
        
        // LunrSearchClientを使用した検索
        const results = await defaultLanceDBSearchClient.search({
          query,
          topK: 10,
          useLunrIndex: true,
          useKeywordSearch: true,
          labelFilters: {
            includeMeetingNotes: false,
            includeArchived: false
          }
        });
        
        const endTime = Date.now();
        const searchTime = endTime - startTime;
        
        console.log(`   ⏱️  検索時間: ${searchTime}ms`);
        console.log(`   📊 結果数: ${results.length}件`);
        
        if (results.length > 0) {
          console.log('   📋 上位結果:');
          results.slice(0, 3).forEach((result, index) => {
            const score = result.distance ? Math.round((1 - result.distance) * 100) : 0;
            console.log(`      ${index + 1}. ${result.title} (${score}% 一致)`);
            console.log(`         ページID: ${result.pageId}, ソース: ${result.source || 'unknown'}`);
          });
        } else {
          console.log('   ❌ 結果なし');
        }
        
      } catch (error) {
        console.error(`   ❌ 検索エラー:`, error);
      }
    }

    // 3. パフォーマンステスト
    console.log('\n3. パフォーマンステスト...');
    const performanceQueries = ['教室管理', 'ログイン', '急募'];
    const performanceResults: { query: string; time: number }[] = [];
    
    for (const query of performanceQueries) {
      const startTime = Date.now();
      await defaultLanceDBSearchClient.search({
        query,
        topK: 5,
        useLunrIndex: true,
        useKeywordSearch: true
      });
      const endTime = Date.now();
      performanceResults.push({
        query,
        time: endTime - startTime
      });
    }
    
    const avgTime = performanceResults.reduce((sum, r) => sum + r.time, 0) / performanceResults.length;
    console.log(`   📊 平均検索時間: ${avgTime.toFixed(2)}ms`);
    performanceResults.forEach(r => {
      console.log(`      "${r.query}": ${r.time}ms`);
    });

    console.log('\n✅ LunrSearchClient統合テスト完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

// テスト実行
testLunrIntegration().catch(console.error);
