/**
 * 検索結果処理のベースラインテスト
 * Phase 4開始前の現在の動作を確認
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function testSearchResultProcessingBaseline() {
  console.log('🔍 検索結果処理ベースラインテスト');
  console.log('=' .repeat(60));

  const testQueries = [
    '教室管理の詳細は',
    'ログイン機能について',
    'オファー管理の機能'
  ];

  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n[${i + 1}/${testQueries.length}] テストクエリ: "${query}"`);

    try {
      const startTime = Date.now();
      
      // 検索実行
      const results = await searchLanceDB({
        query,
        topK: 5,
        tableName: 'confluence'
      });
      
      const processingTime = Date.now() - startTime;

      console.log(`⏱️  処理時間: ${processingTime}ms`);
      console.log(`📊 結果数: ${results.length}件`);
      
      // 結果の詳細分析
      if (results.length > 0) {
        console.log('\n📋 検索結果の詳細:');
        results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.title}`);
          console.log(`     スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
          console.log(`     ソース: ${result.source}`);
          console.log(`     距離: ${result.distance}`);
          console.log(`     ラベル: [${result.labels?.join(', ') || 'なし'}]`);
        });

        // スコア分布の分析
        const scores = results.map(r => r.score);
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        
        console.log(`\n📈 スコア分析:`);
        console.log(`   平均スコア: ${avgScore.toFixed(2)}`);
        console.log(`   最高スコア: ${maxScore}`);
        console.log(`   最低スコア: ${minScore}`);
        
        // ソース分布の分析
        const sourceCounts = results.reduce((acc, r) => {
          acc[r.source || 'unknown'] = (acc[r.source || 'unknown'] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        console.log(`\n🔍 ソース分布:`);
        Object.entries(sourceCounts).forEach(([source, count]) => {
          console.log(`   ${source}: ${count}件`);
        });
      }

      // パフォーマンス評価
      if (processingTime < 1000) {
        console.log('✅ 高速処理');
      } else if (processingTime < 3000) {
        console.log('⚠️  中速処理');
      } else {
        console.log('❌ 低速処理');
      }

    } catch (error) {
      console.error(`❌ エラー: ${error}`);
    }
  }

  console.log('\n✅ ベースラインテスト完了');
}

// テスト実行
testSearchResultProcessingBaseline().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
