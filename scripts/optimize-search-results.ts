/**
 * 検索結果最適化スクリプト
 * 検索結果数を削減し、事前フィルタリングを実装
 */

import { searchLanceDB } from './src/lib/lancedb-search-client';

// テスト用のクエリ
const TEST_QUERY = '教室管理機能について教えて';

async function testSearchOptimization(): Promise<void> {
  console.log('🔍 検索最適化テストを開始...');
  console.log(`テストクエリ: "${TEST_QUERY}"`);
  
  try {
    // 1. 現在の検索（結果数が多い）
    console.log('\n📊 現在の検索（結果数: 20件）:');
    const startTime1 = Date.now();
    const currentResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 20,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    const currentTime = Date.now() - startTime1;
    
    console.log(`  応答時間: ${currentTime}ms`);
    console.log(`  結果数: ${currentResults.length}件`);
    console.log(`  上位3件:`);
    currentResults.slice(0, 3).forEach((result, index) => {
      console.log(`    ${index + 1}. ${result.title} (スコア: ${result.score?.toFixed(2)})`);
    });
    
    // 2. 最適化された検索（結果数を削減）
    console.log('\n🚀 最適化された検索（結果数: 5件）:');
    const startTime2 = Date.now();
    const optimizedResults = await searchLanceDB({
      query: TEST_QUERY,
      topK: 5, // 結果数を大幅削減
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    const optimizedTime = Date.now() - startTime2;
    
    console.log(`  応答時間: ${optimizedTime}ms`);
    console.log(`  結果数: ${optimizedResults.length}件`);
    console.log(`  上位3件:`);
    optimizedResults.slice(0, 3).forEach((result, index) => {
      console.log(`    ${index + 1}. ${result.title} (スコア: ${result.score?.toFixed(2)})`);
    });
    
    // 3. 結果の比較
    console.log('\n📈 最適化効果:');
    const timeImprovement = ((currentTime - optimizedTime) / currentTime * 100).toFixed(1);
    console.log(`  応答時間改善: ${timeImprovement}%`);
    console.log(`  時間短縮: ${currentTime - optimizedTime}ms`);
    console.log(`  結果数削減: ${currentResults.length - optimizedResults.length}件`);
    
    // 4. 推奨設定
    console.log('\n💡 推奨設定:');
    console.log('  - topK: 5-10件（現在の20件から削減）');
    console.log('  - 事前フィルタリングの実装');
    console.log('  - インデックス作成との組み合わせ');
    
  } catch (error) {
    console.error('❌ 検索最適化テストエラー:', error);
  }
}

// メイン実行
testSearchOptimization().catch(console.error);
