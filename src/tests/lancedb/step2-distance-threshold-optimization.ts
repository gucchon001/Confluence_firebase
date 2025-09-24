/**
 * ステップ2: 距離閾値の最適化
 * 
 * 現在のユークリッド距離のまま、距離閾値を調整して品質を改善する
 * 1. 現在の閾値設定を確認
 * 2. 動的閾値調整機能を実装
 * 3. 閾値による品質変化の分析
 * 4. 最適な閾値の特定
 * 5. 新しい閾値でのテスト
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

interface ThresholdAnalysis {
  threshold: number;
  qualityThreshold: number;
  f1Score: number;
  precision: number;
  recall: number;
  ndcg: number;
  avgDistance: number;
  minDistance: number;
  maxDistance: number;
  resultCount: number;
  relevantCount: number;
}

interface ThresholdOptimizationResult {
  query: string;
  currentThreshold: number;
  currentQualityThreshold: number;
  optimalThreshold: number;
  optimalQualityThreshold: number;
  improvement: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
  };
  allAnalyses: ThresholdAnalysis[];
}

/**
 * 指定された閾値で検索を実行する
 */
async function executeSearchWithThresholds(
  query: string, 
  distanceThreshold: number, 
  qualityThreshold: number,
  topK: number = 50
): Promise<any[]> {
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const vector = await getEmbeddings(query);
    const results = await tbl.search(vector).limit(topK * 2).toArray();
    
    // 距離閾値でフィルタリング
    const filteredResults = results.filter(result => {
      const distance = result._distance || 0;
      return distance <= distanceThreshold;
    });
    
    // 品質閾値でフィルタリング（距離が品質閾値以下の場合）
    const qualityFilteredResults = filteredResults.filter(result => {
      const distance = result._distance || 0;
      return distance <= qualityThreshold;
    });
    
    return qualityFilteredResults.map(result => ({
      id: result.id,
      title: result.title,
      content: result.content,
      distance: result._distance || 0,
      labels: result.labels?.toArray ? result.labels.toArray() : result.labels || []
    }));
  } catch (error) {
    console.error('閾値検索エラー:', error);
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
  resultCount: number;
  relevantCount: number;
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
    maxDistance,
    resultCount: results.length,
    relevantCount: foundPages.length
  };
}

/**
 * 距離閾値の最適化分析を実行する
 */
async function analyzeThresholdOptimization(
  query: string, 
  expectedPages: string[]
): Promise<ThresholdOptimizationResult> {
  console.log(`\n=== 距離閾値最適化分析: "${query}" ===`);
  
  // 現在の閾値設定（デフォルト）
  const currentDistanceThreshold = 0.7;
  const currentQualityThreshold = 0.5;
  
  // 様々な閾値の組み合わせをテスト
  const distanceThresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const qualityThresholds = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  
  const allAnalyses: ThresholdAnalysis[] = [];
  
  console.log('閾値の組み合わせをテスト中...');
  
  for (const distanceThreshold of distanceThresholds) {
    for (const qualityThreshold of qualityThresholds) {
      if (qualityThreshold > distanceThreshold) {
        continue; // 品質閾値は距離閾値以下でなければならない
      }
      
      const results = await executeSearchWithThresholds(
        query, 
        distanceThreshold, 
        qualityThreshold, 
        50
      );
      
      const quality = evaluateSearchQuality(results, expectedPages);
      
      const analysis: ThresholdAnalysis = {
        threshold: distanceThreshold,
        qualityThreshold: qualityThreshold,
        f1Score: quality.f1Score,
        precision: quality.precision,
        recall: quality.recall,
        ndcg: quality.ndcg,
        avgDistance: quality.avgDistance,
        minDistance: quality.minDistance,
        maxDistance: quality.maxDistance,
        resultCount: quality.resultCount,
        relevantCount: quality.relevantCount
      };
      
      allAnalyses.push(analysis);
      
      console.log(`  距離閾値: ${distanceThreshold}, 品質閾値: ${qualityThreshold} -> F1: ${quality.f1Score.toFixed(3)}, 結果数: ${results.length}`);
    }
  }
  
  // 現在の設定での結果
  const currentResults = await executeSearchWithThresholds(
    query, 
    currentDistanceThreshold, 
    currentQualityThreshold, 
    50
  );
  const currentQuality = evaluateSearchQuality(currentResults, expectedPages);
  
  console.log(`\n--- 現在の設定 ---`);
  console.log(`距離閾値: ${currentDistanceThreshold}, 品質閾値: ${currentQualityThreshold}`);
  console.log(`F1スコア: ${currentQuality.f1Score.toFixed(3)}`);
  console.log(`精度: ${currentQuality.precision.toFixed(3)}`);
  console.log(`再現率: ${currentQuality.recall.toFixed(3)}`);
  console.log(`NDCG: ${currentQuality.ndcg.toFixed(3)}`);
  console.log(`結果数: ${currentQuality.resultCount}`);
  
  // 最適な閾値を特定（F1スコアが最高の組み合わせ）
  const bestAnalysis = allAnalyses.reduce((best, current) => {
    return current.f1Score > best.f1Score ? current : best;
  });
  
  console.log(`\n--- 最適な閾値設定 ---`);
  console.log(`距離閾値: ${bestAnalysis.threshold}, 品質閾値: ${bestAnalysis.qualityThreshold}`);
  console.log(`F1スコア: ${bestAnalysis.f1Score.toFixed(3)}`);
  console.log(`精度: ${bestAnalysis.precision.toFixed(3)}`);
  console.log(`再現率: ${bestAnalysis.recall.toFixed(3)}`);
  console.log(`NDCG: ${bestAnalysis.ndcg.toFixed(3)}`);
  console.log(`結果数: ${bestAnalysis.resultCount}`);
  
  // 改善効果の計算
  const improvement = {
    f1Score: bestAnalysis.f1Score - currentQuality.f1Score,
    precision: bestAnalysis.precision - currentQuality.precision,
    recall: bestAnalysis.recall - currentQuality.recall,
    ndcg: bestAnalysis.ndcg - currentQuality.ndcg
  };
  
  console.log(`\n--- 改善効果 ---`);
  console.log(`F1スコア: ${improvement.f1Score >= 0 ? '+' : ''}${improvement.f1Score.toFixed(3)}`);
  console.log(`精度: ${improvement.precision >= 0 ? '+' : ''}${improvement.precision.toFixed(3)}`);
  console.log(`再現率: ${improvement.recall >= 0 ? '+' : ''}${improvement.recall.toFixed(3)}`);
  console.log(`NDCG: ${improvement.ndcg >= 0 ? '+' : ''}${improvement.ndcg.toFixed(3)}`);
  
  return {
    query,
    currentThreshold: currentDistanceThreshold,
    currentQualityThreshold: currentQualityThreshold,
    optimalThreshold: bestAnalysis.threshold,
    optimalQualityThreshold: bestAnalysis.qualityThreshold,
    improvement,
    allAnalyses
  };
}

/**
 * 閾値の影響を詳細分析する
 */
async function analyzeThresholdImpact(query: string, expectedPages: string[]): Promise<void> {
  console.log(`\n=== 閾値の影響分析: "${query}" ===`);
  
  // 距離閾値の影響を分析
  console.log('\n--- 距離閾値の影響 ---');
  const distanceThresholds = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
  const qualityThreshold = 0.5; // 固定
  
  for (const threshold of distanceThresholds) {
    const results = await executeSearchWithThresholds(query, threshold, qualityThreshold, 50);
    const quality = evaluateSearchQuality(results, expectedPages);
    
    console.log(`距離閾値 ${threshold}: F1=${quality.f1Score.toFixed(3)}, 精度=${quality.precision.toFixed(3)}, 再現率=${quality.recall.toFixed(3)}, 結果数=${results.length}`);
  }
  
  // 品質閾値の影響を分析
  console.log('\n--- 品質閾値の影響 ---');
  const distanceThreshold = 0.7; // 固定
  const qualityThresholds = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  
  for (const threshold of qualityThresholds) {
    const results = await executeSearchWithThresholds(query, distanceThreshold, threshold, 50);
    const quality = evaluateSearchQuality(results, expectedPages);
    
    console.log(`品質閾値 ${threshold}: F1=${quality.f1Score.toFixed(3)}, 精度=${quality.precision.toFixed(3)}, 再現率=${quality.recall.toFixed(3)}, 結果数=${results.length}`);
  }
}

/**
 * ステップ2のメイン実行関数
 */
async function executeStep2(): Promise<void> {
  console.log('🔧 ステップ2: 距離閾値の最適化');
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
  
  const allOptimizations: ThresholdOptimizationResult[] = [];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`テストケース: ${testCase.description}`);
    console.log(`クエリ: "${testCase.query}"`);
    console.log(`期待ページ: ${testCase.expectedPages.join(', ')}`);
    
    try {
      // 閾値最適化の分析
      const optimization = await analyzeThresholdOptimization(testCase.query, testCase.expectedPages);
      allOptimizations.push(optimization);
      
      // 閾値の影響分析
      await analyzeThresholdImpact(testCase.query, testCase.expectedPages);
      
    } catch (error) {
      console.error(`テストケース "${testCase.query}" のエラー:`, error);
    }
  }
  
  // 全体の分析結果
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 ステップ2: 距離閾値最適化の結果');
  console.log('='.repeat(80));
  
  const avgCurrentF1 = allOptimizations.reduce((sum, opt) => {
    const currentResults = opt.allAnalyses.find(a => 
      a.threshold === opt.currentThreshold && a.qualityThreshold === opt.currentQualityThreshold
    );
    return sum + (currentResults?.f1Score || 0);
  }, 0) / allOptimizations.length;
  
  const avgOptimalF1 = allOptimizations.reduce((sum, opt) => sum + opt.improvement.f1Score + avgCurrentF1, 0) / allOptimizations.length;
  
  console.log(`\n--- 平均品質比較 ---`);
  console.log(`現在の設定 - 平均F1スコア: ${avgCurrentF1.toFixed(3)}`);
  console.log(`最適化後 - 平均F1スコア: ${avgOptimalF1.toFixed(3)}`);
  console.log(`F1スコア改善: ${(avgOptimalF1 - avgCurrentF1).toFixed(3)} (${((avgOptimalF1 - avgCurrentF1) / avgCurrentF1 * 100).toFixed(1)}%)`);
  
  // 最適な閾値の推奨
  const recommendedThresholds = allOptimizations.map(opt => ({
    distanceThreshold: opt.optimalThreshold,
    qualityThreshold: opt.optimalQualityThreshold
  }));
  
  const avgDistanceThreshold = recommendedThresholds.reduce((sum, t) => sum + t.distanceThreshold, 0) / recommendedThresholds.length;
  const avgQualityThreshold = recommendedThresholds.reduce((sum, t) => sum + t.qualityThreshold, 0) / recommendedThresholds.length;
  
  console.log(`\n--- 推奨閾値設定 ---`);
  console.log(`推奨距離閾値: ${avgDistanceThreshold.toFixed(2)}`);
  console.log(`推奨品質閾値: ${avgQualityThreshold.toFixed(2)}`);
  
  // 改善効果の評価
  console.log(`\n--- 改善効果の評価 ---`);
  if (avgOptimalF1 > avgCurrentF1) {
    const improvement = ((avgOptimalF1 - avgCurrentF1) / avgCurrentF1 * 100);
    console.log(`✅ F1スコアが改善されました: ${improvement.toFixed(1)}%向上`);
  } else {
    console.log(`❌ F1スコアが改善されませんでした`);
  }
  
  // 次のステップの推奨
  console.log(`\n--- 次のステップ ---`);
  if (avgOptimalF1 > avgCurrentF1) {
    console.log('✅ 距離閾値の最適化が効果的です');
    console.log('📋 推奨アクション:');
    console.log(`  1. LanceDBの検索クライアントの閾値を調整`);
    console.log(`     - 距離閾値: ${avgDistanceThreshold.toFixed(2)}`);
    console.log(`     - 品質閾値: ${avgQualityThreshold.toFixed(2)}`);
    console.log('  2. ステップ3（埋め込みモデルの見直し）に進む');
  } else {
    console.log('⚠️ 距離閾値の最適化の効果が限定的です');
    console.log('📋 推奨アクション:');
    console.log('  1. ステップ3（埋め込みモデルの見直し）を優先する');
    console.log('  2. ステップ4（クエリ前処理の改善）を検討する');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ステップ2: 距離閾値の最適化完了');
}

// テスト実行
if (require.main === module) {
  executeStep2();
}

export { executeStep2 };
