/**
 * ベクトル距離とスコアの関係を詳細に分析するテストスクリプト
 * 
 * このテストは以下の項目を詳細に分析します：
 * 1. ベクトル距離の分布と統計
 * 2. 距離とスコアの相関関係
 * 3. 距離閾値の最適化
 * 4. 類似度計算の精度
 * 5. 距離ベースのランキング品質
 */

import 'dotenv/config';
import { getEmbeddings } from '../lib/embeddings';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

interface DistanceAnalysis {
  query: string;
  totalResults: number;
  distances: number[];
  scores: number[];
  minDistance: number;
  maxDistance: number;
  avgDistance: number;
  medianDistance: number;
  stdDevDistance: number;
  correlation: number;
  distanceScorePairs: Array<{distance: number, score: number, title: string}>;
}

interface DistanceThresholdAnalysis {
  threshold: number;
  precision: number;
  recall: number;
  f1Score: number;
  resultsCount: number;
}

/**
 * ベクトル距離の統計を計算する
 */
function calculateDistanceStatistics(distances: number[]): {
  min: number;
  max: number;
  avg: number;
  median: number;
  stdDev: number;
} {
  if (distances.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, stdDev: 0 };
  }
  
  const sorted = [...distances].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = distances.reduce((sum, d) => sum + d, 0) / distances.length;
  const median = sorted.length % 2 === 0 
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  
  const variance = distances.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / distances.length;
  const stdDev = Math.sqrt(variance);
  
  return { min, max, avg, median, stdDev };
}

/**
 * ピアソン相関係数を計算する
 */
function calculateCorrelation(distances: number[], scores: number[]): number {
  if (distances.length !== scores.length || distances.length === 0) {
    return 0;
  }
  
  const n = distances.length;
  const sumX = distances.reduce((sum, x) => sum + x, 0);
  const sumY = scores.reduce((sum, y) => sum + y, 0);
  const sumXY = distances.reduce((sum, x, i) => sum + x * scores[i], 0);
  const sumX2 = distances.reduce((sum, x) => sum + x * x, 0);
  const sumY2 = scores.reduce((sum, y) => sum + y * y, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * 単一クエリでのベクトル距離分析を実行する
 */
async function analyzeVectorDistanceForQuery(query: string): Promise<DistanceAnalysis> {
  console.log(`\n=== ベクトル距離分析: "${query}" ===`);
  
  try {
    // 埋め込みベクトルを生成
    const vector = await getEmbeddings(query);
    console.log(`埋め込みベクトル生成完了 (${vector.length} 次元)`);
    
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    // ベクトル検索を実行
    const vectorResults = await tbl.search(vector).limit(50).toArray();
    console.log(`ベクトル検索結果数: ${vectorResults.length}件`);
    
    // 距離とスコアを抽出
    const distances = vectorResults.map(r => r._distance || 0);
    const scores = vectorResults.map(r => r.score || 0);
    
    // 距離の統計を計算
    const stats = calculateDistanceStatistics(distances);
    
    // 相関関係を計算
    const correlation = calculateCorrelation(distances, scores);
    
    // 距離とスコアのペアを作成
    const distanceScorePairs = vectorResults.map((result, index) => ({
      distance: distances[index],
      score: scores[index],
      title: result.title || 'No Title'
    }));
    
    console.log(`\n--- 距離統計 ---`);
    console.log(`最小距離: ${stats.min.toFixed(4)}`);
    console.log(`最大距離: ${stats.max.toFixed(4)}`);
    console.log(`平均距離: ${stats.avg.toFixed(4)}`);
    console.log(`中央値距離: ${stats.median.toFixed(4)}`);
    console.log(`標準偏差: ${stats.stdDev.toFixed(4)}`);
    
    console.log(`\n--- 相関関係 ---`);
    console.log(`距離とスコアの相関係数: ${correlation.toFixed(4)}`);
    
    if (correlation > 0.7) {
      console.log('✅ 強い正の相関 (距離が大きいほどスコアが高い)');
    } else if (correlation > 0.3) {
      console.log('⚠️ 中程度の正の相関');
    } else if (correlation > -0.3) {
      console.log('➖ 弱い相関');
    } else if (correlation > -0.7) {
      console.log('⚠️ 中程度の負の相関 (距離が小さいほどスコアが高い)');
    } else {
      console.log('✅ 強い負の相関 (距離が小さいほどスコアが高い)');
    }
    
    // 距離分布の詳細表示
    console.log(`\n--- 距離分布 ---`);
    const distanceRanges = [
      { min: 0, max: 0.2, label: '高類似 (0.0-0.2)' },
      { min: 0.2, max: 0.4, label: '中類似 (0.2-0.4)' },
      { min: 0.4, max: 0.6, label: '低類似 (0.4-0.6)' },
      { min: 0.6, max: 1.0, label: '非類似 (0.6-1.0)' }
    ];
    
    distanceRanges.forEach(range => {
      const count = distances.filter(d => d >= range.min && d < range.max).length;
      const percentage = (count / distances.length) * 100;
      console.log(`${range.label}: ${count}件 (${percentage.toFixed(1)}%)`);
    });
    
    return {
      query,
      totalResults: vectorResults.length,
      distances,
      scores,
      minDistance: stats.min,
      maxDistance: stats.max,
      avgDistance: stats.avg,
      medianDistance: stats.median,
      stdDevDistance: stats.stdDev,
      correlation,
      distanceScorePairs
    };
    
  } catch (error) {
    console.error(`距離分析エラー: ${error}`);
    return {
      query,
      totalResults: 0,
      distances: [],
      scores: [],
      minDistance: 0,
      maxDistance: 0,
      avgDistance: 0,
      medianDistance: 0,
      stdDevDistance: 0,
      correlation: 0,
      distanceScorePairs: []
    };
  }
}

/**
 * 距離閾値の最適化分析を実行する
 */
async function analyzeDistanceThresholds(query: string, expectedPages: string[]): Promise<DistanceThresholdAnalysis[]> {
  console.log(`\n=== 距離閾値最適化分析: "${query}" ===`);
  
  try {
    // 埋め込みベクトルを生成
    const vector = await getEmbeddings(query);
    
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    // ベクトル検索を実行（より多くの結果を取得）
    const vectorResults = await tbl.search(vector).limit(100).toArray();
    
    // 様々な距離閾値でテスト
    const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const analyses: DistanceThresholdAnalysis[] = [];
    
    for (const threshold of thresholds) {
      // 閾値以下の距離の結果をフィルタ
      const filteredResults = vectorResults.filter(r => (r._distance || 0) <= threshold);
      
      // 期待されるページとの一致をチェック
      const foundExpectedPages = filteredResults.filter(result => 
        expectedPages.some(expected => 
          result.title?.includes(expected) || expected.includes(result.title)
        )
      );
      
      const precision = filteredResults.length > 0 ? foundExpectedPages.length / filteredResults.length : 0;
      const recall = expectedPages.length > 0 ? foundExpectedPages.length / expectedPages.length : 0;
      const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
      
      analyses.push({
        threshold,
        precision,
        recall,
        f1Score,
        resultsCount: filteredResults.length
      });
      
      console.log(`閾値 ${threshold.toFixed(1)}: 精度=${precision.toFixed(3)}, 再現率=${recall.toFixed(3)}, F1=${f1Score.toFixed(3)}, 結果数=${filteredResults.length}`);
    }
    
    // 最適な閾値を特定
    const bestThreshold = analyses.reduce((best, current) => 
      current.f1Score > best.f1Score ? current : best
    );
    
    console.log(`\n最適な距離閾値: ${bestThreshold.threshold.toFixed(1)}`);
    console.log(`最適なF1スコア: ${bestThreshold.f1Score.toFixed(3)}`);
    console.log(`最適な精度: ${bestThreshold.precision.toFixed(3)}`);
    console.log(`最適な再現率: ${bestThreshold.recall.toFixed(3)}`);
    
    return analyses;
    
  } catch (error) {
    console.error(`閾値分析エラー: ${error}`);
    return [];
  }
}

/**
 * 複数クエリでの距離分析を実行する
 */
async function runMultiQueryDistanceAnalysis(): Promise<void> {
  console.log('\n=== 複数クエリでの距離分析 ===');
  
  const testQueries = [
    {
      query: '教室管理の詳細は',
      expectedPages: [
        '160_【FIX】教室管理機能',
        '161_【FIX】教室一覧閲覧機能',
        '162_【FIX】教室新規登録機能',
        '163_【FIX】教室情報編集機能',
        '168_【FIX】教室コピー機能'
      ]
    },
    {
      query: '教室コピー機能でコピー可能な項目は？',
      expectedPages: [
        '168_【FIX】教室コピー機能',
        '教室コピー可能項目一覧',
        '教室コピー処理仕様',
        '【FIX】教室：基本情報／所在地',
        '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号'
      ]
    },
    {
      query: 'オファー機能の種類と使い方は？',
      expectedPages: [
        'オファー機能概要',
        'スカウトオファー機能',
        'マッチオファー機能',
        '共通オファー機能',
        'オファー通知機能'
      ]
    }
  ];
  
  const allAnalyses: DistanceAnalysis[] = [];
  
  for (const testQuery of testQueries) {
    const analysis = await analyzeVectorDistanceForQuery(testQuery.query);
    allAnalyses.push(analysis);
    
    // 距離閾値の最適化分析
    await analyzeDistanceThresholds(testQuery.query, testQuery.expectedPages);
  }
  
  // 全体の統計を計算
  console.log(`\n--- 全体統計 ---`);
  const allDistances = allAnalyses.flatMap(a => a.distances);
  const allScores = allAnalyses.flatMap(a => a.scores);
  const allCorrelations = allAnalyses.map(a => a.correlation);
  
  const overallStats = calculateDistanceStatistics(allDistances);
  const avgCorrelation = allCorrelations.reduce((sum, c) => sum + c, 0) / allCorrelations.length;
  
  console.log(`総検索結果数: ${allDistances.length}件`);
  console.log(`全体最小距離: ${overallStats.min.toFixed(4)}`);
  console.log(`全体最大距離: ${overallStats.max.toFixed(4)}`);
  console.log(`全体平均距離: ${overallStats.avg.toFixed(4)}`);
  console.log(`全体中央値距離: ${overallStats.median.toFixed(4)}`);
  console.log(`全体標準偏差: ${overallStats.stdDev.toFixed(4)}`);
  console.log(`平均相関係数: ${avgCorrelation.toFixed(4)}`);
  
  // 距離の一貫性を評価
  const distanceVariances = allAnalyses.map(a => a.stdDevDistance);
  const avgVariance = distanceVariances.reduce((sum, v) => sum + v, 0) / distanceVariances.length;
  
  console.log(`\n--- 距離の一貫性 ---`);
  console.log(`平均標準偏差: ${avgVariance.toFixed(4)}`);
  
  if (avgVariance < 0.1) {
    console.log('✅ 距離の一貫性: 良好 (低い分散)');
  } else if (avgVariance < 0.2) {
    console.log('⚠️ 距離の一貫性: 普通 (中程度の分散)');
  } else {
    console.log('❌ 距離の一貫性: 低い (高い分散)');
  }
}

/**
 * メインテスト実行関数
 */
async function runVectorDistanceAnalysisTest(): Promise<void> {
  console.log('🚀 ベクトル距離分析テスト開始');
  console.log('='.repeat(60));
  console.log(`テスト実行時刻: ${new Date().toISOString()}`);
  
  try {
    // 複数クエリでの距離分析
    await runMultiQueryDistanceAnalysis();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ ベクトル距離分析テスト完了');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runVectorDistanceAnalysisTest();
}

export { runVectorDistanceAnalysisTest, analyzeVectorDistanceForQuery, analyzeDistanceThresholds };
