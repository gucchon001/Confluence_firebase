/**
 * 検索システムのパフォーマンス測定スクリプト
 * 現在の応答時間を測定し、ボトルネックを特定する
 */

import { searchLanceDB } from './src/lib/lancedb-search-client';
import { UnifiedEmbeddingService } from './src/lib/unified-embedding-service';

interface PerformanceMetrics {
  query: string;
  totalTime: number;
  embeddingTime: number;
  searchTime: number;
  resultCount: number;
  timestamp: string;
}

interface PerformanceSummary {
  totalQueries: number;
  averageTotalTime: number;
  averageEmbeddingTime: number;
  averageSearchTime: number;
  maxTotalTime: number;
  minTotalTime: number;
  bottleneckAnalysis: {
    embeddingRatio: number;
    searchRatio: number;
    primaryBottleneck: string;
  };
}

// テスト用のクエリリスト
const TEST_QUERIES = [
  '教室管理機能について教えて',
  '生徒の一括登録はどうやるの？',
  '求人情報の編集機能',
  'CSVアップロードの方法',
  '教室の公開フラグとは？',
  'データベースの設計について',
  'エラーハンドリングの仕組み',
  'ユーザー権限の管理',
  'ログイン機能の実装',
  'APIの仕様について'
];

async function measureSearchPerformance(): Promise<void> {
  console.log('🚀 検索システムのパフォーマンス測定を開始...');
  
  const embeddingService = UnifiedEmbeddingService.getInstance();
  const metrics: PerformanceMetrics[] = [];
  
  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const query = TEST_QUERIES[i];
    console.log(`\n📊 測定中 (${i + 1}/${TEST_QUERIES.length}): "${query}"`);
    
    try {
      const startTime = Date.now();
      
      // 1. 埋め込み生成時間の測定
      const embeddingStart = Date.now();
      const embedding = await embeddingService.generateSingleEmbedding(query);
      const embeddingTime = Date.now() - embeddingStart;
      
      // 2. 検索実行時間の測定
      const searchStart = Date.now();
      const results = await searchLanceDB({
        query: query,
        topK: 10,
        tableName: 'confluence',
        labelFilters: {
          includeMeetingNotes: false,
          includeArchived: false
        }
      });
      const searchTime = Date.now() - searchStart;
      
      const totalTime = Date.now() - startTime;
      
      const metric: PerformanceMetrics = {
        query,
        totalTime,
        embeddingTime,
        searchTime,
        resultCount: results.length,
        timestamp: new Date().toISOString()
      };
      
      metrics.push(metric);
      
      console.log(`  ✅ 完了 - 総時間: ${totalTime}ms`);
      console.log(`     埋め込み生成: ${embeddingTime}ms (${(embeddingTime/totalTime*100).toFixed(1)}%)`);
      console.log(`     検索実行: ${searchTime}ms (${(searchTime/totalTime*100).toFixed(1)}%)`);
      console.log(`     結果数: ${results.length}件`);
      
      // API制限を回避するための待機
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`❌ エラー: ${error}`);
    }
  }
  
  // 結果の分析とサマリー生成
  const summary = analyzePerformance(metrics);
  displayResults(summary, metrics);
  
  // 結果をファイルに保存
  await saveResults(summary, metrics);
}

function analyzePerformance(metrics: PerformanceMetrics[]): PerformanceSummary {
  const totalQueries = metrics.length;
  const averageTotalTime = metrics.reduce((sum, m) => sum + m.totalTime, 0) / totalQueries;
  const averageEmbeddingTime = metrics.reduce((sum, m) => sum + m.embeddingTime, 0) / totalQueries;
  const averageSearchTime = metrics.reduce((sum, m) => sum + m.searchTime, 0) / totalQueries;
  
  const maxTotalTime = Math.max(...metrics.map(m => m.totalTime));
  const minTotalTime = Math.min(...metrics.map(m => m.totalTime));
  
  const embeddingRatio = (averageEmbeddingTime / averageTotalTime) * 100;
  const searchRatio = (averageSearchTime / averageTotalTime) * 100;
  
  const primaryBottleneck = embeddingRatio > searchRatio ? '埋め込み生成' : '検索実行';
  
  return {
    totalQueries,
    averageTotalTime,
    averageEmbeddingTime,
    averageSearchTime,
    maxTotalTime,
    minTotalTime,
    bottleneckAnalysis: {
      embeddingRatio,
      searchRatio,
      primaryBottleneck
    }
  };
}

function displayResults(summary: PerformanceSummary, metrics: PerformanceMetrics[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📈 パフォーマンス測定結果サマリー');
  console.log('='.repeat(60));
  
  console.log(`\n📊 基本統計:`);
  console.log(`  総クエリ数: ${summary.totalQueries}`);
  console.log(`  平均応答時間: ${summary.averageTotalTime.toFixed(2)}ms`);
  console.log(`  最大応答時間: ${summary.maxTotalTime}ms`);
  console.log(`  最小応答時間: ${summary.minTotalTime}ms`);
  
  console.log(`\n⏱️ 時間内訳:`);
  console.log(`  埋め込み生成: ${summary.averageEmbeddingTime.toFixed(2)}ms (${summary.bottleneckAnalysis.embeddingRatio.toFixed(1)}%)`);
  console.log(`  検索実行: ${summary.averageSearchTime.toFixed(2)}ms (${summary.bottleneckAnalysis.searchRatio.toFixed(1)}%)`);
  
  console.log(`\n🎯 ボトルネック分析:`);
  console.log(`  主要ボトルネック: ${summary.bottleneckAnalysis.primaryBottleneck}`);
  
  if (summary.bottleneckAnalysis.embeddingRatio > 60) {
    console.log(`  💡 推奨改善策: 埋め込み生成の最適化（キャッシュ、軽量モデル）`);
  } else if (summary.bottleneckAnalysis.searchRatio > 60) {
    console.log(`  💡 推奨改善策: 検索最適化（インデックス作成、結果数削減）`);
  } else {
    console.log(`  💡 推奨改善策: 総合的な最適化が必要`);
  }
  
  console.log(`\n📋 詳細結果 (上位5件):`);
  const sortedMetrics = metrics.sort((a, b) => b.totalTime - a.totalTime);
  sortedMetrics.slice(0, 5).forEach((metric, index) => {
    console.log(`  ${index + 1}. "${metric.query}" - ${metric.totalTime}ms`);
  });
  
  console.log('\n' + '='.repeat(60));
}

async function saveResults(summary: PerformanceSummary, metrics: PerformanceMetrics[]): Promise<void> {
  const fs = require('fs').promises;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  const results = {
    summary,
    metrics,
    generatedAt: new Date().toISOString()
  };
  
  const filename = `performance-measurement-${timestamp}.json`;
  
  try {
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    console.log(`\n💾 結果をファイルに保存しました: ${filename}`);
  } catch (error) {
    console.error(`❌ ファイル保存エラー: ${error}`);
  }
}

// メイン実行
measureSearchPerformance().catch(console.error);
