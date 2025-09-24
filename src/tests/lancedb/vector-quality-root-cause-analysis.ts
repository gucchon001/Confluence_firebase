/**
 * ベクトル検索品質低下の根本原因分析
 * 
 * ラベルフィルタリングを除外し、以下の根本原因を特定します：
 * 1. 埋め込みモデルの不適切性
 * 2. 距離計算方法の問題
 * 3. ベクトル次元数の最適化
 * 4. クエリ前処理の改善
 * 5. ランキングアルゴリズムの不最適化
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

interface RootCauseAnalysis {
  query: string;
  embeddingModel: {
    dimensions: number;
    magnitude: number;
    distribution: {
      min: number;
      max: number;
      mean: number;
      std: number;
      skewness: number;
      kurtosis: number;
    };
    quality: {
      isNormalized: boolean;
      hasZeroVectors: boolean;
      distributionType: string;
    };
  };
  distanceCalculation: {
    minDistance: number;
    maxDistance: number;
    avgDistance: number;
    distanceStd: number;
    qualityThreshold: number;
    effectiveRange: number;
  };
  searchQuality: {
    precision: number;
    recall: number;
    f1Score: number;
    ndcg: number;
    rankingAccuracy: number;
  };
  recommendations: {
    embeddingModel: string[];
    distanceCalculation: string[];
    queryProcessing: string[];
    rankingAlgorithm: string[];
  };
}

/**
 * 統計値を計算する
 */
function calculateStatistics(values: number[]): {
  min: number;
  max: number;
  mean: number;
  std: number;
  skewness: number;
  kurtosis: number;
} {
  if (values.length === 0) {
    return { min: 0, max: 0, mean: 0, std: 0, skewness: 0, kurtosis: 0 };
  }
  
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);
  
  // 歪度（skewness）
  const skewness = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 3), 0) / values.length;
  
  // 尖度（kurtosis）
  const kurtosis = values.reduce((sum, val) => sum + Math.pow((val - mean) / std, 4), 0) / values.length - 3;
  
  return { min, max, mean, std, skewness, kurtosis };
}

/**
 * 埋め込みモデルの品質を分析する
 */
function analyzeEmbeddingModel(vector: number[]): {
  dimensions: number;
  magnitude: number;
  distribution: any;
  quality: {
    isNormalized: boolean;
    hasZeroVectors: boolean;
    distributionType: string;
  };
} {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  const distribution = calculateStatistics(vector);
  
  // 正規化の確認
  const isNormalized = Math.abs(magnitude - 1.0) < 0.01;
  
  // ゼロベクトルの確認
  const hasZeroVectors = vector.some(val => Math.abs(val) < 1e-10);
  
  // 分布のタイプを判定
  let distributionType = 'unknown';
  if (distribution.skewness > 0.5) {
    distributionType = 'right-skewed';
  } else if (distribution.skewness < -0.5) {
    distributionType = 'left-skewed';
  } else if (Math.abs(distribution.skewness) < 0.5) {
    distributionType = 'symmetric';
  }
  
  return {
    dimensions: vector.length,
    magnitude,
    distribution,
    quality: {
      isNormalized,
      hasZeroVectors,
      distributionType
    }
  };
}

/**
 * 距離計算の品質を分析する
 */
function analyzeDistanceCalculation(distances: number[]): {
  minDistance: number;
  maxDistance: number;
  avgDistance: number;
  distanceStd: number;
  qualityThreshold: number;
  effectiveRange: number;
} {
  const stats = calculateStatistics(distances);
  
  // 品質閾値を計算（距離の25%パーセンタイル）
  const sortedDistances = [...distances].sort((a, b) => a - b);
  const qualityThreshold = sortedDistances[Math.floor(sortedDistances.length * 0.25)];
  
  // 有効範囲を計算（距離の75%パーセンタイル）
  const effectiveRange = sortedDistances[Math.floor(sortedDistances.length * 0.75)];
  
  return {
    minDistance: stats.min,
    maxDistance: stats.max,
    avgDistance: stats.mean,
    distanceStd: stats.std,
    qualityThreshold,
    effectiveRange
  };
}

/**
 * 検索品質を分析する
 */
function analyzeSearchQuality(results: any[], expectedPages: string[]): {
  precision: number;
  recall: number;
  f1Score: number;
  ndcg: number;
  rankingAccuracy: number;
} {
  const foundPages = results
    .map(r => r.title)
    .filter(title => expectedPages.some(expected => title?.includes(expected)));
  
  const precision = results.length > 0 ? foundPages.length / results.length : 0;
  const recall = expectedPages.length > 0 ? foundPages.length / expectedPages.length : 0;
  const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  // NDCGの計算
  const actualOrder = results.map(r => r.title || '');
  const dcg = actualOrder.slice(0, 10).reduce((sum, item, index) => {
    const relevance = expectedPages.includes(item) ? 1 : 0;
    return sum + relevance / Math.log2(index + 2);
  }, 0);
  
  const idcg = expectedPages.slice(0, 10).reduce((sum, _, index) => {
    return sum + 1 / Math.log2(index + 2);
  }, 0);
  
  const ndcg = idcg > 0 ? dcg / idcg : 0;
  
  // ランキング精度の計算
  const rankingAccuracy = foundPages.length > 0 ? 
    foundPages.filter((_, index) => index < 5).length / Math.min(5, foundPages.length) : 0;
  
  return {
    precision,
    recall,
    f1Score,
    ndcg,
    rankingAccuracy
  };
}

/**
 * 根本原因分析を実行する
 */
async function analyzeRootCause(
  query: string,
  expectedPages: string[]
): Promise<RootCauseAnalysis> {
  console.log(`\n=== 根本原因分析: "${query}" ===`);
  
  try {
    // 埋め込みベクトルを生成
    const vector = await getEmbeddings(query);
    
    // 埋め込みモデルの分析
    const embeddingModel = analyzeEmbeddingModel(vector);
    
    console.log(`\n--- 埋め込みモデル分析 ---`);
    console.log(`次元数: ${embeddingModel.dimensions}`);
    console.log(`ベクトル大きさ: ${embeddingModel.magnitude.toFixed(4)}`);
    console.log(`正規化: ${embeddingModel.quality.isNormalized ? 'Yes' : 'No'}`);
    console.log(`ゼロベクトル: ${embeddingModel.quality.hasZeroVectors ? 'Yes' : 'No'}`);
    console.log(`分布タイプ: ${embeddingModel.quality.distributionType}`);
    console.log(`値の範囲: ${embeddingModel.distribution.min.toFixed(4)} - ${embeddingModel.distribution.max.toFixed(4)}`);
    console.log(`平均値: ${embeddingModel.distribution.mean.toFixed(4)}`);
    console.log(`標準偏差: ${embeddingModel.distribution.std.toFixed(4)}`);
    console.log(`歪度: ${embeddingModel.distribution.skewness.toFixed(4)}`);
    console.log(`尖度: ${embeddingModel.distribution.kurtosis.toFixed(4)}`);
    
    // LanceDBで検索
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    const results = await tbl.search(vector).limit(50).toArray();
    
    // 距離計算の分析
    const distances = results.map(r => r._distance || 0);
    const distanceCalculation = analyzeDistanceCalculation(distances);
    
    console.log(`\n--- 距離計算分析 ---`);
    console.log(`最小距離: ${distanceCalculation.minDistance.toFixed(4)}`);
    console.log(`最大距離: ${distanceCalculation.maxDistance.toFixed(4)}`);
    console.log(`平均距離: ${distanceCalculation.avgDistance.toFixed(4)}`);
    console.log(`距離標準偏差: ${distanceCalculation.distanceStd.toFixed(4)}`);
    console.log(`品質閾値: ${distanceCalculation.qualityThreshold.toFixed(4)}`);
    console.log(`有効範囲: ${distanceCalculation.effectiveRange.toFixed(4)}`);
    
    // 検索品質の分析
    const searchQuality = analyzeSearchQuality(results, expectedPages);
    
    console.log(`\n--- 検索品質分析 ---`);
    console.log(`精度: ${searchQuality.precision.toFixed(3)}`);
    console.log(`再現率: ${searchQuality.recall.toFixed(3)}`);
    console.log(`F1スコア: ${searchQuality.f1Score.toFixed(3)}`);
    console.log(`NDCG: ${searchQuality.ndcg.toFixed(3)}`);
    console.log(`ランキング精度: ${searchQuality.rankingAccuracy.toFixed(3)}`);
    
    // 推奨改善策の生成
    const recommendations = generateRecommendations(embeddingModel, distanceCalculation, searchQuality);
    
    console.log(`\n--- 推奨改善策 ---`);
    console.log(`埋め込みモデル:`);
    recommendations.embeddingModel.forEach(rec => console.log(`  - ${rec}`));
    console.log(`距離計算:`);
    recommendations.distanceCalculation.forEach(rec => console.log(`  - ${rec}`));
    console.log(`クエリ処理:`);
    recommendations.queryProcessing.forEach(rec => console.log(`  - ${rec}`));
    console.log(`ランキングアルゴリズム:`);
    recommendations.rankingAlgorithm.forEach(rec => console.log(`  - ${rec}`));
    
    return {
      query,
      embeddingModel,
      distanceCalculation,
      searchQuality,
      recommendations
    };
    
  } catch (error) {
    console.error('根本原因分析エラー:', error);
    throw error;
  }
}

/**
 * 推奨改善策を生成する
 */
function generateRecommendations(
  embeddingModel: any,
  distanceCalculation: any,
  searchQuality: any
): {
  embeddingModel: string[];
  distanceCalculation: string[];
  queryProcessing: string[];
  rankingAlgorithm: string[];
} {
  const recommendations = {
    embeddingModel: [] as string[],
    distanceCalculation: [] as string[],
    queryProcessing: [] as string[],
    rankingAlgorithm: [] as string[]
  };
  
  // 埋め込みモデルの推奨
  if (embeddingModel.dimensions !== 384) {
    recommendations.embeddingModel.push('ベクトル次元数を384から最適な値に調整');
  }
  
  if (!embeddingModel.quality.isNormalized) {
    recommendations.embeddingModel.push('ベクトルの正規化を実装');
  }
  
  if (embeddingModel.quality.hasZeroVectors) {
    recommendations.embeddingModel.push('ゼロベクトルの処理を改善');
  }
  
  if (embeddingModel.quality.distributionType === 'right-skewed' || embeddingModel.quality.distributionType === 'left-skewed') {
    recommendations.embeddingModel.push('ベクトル分布の正規化を実装');
  }
  
  if (embeddingModel.distribution.std > 0.1) {
    recommendations.embeddingModel.push('ベクトル値の分散を調整');
  }
  
  // 距離計算の推奨
  if (distanceCalculation.minDistance > 0.3) {
    recommendations.distanceCalculation.push('距離計算方法をコサイン距離に変更');
  }
  
  if (distanceCalculation.avgDistance > 0.7) {
    recommendations.distanceCalculation.push('距離閾値を0.7から0.5に調整');
  }
  
  if (distanceCalculation.qualityThreshold > 0.5) {
    recommendations.distanceCalculation.push('品質閾値を0.5から0.3に調整');
  }
  
  if (distanceCalculation.effectiveRange > 0.8) {
    recommendations.distanceCalculation.push('有効範囲を0.8から0.6に調整');
  }
  
  // クエリ処理の推奨
  if (searchQuality.precision < 0.1) {
    recommendations.queryProcessing.push('クエリ前処理の改善（キーワード抽出の最適化）');
  }
  
  if (searchQuality.recall < 0.3) {
    recommendations.queryProcessing.push('クエリ拡張の実装');
  }
  
  if (searchQuality.f1Score < 0.5) {
    recommendations.queryProcessing.push('同義語処理の強化');
  }
  
  // ランキングアルゴリズムの推奨
  if (searchQuality.ndcg < 0.5) {
    recommendations.rankingAlgorithm.push('RRF（Reciprocal Rank Fusion）の調整');
  }
  
  if (searchQuality.rankingAccuracy < 0.5) {
    recommendations.rankingAlgorithm.push('MMR（Maximal Marginal Relevance）の最適化');
  }
  
  if (searchQuality.f1Score < 0.5) {
    recommendations.rankingAlgorithm.push('重み付けバランスの見直し');
  }
  
  return recommendations;
}

/**
 * メイン調査関数
 */
async function investigateRootCause(): Promise<void> {
  console.log('🔍 ベクトル検索品質低下の根本原因分析');
  console.log('='.repeat(80));
  console.log(`分析開始時刻: ${new Date().toISOString()}`);
  
  const testCases = [
    {
      query: '教室管理の詳細は',
      expectedPages: [
        '160_【FIX】教室管理機能',
        '161_【FIX】教室一覧閲覧機能',
        '162_【FIX】教室新規登録機能',
        '163_【FIX】教室情報編集機能',
        '168_【FIX】教室コピー機能'
      ],
      description: '教室管理機能の詳細仕様'
    },
    {
      query: '教室コピー機能でコピー可能な項目は？',
      expectedPages: [
        '168_【FIX】教室コピー機能',
        '教室コピー可能項目一覧',
        '教室コピー処理仕様',
        '【FIX】教室：基本情報／所在地',
        '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号'
      ],
      description: '教室コピー機能のコピー可能項目'
    },
    {
      query: 'オファー機能の種類と使い方は？',
      expectedPages: [
        'オファー機能概要',
        'スカウトオファー機能',
        'マッチオファー機能',
        '共通オファー機能',
        'オファー通知機能'
      ],
      description: 'オファー機能の種類と使用方法'
    }
  ];
  
  const allAnalyses: RootCauseAnalysis[] = [];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`テストケース: ${testCase.description}`);
    console.log(`クエリ: "${testCase.query}"`);
    console.log(`期待ページ: ${testCase.expectedPages.join(', ')}`);
    
    try {
      const analysis = await analyzeRootCause(testCase.query, testCase.expectedPages);
      allAnalyses.push(analysis);
      
    } catch (error) {
      console.error(`テストケース "${testCase.query}" のエラー:`, error);
    }
  }
  
  // 全体の分析結果
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 根本原因分析結果');
  console.log('='.repeat(80));
  
  const avgF1Score = allAnalyses.reduce((sum, a) => sum + a.searchQuality.f1Score, 0) / allAnalyses.length;
  const avgNDCG = allAnalyses.reduce((sum, a) => sum + a.searchQuality.ndcg, 0) / allAnalyses.length;
  const avgPrecision = allAnalyses.reduce((sum, a) => sum + a.searchQuality.precision, 0) / allAnalyses.length;
  const avgRecall = allAnalyses.reduce((sum, a) => sum + a.searchQuality.recall, 0) / allAnalyses.length;
  
  console.log(`\n--- 検索品質サマリー ---`);
  console.log(`平均F1スコア: ${avgF1Score.toFixed(3)}`);
  console.log(`平均NDCG: ${avgNDCG.toFixed(3)}`);
  console.log(`平均精度: ${avgPrecision.toFixed(3)}`);
  console.log(`平均再現率: ${avgRecall.toFixed(3)}`);
  
  // 埋め込みモデルの分析
  const avgMagnitude = allAnalyses.reduce((sum, a) => sum + a.embeddingModel.magnitude, 0) / allAnalyses.length;
  const avgStd = allAnalyses.reduce((sum, a) => sum + a.embeddingModel.distribution.std, 0) / allAnalyses.length;
  
  console.log(`\n--- 埋め込みモデル分析 ---`);
  console.log(`平均ベクトル大きさ: ${avgMagnitude.toFixed(4)}`);
  console.log(`平均標準偏差: ${avgStd.toFixed(4)}`);
  
  // 距離計算の分析
  const avgMinDistance = allAnalyses.reduce((sum, a) => sum + a.distanceCalculation.minDistance, 0) / allAnalyses.length;
  const avgAvgDistance = allAnalyses.reduce((sum, a) => sum + a.distanceCalculation.avgDistance, 0) / allAnalyses.length;
  const avgQualityThreshold = allAnalyses.reduce((sum, a) => sum + a.distanceCalculation.qualityThreshold, 0) / allAnalyses.length;
  
  console.log(`\n--- 距離計算分析 ---`);
  console.log(`平均最小距離: ${avgMinDistance.toFixed(4)}`);
  console.log(`平均平均距離: ${avgAvgDistance.toFixed(4)}`);
  console.log(`平均品質閾値: ${avgQualityThreshold.toFixed(4)}`);
  
  // 根本原因の特定
  console.log(`\n--- 根本原因の特定 ---`);
  
  if (avgF1Score < 0.5) {
    console.log('❌ ベクトル検索の品質が大幅に低下している');
    console.log(`   平均F1スコア: ${avgF1Score.toFixed(3)} (目標: 0.7以上)`);
  }
  
  if (avgMinDistance > 0.3) {
    console.log('❌ 最小距離が高すぎる');
    console.log(`   平均最小距離: ${avgMinDistance.toFixed(4)} (目標: 0.3以下)`);
  }
  
  if (avgAvgDistance > 0.7) {
    console.log('❌ 平均距離が高すぎる');
    console.log(`   平均平均距離: ${avgAvgDistance.toFixed(4)} (目標: 0.7以下)`);
  }
  
  if (avgQualityThreshold > 0.5) {
    console.log('❌ 品質閾値が高すぎる');
    console.log(`   平均品質閾値: ${avgQualityThreshold.toFixed(4)} (目標: 0.5以下)`);
  }
  
  // 優先改善策
  console.log(`\n--- 優先改善策 ---`);
  console.log('1. 埋め込みモデルの見直し（より適切なモデルの選択）');
  console.log('2. 距離計算方法の改善（コサイン距離への変更）');
  console.log('3. 距離閾値の最適化（0.7から0.5への調整）');
  console.log('4. 品質閾値の調整（0.5から0.3への調整）');
  console.log('5. クエリ前処理の改善（キーワード抽出の最適化）');
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 根本原因分析完了');
}

// テスト実行
if (require.main === module) {
  investigateRootCause();
}

export { investigateRootCause };
