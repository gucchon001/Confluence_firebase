/**
 * 統一検索結果処理サービスのテスト
 * デグレード防止のための段階的テスト
 */

import { unifiedSearchResultProcessor } from '../lib/unified-search-result-processor';
import { RawSearchResult, ProcessedSearchResult } from '../lib/unified-search-result-processor';

async function testUnifiedSearchResultProcessor() {
  console.log('🔍 統一検索結果処理サービステスト');
  console.log('=' .repeat(60));

  // テスト用の生データ
  const mockRawResults: RawSearchResult[] = [
    {
      id: 'test-1',
      pageId: 123,
      title: '教室管理機能の詳細',
      content: '教室管理に関する詳細な説明...',
      _distance: 0.3,
      _bm25Score: 15.5,
      _keywordScore: 12,
      _labelScore: 2,
      _sourceType: 'bm25',
      space_key: 'TEST',
      labels: '["教室管理", "機能"]',
      url: 'https://example.com/page1',
      lastUpdated: '2024-01-01'
    },
    {
      id: 'test-2',
      pageId: 456,
      title: 'ログイン機能について',
      content: 'ログイン機能の実装詳細...',
      _distance: 0.5,
      _bm25Score: 8.2,
      _keywordScore: 6,
      _labelScore: 1,
      _sourceType: 'hybrid',
      space_key: 'TEST',
      labels: '["ログイン", "認証"]',
      url: 'https://example.com/page2',
      lastUpdated: '2024-01-02'
    },
    {
      id: 'test-3',
      pageId: 789,
      title: 'オファー管理システム',
      content: 'オファー管理の機能説明...',
      _distance: 0.7,
      _bm25Score: 5.1,
      _keywordScore: 4,
      _labelScore: 0,
      _sourceType: 'vector',
      space_key: 'TEST',
      labels: '["オファー", "管理"]',
      url: 'https://example.com/page3',
      lastUpdated: '2024-01-03'
    }
  ];

  try {
    console.log('\n📊 テスト1: 基本処理テスト');
    const startTime = Date.now();
    
    const processedResults = unifiedSearchResultProcessor.processSearchResults(mockRawResults, {
      vectorWeight: 0.4,
      keywordWeight: 0.4,
      labelWeight: 0.2,
      enableRRF: true
    });
    
    const processingTime = Date.now() - startTime;
    
    console.log(`⏱️  処理時間: ${processingTime}ms`);
    console.log(`📊 処理結果数: ${processedResults.length}件`);
    
    // 結果の詳細表示
    processedResults.forEach((result, index) => {
      console.log(`\n  ${index + 1}. ${result.title}`);
      console.log(`     スコア: ${result.score} (${result.scoreKind}: ${result.scoreText})`);
      console.log(`     ソース: ${result.source}`);
      console.log(`     距離: ${result.distance}`);
      console.log(`     RRFスコア: ${result.rrfScore?.toFixed(4)}`);
      console.log(`     ラベル: [${result.labels?.join(', ') || 'なし'}]`);
    });

    // スコア分析
    const scores = processedResults.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    console.log(`\n📈 スコア分析:`);
    console.log(`   平均スコア: ${avgScore.toFixed(2)}`);
    console.log(`   最高スコア: ${maxScore}`);
    console.log(`   最低スコア: ${minScore}`);

    // ソース分布
    const sourceCounts = processedResults.reduce((acc, r) => {
      acc[r.source || 'unknown'] = (acc[r.source || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n🔍 ソース分布:`);
    Object.entries(sourceCounts).forEach(([source, count]) => {
      console.log(`   ${source}: ${count}件`);
    });

    console.log('\n📊 テスト2: 並び替えテスト');
    
    // RRFスコア順で並び替え
    const sortedByRRF = unifiedSearchResultProcessor.sortByRRFScore(processedResults);
    console.log('RRFスコア順:');
    sortedByRRF.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (RRF: ${result.rrfScore?.toFixed(4)})`);
    });

    // ハイブリッドスコア順で並び替え
    const sortedByHybrid = unifiedSearchResultProcessor.sortByHybridScore(processedResults);
    console.log('\nハイブリッドスコア順:');
    sortedByHybrid.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (Score: ${result.score})`);
    });

    console.log('\n📊 テスト3: フィルタリングテスト');
    
    // スコア50以上でフィルタリング
    const filteredResults = unifiedSearchResultProcessor.filterResults(processedResults, 50, 2);
    console.log(`スコア50以上、最大2件: ${filteredResults.length}件`);
    filteredResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (Score: ${result.score})`);
    });

    // パフォーマンス評価
    if (processingTime < 100) {
      console.log('\n✅ 高速処理');
    } else if (processingTime < 500) {
      console.log('\n⚠️  中速処理');
    } else {
      console.log('\n❌ 低速処理');
    }

    console.log('\n✅ 統一検索結果処理サービステスト完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    throw error;
  }
}

// テスト実行
testUnifiedSearchResultProcessor().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
