/**
 * ベクトル検索品質低下問題の厳密な調査スクリプト
 * 
 * このスクリプトは以下の項目を詳細に調査します：
 * 1. ベクトル検索 vs BM25検索の品質比較
 * 2. 距離閾値による品質の変化
 * 3. ベクトル次元の影響
 * 4. 埋め込みモデルの品質評価
 * 5. 検索結果の詳細分析
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';
import { searchLanceDB } from '../../lib/lancedb-search-client';

interface SearchQualityResult {
  query: string;
  vectorSearch: {
    results: any[];
    avgDistance: number;
    relevantCount: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  bm25Search: {
    results: any[];
    relevantCount: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  hybridSearch: {
    results: any[];
    relevantCount: number;
    precision: number;
    recall: number;
    f1Score: number;
  };
  qualityComparison: {
    vectorVsBm25: number; // ベクトル検索の相対品質
    vectorVsHybrid: number; // ベクトル検索の相対品質
    bm25VsHybrid: number; // BM25検索の相対品質
  };
}

interface DistanceThresholdAnalysis {
  threshold: number;
  results: any[];
  relevantCount: number;
  precision: number;
  recall: number;
  f1Score: number;
  avgDistance: number;
}

interface VectorQualityMetrics {
  query: string;
  vectorDimensions: number;
  embeddingQuality: {
    magnitude: number;
    distribution: {
      min: number;
      max: number;
      mean: number;
      std: number;
    };
  };
  distanceDistribution: {
    min: number;
    max: number;
    mean: number;
    std: number;
    percentiles: {
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
    };
  };
  relevanceScores: {
    top5: number[];
    top10: number[];
    top20: number[];
  };
}

/**
 * ベクトル検索のみを実行する
 */
async function executeVectorOnlySearch(query: string, topK: number = 20): Promise<any[]> {
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
 * BM25検索のみを実行する
 */
async function executeBm25OnlySearch(query: string, topK: number = 20): Promise<any[]> {
  try {
    // Lunrインデックスを使用したBM25検索をシミュレート
    const results = await searchLanceDB({
      query,
      topK,
      useLunrIndex: true,
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });
    
    return results.map(result => ({
      id: result.id,
      title: result.title,
      content: result.content,
      distance: 0, // BM25では距離は0
      labels: result.labels || [],
      source: 'bm25',
      score: result.score
    }));
  } catch (error) {
    console.error('BM25検索エラー:', error);
    return [];
  }
}

/**
 * ハイブリッド検索を実行する
 */
async function executeHybridSearch(query: string, topK: number = 20): Promise<any[]> {
  try {
    const results = await searchLanceDB({
      query,
      topK,
      useLunrIndex: false, // ハイブリッド検索
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });
    
    return results.map(result => ({
      id: result.id,
      title: result.title,
      content: result.content,
      distance: result.distance || 0,
      labels: result.labels || [],
      source: 'hybrid',
      score: result.score
    }));
  } catch (error) {
    console.error('ハイブリッド検索エラー:', error);
    return [];
  }
}

/**
 * 検索結果の関連性を評価する
 */
function evaluateRelevance(results: any[], expectedKeywords: string[]): {
  relevantCount: number;
  precision: number;
  recall: number;
  f1Score: number;
} {
  const relevantResults = results.filter(result => {
    const title = result.title?.toLowerCase() || '';
    const content = result.content?.toLowerCase() || '';
    const text = `${title} ${content}`;
    
    return expectedKeywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
  });
  
  const relevantCount = relevantResults.length;
  const precision = results.length > 0 ? relevantCount / results.length : 0;
  const recall = expectedKeywords.length > 0 ? relevantCount / expectedKeywords.length : 0;
  const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  return { relevantCount, precision, recall, f1Score };
}

/**
 * ベクトル検索の品質を詳細に分析する
 */
async function analyzeVectorSearchQuality(query: string, expectedKeywords: string[]): Promise<SearchQualityResult> {
  console.log(`\n=== ベクトル検索品質分析: "${query}" ===`);
  
  // 各検索手法を実行
  const vectorResults = await executeVectorOnlySearch(query, 20);
  const bm25Results = await executeBm25OnlySearch(query, 20);
  const hybridResults = await executeHybridSearch(query, 20);
  
  console.log(`ベクトル検索結果: ${vectorResults.length}件`);
  console.log(`BM25検索結果: ${bm25Results.length}件`);
  console.log(`ハイブリッド検索結果: ${hybridResults.length}件`);
  
  // 関連性を評価
  const vectorRelevance = evaluateRelevance(vectorResults, expectedKeywords);
  const bm25Relevance = evaluateRelevance(bm25Results, expectedKeywords);
  const hybridRelevance = evaluateRelevance(hybridResults, expectedKeywords);
  
  // ベクトル検索の距離統計
  const distances = vectorResults.map(r => r.distance);
  const avgDistance = distances.length > 0 ? distances.reduce((sum, d) => sum + d, 0) / distances.length : 0;
  
  console.log(`\n--- 関連性評価 ---`);
  console.log(`ベクトル検索: 精度=${vectorRelevance.precision.toFixed(3)}, 再現率=${vectorRelevance.recall.toFixed(3)}, F1=${vectorRelevance.f1Score.toFixed(3)}`);
  console.log(`BM25検索: 精度=${bm25Relevance.precision.toFixed(3)}, 再現率=${bm25Relevance.recall.toFixed(3)}, F1=${bm25Relevance.f1Score.toFixed(3)}`);
  console.log(`ハイブリッド検索: 精度=${hybridRelevance.precision.toFixed(3)}, 再現率=${hybridRelevance.recall.toFixed(3)}, F1=${hybridRelevance.f1Score.toFixed(3)}`);
  
  // 品質比較
  const vectorVsBm25 = vectorRelevance.f1Score / (bm25Relevance.f1Score || 0.001);
  const vectorVsHybrid = vectorRelevance.f1Score / (hybridRelevance.f1Score || 0.001);
  const bm25VsHybrid = bm25Relevance.f1Score / (hybridRelevance.f1Score || 0.001);
  
  console.log(`\n--- 品質比較 ---`);
  console.log(`ベクトル vs BM25: ${vectorVsBm25.toFixed(3)} (${vectorVsBm25 > 1 ? 'ベクトル優位' : 'BM25優位'})`);
  console.log(`ベクトル vs ハイブリッド: ${vectorVsHybrid.toFixed(3)} (${vectorVsHybrid > 1 ? 'ベクトル優位' : 'ハイブリッド優位'})`);
  console.log(`BM25 vs ハイブリッド: ${bm25VsHybrid.toFixed(3)} (${bm25VsHybrid > 1 ? 'BM25優位' : 'ハイブリッド優位'})`);
  
  return {
    query,
    vectorSearch: {
      results: vectorResults,
      avgDistance,
      ...vectorRelevance
    },
    bm25Search: {
      results: bm25Results,
      ...bm25Relevance
    },
    hybridSearch: {
      results: hybridResults,
      ...hybridRelevance
    },
    qualityComparison: {
      vectorVsBm25,
      vectorVsHybrid,
      bm25VsHybrid
    }
  };
}

/**
 * 距離閾値による品質の変化を分析する
 */
async function analyzeDistanceThresholds(query: string, expectedKeywords: string[]): Promise<DistanceThresholdAnalysis[]> {
  console.log(`\n=== 距離閾値分析: "${query}" ===`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const vector = await getEmbeddings(query);
    const allResults = await tbl.search(vector).limit(100).toArray();
    
    const thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const analyses: DistanceThresholdAnalysis[] = [];
    
    for (const threshold of thresholds) {
      const filteredResults = allResults.filter(r => (r._distance || 0) <= threshold);
      
      const formattedResults = filteredResults.map(result => ({
        id: result.id,
        title: result.title,
        content: result.content,
        distance: result._distance || 0,
        labels: result.labels?.toArray ? result.labels.toArray() : result.labels || []
      }));
      
      const relevance = evaluateRelevance(formattedResults, expectedKeywords);
      const distances = formattedResults.map(r => r.distance);
      const avgDistance = distances.length > 0 ? distances.reduce((sum, d) => sum + d, 0) / distances.length : 0;
      
      analyses.push({
        threshold,
        results: formattedResults,
        ...relevance,
        avgDistance
      });
      
      console.log(`閾値 ${threshold.toFixed(1)}: ${formattedResults.length}件, 精度=${relevance.precision.toFixed(3)}, 再現率=${relevance.recall.toFixed(3)}, F1=${relevance.f1Score.toFixed(3)}`);
    }
    
    // 最適な閾値を特定
    const bestThreshold = analyses.reduce((best, current) => 
      current.f1Score > best.f1Score ? current : best
    );
    
    console.log(`\n最適な距離閾値: ${bestThreshold.threshold.toFixed(1)} (F1=${bestThreshold.f1Score.toFixed(3)})`);
    
    return analyses;
    
  } catch (error) {
    console.error('距離閾値分析エラー:', error);
    return [];
  }
}

/**
 * ベクトルの品質メトリクスを分析する
 */
async function analyzeVectorQualityMetrics(query: string): Promise<VectorQualityMetrics> {
  console.log(`\n=== ベクトル品質メトリクス分析: "${query}" ===`);
  
  try {
    // 埋め込みベクトルを生成
    const vector = await getEmbeddings(query);
    
    // ベクトルの統計を計算
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    const min = Math.min(...vector);
    const max = Math.max(...vector);
    const mean = vector.reduce((sum, val) => sum + val, 0) / vector.length;
    const variance = vector.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / vector.length;
    const std = Math.sqrt(variance);
    
    console.log(`ベクトル次元数: ${vector.length}`);
    console.log(`ベクトル大きさ: ${magnitude.toFixed(4)}`);
    console.log(`値の範囲: ${min.toFixed(4)} - ${max.toFixed(4)}`);
    console.log(`平均値: ${mean.toFixed(4)}`);
    console.log(`標準偏差: ${std.toFixed(4)}`);
    
    // LanceDBで検索して距離分布を分析
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    const results = await tbl.search(vector).limit(50).toArray();
    
    const distances = results.map(r => r._distance || 0);
    const sortedDistances = [...distances].sort((a, b) => a - b);
    
    const distanceMin = sortedDistances[0];
    const distanceMax = sortedDistances[sortedDistances.length - 1];
    const distanceMean = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const distanceVariance = distances.reduce((sum, d) => sum + Math.pow(d - distanceMean, 2), 0) / distances.length;
    const distanceStd = Math.sqrt(distanceVariance);
    
    // パーセンタイルを計算
    const percentiles = {
      p25: sortedDistances[Math.floor(sortedDistances.length * 0.25)],
      p50: sortedDistances[Math.floor(sortedDistances.length * 0.50)],
      p75: sortedDistances[Math.floor(sortedDistances.length * 0.75)],
      p90: sortedDistances[Math.floor(sortedDistances.length * 0.90)],
      p95: sortedDistances[Math.floor(sortedDistances.length * 0.95)]
    };
    
    console.log(`\n距離分布:`);
    console.log(`最小: ${distanceMin.toFixed(4)}`);
    console.log(`最大: ${distanceMax.toFixed(4)}`);
    console.log(`平均: ${distanceMean.toFixed(4)}`);
    console.log(`標準偏差: ${distanceStd.toFixed(4)}`);
    console.log(`25%: ${percentiles.p25.toFixed(4)}`);
    console.log(`50%: ${percentiles.p50.toFixed(4)}`);
    console.log(`75%: ${percentiles.p75.toFixed(4)}`);
    console.log(`90%: ${percentiles.p90.toFixed(4)}`);
    console.log(`95%: ${percentiles.p95.toFixed(4)}`);
    
    return {
      query,
      vectorDimensions: vector.length,
      embeddingQuality: {
        magnitude,
        distribution: { min, max, mean, std }
      },
      distanceDistribution: {
        min: distanceMin,
        max: distanceMax,
        mean: distanceMean,
        std: distanceStd,
        percentiles
      },
      relevanceScores: {
        top5: distances.slice(0, 5),
        top10: distances.slice(0, 10),
        top20: distances.slice(0, 20)
      }
    };
    
  } catch (error) {
    console.error('ベクトル品質メトリクス分析エラー:', error);
    throw error;
  }
}

/**
 * 検索結果の詳細分析
 */
function analyzeSearchResults(results: any[], searchType: string): void {
  console.log(`\n--- ${searchType}検索結果の詳細分析 ---`);
  
  if (results.length === 0) {
    console.log('検索結果がありません');
    return;
  }
  
  // 上位10件の結果を表示
  console.log('上位10件の結果:');
  results.slice(0, 10).forEach((result, index) => {
    console.log(`${index + 1}. ${result.title}`);
    console.log(`   ID: ${result.id}`);
    console.log(`   距離: ${result.distance?.toFixed(4) || 'N/A'}`);
    console.log(`   スコア: ${result.score?.toFixed(2) || 'N/A'}`);
    console.log(`   ラベル: ${result.labels?.join(', ') || 'なし'}`);
    console.log('');
  });
  
  // 距離の統計（ベクトル検索の場合）
  if (searchType === 'ベクトル' && results.some(r => r.distance !== undefined)) {
    const distances = results.map(r => r.distance || 0);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    
    console.log(`距離統計:`);
    console.log(`平均: ${avgDistance.toFixed(4)}`);
    console.log(`最小: ${minDistance.toFixed(4)}`);
    console.log(`最大: ${maxDistance.toFixed(4)}`);
  }
  
  // スコアの統計（BM25/ハイブリッド検索の場合）
  if (results.some(r => r.score !== undefined)) {
    const scores = results.map(r => r.score || 0);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    
    console.log(`スコア統計:`);
    console.log(`平均: ${avgScore.toFixed(2)}`);
    console.log(`最小: ${minScore.toFixed(2)}`);
    console.log(`最大: ${maxScore.toFixed(2)}`);
  }
}

/**
 * メイン調査関数
 */
async function investigateVectorQualityIssues(): Promise<void> {
  console.log('🔍 ベクトル検索品質低下問題の厳密な調査開始');
  console.log('='.repeat(80));
  console.log(`調査開始時刻: ${new Date().toISOString()}`);
  
  const testCases = [
    {
      query: '教室管理の詳細は',
      expectedKeywords: ['教室管理', '教室一覧', '教室登録', '教室編集', '教室削除'],
      description: '教室管理機能の詳細仕様'
    },
    {
      query: '教室コピー機能でコピー可能な項目は？',
      expectedKeywords: ['教室コピー', 'コピー機能', 'コピー可能', '基本情報', '求人情報'],
      description: '教室コピー機能のコピー可能項目'
    },
    {
      query: 'オファー機能の種類と使い方は？',
      expectedKeywords: ['オファー機能', 'スカウトオファー', 'マッチオファー', 'オファー通知'],
      description: 'オファー機能の種類と使用方法'
    }
  ];
  
  const allResults: SearchQualityResult[] = [];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`テストケース: ${testCase.description}`);
    console.log(`クエリ: "${testCase.query}"`);
    console.log(`期待キーワード: ${testCase.expectedKeywords.join(', ')}`);
    
    try {
      // 1. ベクトル検索の品質分析
      const qualityResult = await analyzeVectorSearchQuality(testCase.query, testCase.expectedKeywords);
      allResults.push(qualityResult);
      
      // 2. 距離閾値分析
      await analyzeDistanceThresholds(testCase.query, testCase.expectedKeywords);
      
      // 3. ベクトル品質メトリクス分析
      await analyzeVectorQualityMetrics(testCase.query);
      
      // 4. 検索結果の詳細分析
      analyzeSearchResults(qualityResult.vectorSearch.results, 'ベクトル');
      analyzeSearchResults(qualityResult.bm25Search.results, 'BM25');
      analyzeSearchResults(qualityResult.hybridSearch.results, 'ハイブリッド');
      
    } catch (error) {
      console.error(`テストケース "${testCase.query}" のエラー:`, error);
    }
  }
  
  // 全体の分析結果
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 全体分析結果');
  console.log('='.repeat(80));
  
  const avgVectorVsBm25 = allResults.reduce((sum, r) => sum + r.qualityComparison.vectorVsBm25, 0) / allResults.length;
  const avgVectorVsHybrid = allResults.reduce((sum, r) => sum + r.qualityComparison.vectorVsHybrid, 0) / allResults.length;
  const avgBm25VsHybrid = allResults.reduce((sum, r) => sum + r.qualityComparison.bm25VsHybrid, 0) / allResults.length;
  
  console.log(`\n--- 品質比較サマリー ---`);
  console.log(`ベクトル vs BM25 (平均): ${avgVectorVsBm25.toFixed(3)}`);
  console.log(`ベクトル vs ハイブリッド (平均): ${avgVectorVsHybrid.toFixed(3)}`);
  console.log(`BM25 vs ハイブリッド (平均): ${avgBm25VsHybrid.toFixed(3)}`);
  
  // 問題の特定
  console.log(`\n--- 問題の特定 ---`);
  if (avgVectorVsBm25 < 0.8) {
    console.log('❌ ベクトル検索の品質がBM25検索より大幅に低い');
    console.log(`   相対品質: ${avgVectorVsBm25.toFixed(3)} (目標: 0.8以上)`);
  } else if (avgVectorVsBm25 < 1.0) {
    console.log('⚠️ ベクトル検索の品質がBM25検索より低い');
    console.log(`   相対品質: ${avgVectorVsBm25.toFixed(3)} (目標: 1.0以上)`);
  } else {
    console.log('✅ ベクトル検索の品質はBM25検索と同等以上');
  }
  
  if (avgVectorVsHybrid < 0.8) {
    console.log('❌ ベクトル検索の品質がハイブリッド検索より大幅に低い');
    console.log(`   相対品質: ${avgVectorVsHybrid.toFixed(3)} (目標: 0.8以上)`);
  } else if (avgVectorVsHybrid < 1.0) {
    console.log('⚠️ ベクトル検索の品質がハイブリッド検索より低い');
    console.log(`   相対品質: ${avgVectorVsHybrid.toFixed(3)} (目標: 1.0以上)`);
  } else {
    console.log('✅ ベクトル検索の品質はハイブリッド検索と同等以上');
  }
  
  // 推奨改善策
  console.log(`\n--- 推奨改善策 ---`);
  if (avgVectorVsBm25 < 0.8) {
    console.log('1. 埋め込みモデルの見直し');
    console.log('2. ベクトル次元数の最適化');
    console.log('3. 距離計算方法の改善');
    console.log('4. フィルタリング条件の調整');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ベクトル検索品質低下問題の調査完了');
}

// テスト実行
if (require.main === module) {
  investigateVectorQualityIssues();
}

export { investigateVectorQualityIssues };
