/**
 * ラベルフィルタリング除外でのベクトル検索品質調査
 * 
 * このスクリプトは以下の項目を詳細に調査します：
 * 1. フィルタリングなしでのベクトル検索品質
 * 2. 距離分布の詳細分析
 * 3. 埋め込みベクトルの品質分析
 * 4. 検索結果の関連性分析
 * 5. ベクトル検索の根本問題の特定
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

interface VectorSearchAnalysis {
  query: string;
  vectorMetrics: {
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
  };
  searchMetrics: {
    totalResults: number;
    distanceStats: {
      min: number;
      max: number;
      mean: number;
      std: number;
      percentiles: {
        p10: number;
        p25: number;
        p50: number;
        p75: number;
        p90: number;
        p95: number;
        p99: number;
      };
    };
    qualityDistribution: {
      highQuality: number; // 距離 < 0.3
      mediumQuality: number; // 0.3 <= 距離 < 0.6
      lowQuality: number; // 距離 >= 0.6
    };
  };
  relevanceAnalysis: {
    expectedPages: string[];
    foundPages: string[];
    missedPages: string[];
    falsePositives: string[];
    precision: number;
    recall: number;
    f1Score: number;
  };
  rankingQuality: {
    expectedOrder: string[];
    actualOrder: string[];
    rankingAccuracy: number;
    ndcg: number;
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
 * パーセンタイルを計算する
 */
function calculatePercentiles(values: number[]): {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
} {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  const getPercentile = (p: number) => {
    const index = Math.floor(n * p / 100);
    return sorted[Math.min(index, n - 1)];
  };
  
  return {
    p10: getPercentile(10),
    p25: getPercentile(25),
    p50: getPercentile(50),
    p75: getPercentile(75),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99)
  };
}

/**
 * NDCG（Normalized Discounted Cumulative Gain）を計算する
 */
function calculateNDCG(actualOrder: string[], expectedOrder: string[], k: number = 10): number {
  const dcg = actualOrder.slice(0, k).reduce((sum, item, index) => {
    const relevance = expectedOrder.includes(item) ? 1 : 0;
    return sum + relevance / Math.log2(index + 2);
  }, 0);
  
  const idcg = expectedOrder.slice(0, k).reduce((sum, _, index) => {
    return sum + 1 / Math.log2(index + 2);
  }, 0);
  
  return idcg > 0 ? dcg / idcg : 0;
}

/**
 * フィルタリングなしでベクトル検索を実行する
 */
async function executeVectorSearchNoFiltering(query: string, topK: number = 50): Promise<any[]> {
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const vector = await getEmbeddings(query);
    const results = await tbl.search(vector).limit(topK).toArray();
    
    return results.map(result => ({
      id: result.id,
      title: result.title,
      content: result.content,
      distance: result._distance || 0,
      labels: result.labels?.toArray ? result.labels.toArray() : result.labels || [],
      source: 'vector'
    }));
  } catch (error) {
    console.error('ベクトル検索エラー:', error);
    return [];
  }
}

/**
 * ベクトル検索の詳細分析を実行する（フィルタリングなし）
 */
async function analyzeVectorSearchNoFiltering(
  query: string,
  expectedPages: string[]
): Promise<VectorSearchAnalysis> {
  console.log(`\n=== ベクトル検索詳細分析（フィルタリングなし）: "${query}" ===`);
  
  try {
    // 埋め込みベクトルを生成
    const vector = await getEmbeddings(query);
    
    // ベクトルの統計を計算
    const vectorStats = calculateStatistics(vector);
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    console.log(`ベクトル次元数: ${vector.length}`);
    console.log(`ベクトル大きさ: ${magnitude.toFixed(4)}`);
    console.log(`値の範囲: ${vectorStats.min.toFixed(4)} - ${vectorStats.max.toFixed(4)}`);
    console.log(`平均値: ${vectorStats.mean.toFixed(4)}`);
    console.log(`標準偏差: ${vectorStats.std.toFixed(4)}`);
    console.log(`歪度: ${vectorStats.skewness.toFixed(4)}`);
    console.log(`尖度: ${vectorStats.kurtosis.toFixed(4)}`);
    
    // フィルタリングなしでベクトル検索を実行
    const results = await executeVectorSearchNoFiltering(query, 50);
    
    console.log(`検索結果数: ${results.length}件`);
    
    // 距離の統計を計算
    const distances = results.map(r => r.distance);
    const distanceStats = calculateStatistics(distances);
    const distancePercentiles = calculatePercentiles(distances);
    
    console.log(`\n距離統計:`);
    console.log(`最小: ${distanceStats.min.toFixed(4)}`);
    console.log(`最大: ${distanceStats.max.toFixed(4)}`);
    console.log(`平均: ${distanceStats.mean.toFixed(4)}`);
    console.log(`標準偏差: ${distanceStats.std.toFixed(4)}`);
    console.log(`10%: ${distancePercentiles.p10.toFixed(4)}`);
    console.log(`25%: ${distancePercentiles.p25.toFixed(4)}`);
    console.log(`50%: ${distancePercentiles.p50.toFixed(4)}`);
    console.log(`75%: ${distancePercentiles.p75.toFixed(4)}`);
    console.log(`90%: ${distancePercentiles.p90.toFixed(4)}`);
    console.log(`95%: ${distancePercentiles.p95.toFixed(4)}`);
    console.log(`99%: ${distancePercentiles.p99.toFixed(4)}`);
    
    // 品質分布を計算
    const highQuality = distances.filter(d => d < 0.3).length;
    const mediumQuality = distances.filter(d => d >= 0.3 && d < 0.6).length;
    const lowQuality = distances.filter(d => d >= 0.6).length;
    
    console.log(`\n品質分布:`);
    console.log(`高品質 (距離 < 0.3): ${highQuality}件 (${(highQuality / distances.length * 100).toFixed(1)}%)`);
    console.log(`中品質 (0.3 <= 距離 < 0.6): ${mediumQuality}件 (${(mediumQuality / distances.length * 100).toFixed(1)}%)`);
    console.log(`低品質 (距離 >= 0.6): ${lowQuality}件 (${(lowQuality / distances.length * 100).toFixed(1)}%)`);
    
    // 関連性分析
    const foundPages = results
      .map(r => r.title)
      .filter(title => expectedPages.some(expected => title?.includes(expected)));
    
    const missedPages = expectedPages.filter(expected => 
      !results.some(r => r.title?.includes(expected))
    );
    
    const falsePositives = results
      .map(r => r.title)
      .filter(title => !expectedPages.some(expected => title?.includes(expected)));
    
    const precision = results.length > 0 ? foundPages.length / results.length : 0;
    const recall = expectedPages.length > 0 ? foundPages.length / expectedPages.length : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    console.log(`\n関連性分析:`);
    console.log(`期待ページ: ${expectedPages.length}件`);
    console.log(`発見ページ: ${foundPages.length}件`);
    console.log(`見逃しページ: ${missedPages.length}件`);
    console.log(`偽陽性: ${falsePositives.length}件`);
    console.log(`精度: ${precision.toFixed(3)}`);
    console.log(`再現率: ${recall.toFixed(3)}`);
    console.log(`F1スコア: ${f1Score.toFixed(3)}`);
    
    if (missedPages.length > 0) {
      console.log(`\n見逃しページ:`);
      missedPages.forEach(page => console.log(`  - ${page}`));
    }
    
    if (falsePositives.length > 0) {
      console.log(`\n偽陽性ページ（上位10件）:`);
      falsePositives.slice(0, 10).forEach(page => console.log(`  - ${page}`));
      if (falsePositives.length > 10) {
        console.log(`  ... 他${falsePositives.length - 10}件`);
      }
    }
    
    // ランキング品質分析
    const actualOrder = results.map(r => r.title || '');
    const rankingAccuracy = foundPages.length > 0 ? 
      foundPages.filter((_, index) => index < 5).length / Math.min(5, foundPages.length) : 0;
    const ndcg = calculateNDCG(actualOrder, expectedPages, 10);
    
    console.log(`\nランキング品質:`);
    console.log(`ランキング精度: ${rankingAccuracy.toFixed(3)}`);
    console.log(`NDCG@10: ${ndcg.toFixed(3)}`);
    
    // 上位10件の結果を表示
    console.log(`\n上位10件の結果:`);
    results.slice(0, 10).forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   ID: ${result.id}`);
      console.log(`   距離: ${result.distance?.toFixed(4) || 'N/A'}`);
      console.log(`   ラベル: ${result.labels?.join(', ') || 'なし'}`);
      console.log('');
    });
    
    return {
      query,
      vectorMetrics: {
        dimensions: vector.length,
        magnitude,
        distribution: vectorStats
      },
      searchMetrics: {
        totalResults: results.length,
        distanceStats: {
          ...distanceStats,
          percentiles: distancePercentiles
        },
        qualityDistribution: {
          highQuality,
          mediumQuality,
          lowQuality
        }
      },
      relevanceAnalysis: {
        expectedPages,
        foundPages,
        missedPages,
        falsePositives,
        precision,
        recall,
        f1Score
      },
      rankingQuality: {
        expectedOrder: expectedPages,
        actualOrder,
        rankingAccuracy,
        ndcg
      }
    };
    
  } catch (error) {
    console.error('詳細分析エラー:', error);
    throw error;
  }
}

/**
 * 距離閾値による品質の変化を分析する（フィルタリングなし）
 */
async function analyzeDistanceThresholdsNoFiltering(query: string, expectedPages: string[]): Promise<void> {
  console.log(`\n=== 距離閾値分析（フィルタリングなし）: "${query}" ===`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const vector = await getEmbeddings(query);
    const allResults = await tbl.search(vector).limit(100).toArray();
    
    const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    
    for (const threshold of thresholds) {
      const filteredResults = allResults.filter(r => (r._distance || 0) <= threshold);
      
      const formattedResults = filteredResults.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        distance: result._distance || 0,
        labels: result.labels?.toArray ? result.labels.toArray() : result.labels || []
      }));
      
      const foundPages = formattedResults
        .map(r => r.title)
        .filter(title => expectedPages.some(expected => title?.includes(expected)));
      
      const precision = formattedResults.length > 0 ? foundPages.length / formattedResults.length : 0;
      const recall = expectedPages.length > 0 ? foundPages.length / expectedPages.length : 0;
      const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
      
      console.log(`閾値 ${threshold.toFixed(1)}: ${formattedResults.length}件, 精度=${precision.toFixed(3)}, 再現率=${recall.toFixed(3)}, F1=${f1Score.toFixed(3)}`);
    }
    
  } catch (error) {
    console.error('距離閾値分析エラー:', error);
  }
}

/**
 * メイン調査関数
 */
async function investigateVectorQualityNoFiltering(): Promise<void> {
  console.log('🔍 ベクトル検索品質調査（ラベルフィルタリング除外）');
  console.log('='.repeat(80));
  console.log(`調査開始時刻: ${new Date().toISOString()}`);
  
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
  
  const allAnalyses: VectorSearchAnalysis[] = [];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`テストケース: ${testCase.description}`);
    console.log(`クエリ: "${testCase.query}"`);
    console.log(`期待ページ: ${testCase.expectedPages.join(', ')}`);
    
    try {
      // 1. ベクトル検索の詳細分析
      const analysis = await analyzeVectorSearchNoFiltering(testCase.query, testCase.expectedPages);
      allAnalyses.push(analysis);
      
      // 2. 距離閾値分析
      await analyzeDistanceThresholdsNoFiltering(testCase.query, testCase.expectedPages);
      
      // 3. 問題の特定
      if (analysis.relevanceAnalysis.f1Score < 0.5) {
        console.log(`❌ 低品質検索: F1スコア ${analysis.relevanceAnalysis.f1Score.toFixed(3)} < 0.5`);
      } else if (analysis.relevanceAnalysis.f1Score < 0.7) {
        console.log(`⚠️ 中品質検索: F1スコア ${analysis.relevanceAnalysis.f1Score.toFixed(3)} < 0.7`);
      } else {
        console.log(`✅ 高品質検索: F1スコア ${analysis.relevanceAnalysis.f1Score.toFixed(3)} >= 0.7`);
      }
      
      if (analysis.searchMetrics.qualityDistribution.lowQuality > analysis.searchMetrics.totalResults * 0.5) {
        console.log(`❌ 低品質結果が多い: ${analysis.searchMetrics.qualityDistribution.lowQuality}件 (${(analysis.searchMetrics.qualityDistribution.lowQuality / analysis.searchMetrics.totalResults * 100).toFixed(1)}%)`);
      }
      
      if (analysis.rankingQuality.ndcg < 0.5) {
        console.log(`❌ ランキング品質が低い: NDCG ${analysis.rankingQuality.ndcg.toFixed(3)} < 0.5`);
      }
      
    } catch (error) {
      console.error(`テストケース "${testCase.query}" のエラー:`, error);
    }
  }
  
  // 全体の分析結果
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 全体分析結果（フィルタリングなし）');
  console.log('='.repeat(80));
  
  const avgF1Score = allAnalyses.reduce((sum, a) => sum + a.relevanceAnalysis.f1Score, 0) / allAnalyses.length;
  const avgNDCG = allAnalyses.reduce((sum, a) => sum + a.rankingQuality.ndcg, 0) / allAnalyses.length;
  const avgPrecision = allAnalyses.reduce((sum, a) => sum + a.relevanceAnalysis.precision, 0) / allAnalyses.length;
  const avgRecall = allAnalyses.reduce((sum, a) => sum + a.relevanceAnalysis.recall, 0) / allAnalyses.length;
  
  console.log(`平均F1スコア: ${avgF1Score.toFixed(3)}`);
  console.log(`平均NDCG: ${avgNDCG.toFixed(3)}`);
  console.log(`平均精度: ${avgPrecision.toFixed(3)}`);
  console.log(`平均再現率: ${avgRecall.toFixed(3)}`);
  
  // 距離分布の分析
  const avgHighQuality = allAnalyses.reduce((sum, a) => sum + a.searchMetrics.qualityDistribution.highQuality, 0) / allAnalyses.length;
  const avgMediumQuality = allAnalyses.reduce((sum, a) => sum + a.searchMetrics.qualityDistribution.mediumQuality, 0) / allAnalyses.length;
  const avgLowQuality = allAnalyses.reduce((sum, a) => sum + a.searchMetrics.qualityDistribution.lowQuality, 0) / allAnalyses.length;
  const avgTotalResults = allAnalyses.reduce((sum, a) => sum + a.searchMetrics.totalResults, 0) / allAnalyses.length;
  
  console.log(`\n距離分布（平均）:`);
  console.log(`高品質 (距離 < 0.3): ${avgHighQuality.toFixed(1)}件 (${(avgHighQuality / avgTotalResults * 100).toFixed(1)}%)`);
  console.log(`中品質 (0.3 <= 距離 < 0.6): ${avgMediumQuality.toFixed(1)}件 (${(avgMediumQuality / avgTotalResults * 100).toFixed(1)}%)`);
  console.log(`低品質 (距離 >= 0.6): ${avgLowQuality.toFixed(1)}件 (${(avgLowQuality / avgTotalResults * 100).toFixed(1)}%)`);
  
  // 問題の特定
  console.log(`\n--- 問題の特定 ---`);
  if (avgF1Score < 0.5) {
    console.log('❌ ベクトル検索の品質が大幅に低下している');
    console.log(`   平均F1スコア: ${avgF1Score.toFixed(3)} (目標: 0.7以上)`);
  } else if (avgF1Score < 0.7) {
    console.log('⚠️ ベクトル検索の品質が低下している');
    console.log(`   平均F1スコア: ${avgF1Score.toFixed(3)} (目標: 0.7以上)`);
  } else {
    console.log('✅ ベクトル検索の品質は良好');
  }
  
  if (avgNDCG < 0.5) {
    console.log('❌ ランキング品質が大幅に低下している');
    console.log(`   平均NDCG: ${avgNDCG.toFixed(3)} (目標: 0.7以上)`);
  } else if (avgNDCG < 0.7) {
    console.log('⚠️ ランキング品質が低下している');
    console.log(`   平均NDCG: ${avgNDCG.toFixed(3)} (目標: 0.7以上)`);
  } else {
    console.log('✅ ランキング品質は良好');
  }
  
  // 根本原因の分析
  console.log(`\n--- 根本原因の分析 ---`);
  if (avgHighQuality / avgTotalResults < 0.1) {
    console.log('❌ 高品質結果が極めて少ない（< 10%）');
    console.log('   原因: 埋め込みモデルの不適切性または距離計算の問題');
  }
  
  if (avgLowQuality / avgTotalResults > 0.8) {
    console.log('❌ 低品質結果が多すぎる（> 80%）');
    console.log('   原因: ベクトル埋め込みの品質問題または距離閾値の不適切性');
  }
  
  if (avgPrecision < 0.1) {
    console.log('❌ 精度が極めて低い（< 10%）');
    console.log('   原因: 検索結果の関連性が低い、期待ページとの不一致');
  }
  
  if (avgRecall < 0.3) {
    console.log('❌ 再現率が低い（< 30%）');
    console.log('   原因: 期待ページを発見できない、埋め込みベクトルの表現力不足');
  }
  
  // 推奨改善策
  console.log(`\n--- 推奨改善策 ---`);
  if (avgF1Score < 0.5) {
    console.log('1. 埋め込みモデルの見直し（より適切なモデルの選択）');
    console.log('2. ベクトル次元数の最適化（現在の384次元の見直し）');
    console.log('3. 距離計算方法の改善（コサイン距離 vs ユークリッド距離）');
    console.log('4. クエリ前処理の改善（キーワード抽出の最適化）');
  }
  
  if (avgNDCG < 0.5) {
    console.log('5. ランキングアルゴリズムの改善');
    console.log('6. 重み付けの調整（距離とスコアの重みバランス）');
    console.log('7. 結果の多様性向上（MMRの調整）');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ベクトル検索品質調査（フィルタリング除外）完了');
}

// テスト実行
if (require.main === module) {
  investigateVectorQualityNoFiltering();
}

export { investigateVectorQualityNoFiltering };
