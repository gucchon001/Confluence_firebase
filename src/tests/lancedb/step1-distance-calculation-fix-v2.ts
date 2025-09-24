/**
 * ステップ1: 距離計算方法の修正（修正版）
 * 
 * LanceDBのAPIの違いを考慮して、別のアプローチで距離計算方法を変更する
 * 1. LanceDBの設定を確認
 * 2. コサイン距離への変更を実装
 * 3. 距離分布の分析と検証
 * 4. テストケースでの品質評価
 * 5. 改善効果の測定
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

interface DistanceComparison {
  query: string;
  euclidean: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
    avgDistance: number;
    minDistance: number;
    maxDistance: number;
  };
  cosine: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
    avgDistance: number;
    minDistance: number;
    maxDistance: number;
  };
  improvement: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
    avgDistance: number;
    minDistance: number;
    maxDistance: number;
  };
}

/**
 * コサイン距離を手動で計算する
 */
function calculateCosineDistance(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('ベクトルの次元が一致しません');
  }
  
  // ドット積を計算
  let dotProduct = 0;
  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
  }
  
  // 各ベクトルの大きさを計算
  const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
  
  // コサイン類似度を計算
  const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);
  
  // コサイン距離に変換（1 - コサイン類似度）
  return 1 - cosineSimilarity;
}

/**
 * 現在の距離計算方法（ユークリッド距離）で検索を実行する
 */
async function executeEuclideanSearch(query: string, topK: number = 50): Promise<any[]> {
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const vector = await getEmbeddings(query);
    // デフォルトはユークリッド距離（L2）
    const results = await tbl.search(vector).limit(topK).toArray();
    
    return results.map(result => ({
      id: result.id,
      title: result.title,
      content: result.content,
      distance: result._distance || 0,
      labels: result.labels?.toArray ? result.labels.toArray() : result.labels || [],
      vector: result.vector?.toArray ? result.vector.toArray() : result.vector
    }));
  } catch (error) {
    console.error('ユークリッド距離検索エラー:', error);
    return [];
  }
}

/**
 * コサイン距離で検索を実行する（手動計算）
 */
async function executeCosineSearch(query: string, topK: number = 50): Promise<any[]> {
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const queryVector = await getEmbeddings(query);
    
    // 全てのレコードを取得してコサイン距離を手動計算
    const allResults = await tbl.query().limit(1000).toArray();
    
    // コサイン距離を計算してソート
    const resultsWithCosineDistance = allResults.map(result => {
      const resultVector = result.vector?.toArray ? result.vector.toArray() : result.vector;
      if (!resultVector || !Array.isArray(resultVector)) {
        return null;
      }
      
      const cosineDistance = calculateCosineDistance(queryVector, resultVector);
      
      return {
        id: result.id,
        title: result.title,
        content: result.content,
        distance: cosineDistance,
        labels: result.labels?.toArray ? result.labels.toArray() : result.labels || [],
        vector: resultVector
      };
    }).filter(result => result !== null);
    
    // 距離でソートして上位を取得
    resultsWithCosineDistance.sort((a, b) => a!.distance - b!.distance);
    
    return resultsWithCosineDistance.slice(0, topK);
  } catch (error) {
    console.error('コサイン距離検索エラー:', error);
    return [];
  }
}

/**
 * 検索結果の品質を評価する
 */
function evaluateSearchQuality(results: any[], expectedPages: string[]): {
  f1Score: number;
  precision: number;
  recall: number;
  ndcg: number;
  avgDistance: number;
  minDistance: number;
  maxDistance: number;
} {
  const distances = results.map(r => r.distance);
  const avgDistance = distances.length > 0 ? distances.reduce((sum, d) => sum + d, 0) / distances.length : 0;
  const minDistance = distances.length > 0 ? Math.min(...distances) : 0;
  const maxDistance = distances.length > 0 ? Math.max(...distances) : 0;
  
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
  
  return {
    f1Score,
    precision,
    recall,
    ndcg,
    avgDistance,
    minDistance,
    maxDistance
  };
}

/**
 * 距離計算方法の比較分析を実行する
 */
async function compareDistanceMethods(query: string, expectedPages: string[]): Promise<DistanceComparison> {
  console.log(`\n=== 距離計算方法比較: "${query}" ===`);
  
  // ユークリッド距離での検索
  console.log('ユークリッド距離での検索を実行中...');
  const euclideanResults = await executeEuclideanSearch(query, 50);
  const euclideanQuality = evaluateSearchQuality(euclideanResults, expectedPages);
  
  console.log('ユークリッド距離結果:');
  console.log(`  結果数: ${euclideanResults.length}件`);
  console.log(`  F1スコア: ${euclideanQuality.f1Score.toFixed(3)}`);
  console.log(`  精度: ${euclideanQuality.precision.toFixed(3)}`);
  console.log(`  再現率: ${euclideanQuality.recall.toFixed(3)}`);
  console.log(`  NDCG: ${euclideanQuality.ndcg.toFixed(3)}`);
  console.log(`  平均距離: ${euclideanQuality.avgDistance.toFixed(4)}`);
  console.log(`  最小距離: ${euclideanQuality.minDistance.toFixed(4)}`);
  console.log(`  最大距離: ${euclideanQuality.maxDistance.toFixed(4)}`);
  
  // コサイン距離での検索
  console.log('\nコサイン距離での検索を実行中...');
  const cosineResults = await executeCosineSearch(query, 50);
  const cosineQuality = evaluateSearchQuality(cosineResults, expectedPages);
  
  console.log('コサイン距離結果:');
  console.log(`  結果数: ${cosineResults.length}件`);
  console.log(`  F1スコア: ${cosineQuality.f1Score.toFixed(3)}`);
  console.log(`  精度: ${cosineQuality.precision.toFixed(3)}`);
  console.log(`  再現率: ${cosineQuality.recall.toFixed(3)}`);
  console.log(`  NDCG: ${cosineQuality.ndcg.toFixed(3)}`);
  console.log(`  平均距離: ${cosineQuality.avgDistance.toFixed(4)}`);
  console.log(`  最小距離: ${cosineQuality.minDistance.toFixed(4)}`);
  console.log(`  最大距離: ${cosineQuality.maxDistance.toFixed(4)}`);
  
  // 改善効果の計算
  const improvement = {
    f1Score: cosineQuality.f1Score - euclideanQuality.f1Score,
    precision: cosineQuality.precision - euclideanQuality.precision,
    recall: cosineQuality.recall - euclideanQuality.recall,
    ndcg: cosineQuality.ndcg - euclideanQuality.ndcg,
    avgDistance: cosineQuality.avgDistance - euclideanQuality.avgDistance,
    minDistance: cosineQuality.minDistance - euclideanQuality.minDistance,
    maxDistance: cosineQuality.maxDistance - euclideanQuality.maxDistance
  };
  
  console.log('\n改善効果:');
  console.log(`  F1スコア: ${improvement.f1Score >= 0 ? '+' : ''}${improvement.f1Score.toFixed(3)}`);
  console.log(`  精度: ${improvement.precision >= 0 ? '+' : ''}${improvement.precision.toFixed(3)}`);
  console.log(`  再現率: ${improvement.recall >= 0 ? '+' : ''}${improvement.recall.toFixed(3)}`);
  console.log(`  NDCG: ${improvement.ndcg >= 0 ? '+' : ''}${improvement.ndcg.toFixed(3)}`);
  console.log(`  平均距離: ${improvement.avgDistance >= 0 ? '+' : ''}${improvement.avgDistance.toFixed(4)}`);
  console.log(`  最小距離: ${improvement.minDistance >= 0 ? '+' : ''}${improvement.minDistance.toFixed(4)}`);
  console.log(`  最大距離: ${improvement.maxDistance >= 0 ? '+' : ''}${improvement.maxDistance.toFixed(4)}`);
  
  return {
    query,
    euclidean: euclideanQuality,
    cosine: cosineQuality,
    improvement
  };
}

/**
 * 距離分布の詳細分析を実行する
 */
async function analyzeDistanceDistribution(query: string): Promise<void> {
  console.log(`\n=== 距離分布分析: "${query}" ===`);
  
  try {
    const queryVector = await getEmbeddings(query);
    
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    // ユークリッド距離での検索
    const euclideanResults = await tbl.search(queryVector).limit(100).toArray();
    const euclideanDistances = euclideanResults.map(r => r._distance || 0);
    
    // コサイン距離での検索（手動計算）
    const allResults = await tbl.query().limit(1000).toArray();
    const cosineDistances = allResults
      .map(result => {
        const resultVector = result.vector?.toArray ? result.vector.toArray() : result.vector;
        if (!resultVector || !Array.isArray(resultVector)) {
          return null;
        }
        return calculateCosineDistance(queryVector, resultVector);
      })
      .filter(distance => distance !== null) as number[];
    
    // 統計の計算
    const calculateStats = (distances: number[]) => {
      const sorted = [...distances].sort((a, b) => a - b);
      return {
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: distances.reduce((sum, d) => sum + d, 0) / distances.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p25: sorted[Math.floor(sorted.length * 0.25)],
        p75: sorted[Math.floor(sorted.length * 0.75)],
        p90: sorted[Math.floor(sorted.length * 0.90)],
        p95: sorted[Math.floor(sorted.length * 0.95)]
      };
    };
    
    const euclideanStats = calculateStats(euclideanDistances);
    const cosineStats = calculateStats(cosineDistances);
    
    console.log('\nユークリッド距離分布:');
    console.log(`  最小: ${euclideanStats.min.toFixed(4)}`);
    console.log(`  最大: ${euclideanStats.max.toFixed(4)}`);
    console.log(`  平均: ${euclideanStats.mean.toFixed(4)}`);
    console.log(`  中央値: ${euclideanStats.median.toFixed(4)}`);
    console.log(`  25%: ${euclideanStats.p25.toFixed(4)}`);
    console.log(`  75%: ${euclideanStats.p75.toFixed(4)}`);
    console.log(`  90%: ${euclideanStats.p90.toFixed(4)}`);
    console.log(`  95%: ${euclideanStats.p95.toFixed(4)}`);
    
    console.log('\nコサイン距離分布:');
    console.log(`  最小: ${cosineStats.min.toFixed(4)}`);
    console.log(`  最大: ${cosineStats.max.toFixed(4)}`);
    console.log(`  平均: ${cosineStats.mean.toFixed(4)}`);
    console.log(`  中央値: ${cosineStats.median.toFixed(4)}`);
    console.log(`  25%: ${cosineStats.p25.toFixed(4)}`);
    console.log(`  75%: ${cosineStats.p75.toFixed(4)}`);
    console.log(`  90%: ${cosineStats.p90.toFixed(4)}`);
    console.log(`  95%: ${cosineStats.p95.toFixed(4)}`);
    
    // 改善効果の分析
    const distanceImprovement = {
      min: cosineStats.min - euclideanStats.min,
      max: cosineStats.max - euclideanStats.max,
      mean: cosineStats.mean - euclideanStats.mean,
      median: cosineStats.median - euclideanStats.median
    };
    
    console.log('\n距離改善効果:');
    console.log(`  最小距離: ${distanceImprovement.min >= 0 ? '+' : ''}${distanceImprovement.min.toFixed(4)}`);
    console.log(`  最大距離: ${distanceImprovement.max >= 0 ? '+' : ''}${distanceImprovement.max.toFixed(4)}`);
    console.log(`  平均距離: ${distanceImprovement.mean >= 0 ? '+' : ''}${distanceImprovement.mean.toFixed(4)}`);
    console.log(`  中央値距離: ${distanceImprovement.median >= 0 ? '+' : ''}${distanceImprovement.median.toFixed(4)}`);
    
  } catch (error) {
    console.error('距離分布分析エラー:', error);
  }
}

/**
 * ステップ1のメイン実行関数
 */
async function executeStep1(): Promise<void> {
  console.log('🔧 ステップ1: 距離計算方法の修正（修正版）');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
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
  
  const allComparisons: DistanceComparison[] = [];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`テストケース: ${testCase.description}`);
    console.log(`クエリ: "${testCase.query}"`);
    console.log(`期待ページ: ${testCase.expectedPages.join(', ')}`);
    
    try {
      // 距離計算方法の比較
      const comparison = await compareDistanceMethods(testCase.query, testCase.expectedPages);
      allComparisons.push(comparison);
      
      // 距離分布の分析
      await analyzeDistanceDistribution(testCase.query);
      
    } catch (error) {
      console.error(`テストケース "${testCase.query}" のエラー:`, error);
    }
  }
  
  // 全体の分析結果
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 ステップ1: 距離計算方法修正の結果');
  console.log('='.repeat(80));
  
  const avgEuclideanF1 = allComparisons.reduce((sum, c) => sum + c.euclidean.f1Score, 0) / allComparisons.length;
  const avgCosineF1 = allComparisons.reduce((sum, c) => sum + c.cosine.f1Score, 0) / allComparisons.length;
  const avgEuclideanDistance = allComparisons.reduce((sum, c) => sum + c.euclidean.avgDistance, 0) / allComparisons.length;
  const avgCosineDistance = allComparisons.reduce((sum, c) => sum + c.cosine.avgDistance, 0) / allComparisons.length;
  const avgEuclideanMinDistance = allComparisons.reduce((sum, c) => sum + c.euclidean.minDistance, 0) / allComparisons.length;
  const avgCosineMinDistance = allComparisons.reduce((sum, c) => sum + c.cosine.minDistance, 0) / allComparisons.length;
  
  console.log(`\n--- 平均品質比較 ---`);
  console.log(`ユークリッド距離 - 平均F1スコア: ${avgEuclideanF1.toFixed(3)}`);
  console.log(`コサイン距離 - 平均F1スコア: ${avgCosineF1.toFixed(3)}`);
  console.log(`F1スコア改善: ${(avgCosineF1 - avgEuclideanF1).toFixed(3)} (${((avgCosineF1 - avgEuclideanF1) / avgEuclideanF1 * 100).toFixed(1)}%)`);
  
  console.log(`\n--- 平均距離比較 ---`);
  console.log(`ユークリッド距離 - 平均距離: ${avgEuclideanDistance.toFixed(4)}`);
  console.log(`コサイン距離 - 平均距離: ${avgCosineDistance.toFixed(4)}`);
  console.log(`平均距離改善: ${(avgCosineDistance - avgEuclideanDistance).toFixed(4)}`);
  
  console.log(`\n--- 最小距離比較 ---`);
  console.log(`ユークリッド距離 - 平均最小距離: ${avgEuclideanMinDistance.toFixed(4)}`);
  console.log(`コサイン距離 - 平均最小距離: ${avgCosineMinDistance.toFixed(4)}`);
  console.log(`最小距離改善: ${(avgCosineMinDistance - avgEuclideanMinDistance).toFixed(4)}`);
  
  // 改善効果の評価
  console.log(`\n--- 改善効果の評価 ---`);
  if (avgCosineF1 > avgEuclideanF1) {
    const improvement = ((avgCosineF1 - avgEuclideanF1) / avgEuclideanF1 * 100);
    console.log(`✅ F1スコアが改善されました: ${improvement.toFixed(1)}%向上`);
  } else {
    console.log(`❌ F1スコアが改善されませんでした`);
  }
  
  if (avgCosineMinDistance < avgEuclideanMinDistance) {
    const improvement = ((avgEuclideanMinDistance - avgCosineMinDistance) / avgEuclideanMinDistance * 100);
    console.log(`✅ 最小距離が改善されました: ${improvement.toFixed(1)}%減少`);
  } else {
    console.log(`❌ 最小距離が改善されませんでした`);
  }
  
  // 次のステップの推奨
  console.log(`\n--- 次のステップ ---`);
  if (avgCosineF1 > avgEuclideanF1 && avgCosineMinDistance < avgEuclideanMinDistance) {
    console.log('✅ コサイン距離への変更が効果的です');
    console.log('📋 推奨アクション:');
    console.log('  1. LanceDBの検索クライアントをコサイン距離に変更');
    console.log('  2. ステップ2（距離閾値の最適化）に進む');
  } else {
    console.log('⚠️ コサイン距離への変更の効果が限定的です');
    console.log('📋 推奨アクション:');
    console.log('  1. 他の距離計算方法を検討（ドット積など）');
    console.log('  2. 埋め込みモデルの見直しを優先する');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ステップ1: 距離計算方法の修正完了');
}

// テスト実行
if (require.main === module) {
  executeStep1();
}

export { executeStep1 };
