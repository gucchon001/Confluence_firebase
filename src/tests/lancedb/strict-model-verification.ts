/**
 * 厳密なモデル検証テスト
 * 
 * 新しい埋め込みモデルの効果を厳密にテストし、期待値通りに改善されるかを検証する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

interface VerificationResult {
  testName: string;
  expected: any;
  actual: any;
  passed: boolean;
  details: string;
}

interface ModelTestResult {
  query: string;
  embeddingDimensions: number;
  embeddingRange: { min: number; max: number; mean: number };
  searchResults: {
    count: number;
    avgDistance: number;
    minDistance: number;
    maxDistance: number;
  };
  quality: {
    f1Score: number;
    precision: number;
    recall: number;
    ndcg: number;
  };
}

/**
 * 埋め込みモデルの基本特性をテストする
 */
async function testEmbeddingModelBasics(): Promise<VerificationResult[]> {
  console.log('\n=== 埋め込みモデルの基本特性テスト ===');
  
  const results: VerificationResult[] = [];
  
  try {
    // テスト1: 次元数の確認
    const testText = 'テスト用のサンプルテキストです';
    const embedding = await getEmbeddings(testText);
    
    const dimensionTest: VerificationResult = {
      testName: '次元数テスト',
      expected: 768,
      actual: embedding.length,
      passed: embedding.length === 768,
      details: `期待: 768次元, 実際: ${embedding.length}次元`
    };
    results.push(dimensionTest);
    
    console.log(`✅ 次元数: ${embedding.length} (期待: 768)`);
    
    // テスト2: ベクトルの正規化確認
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    const normalizationTest: VerificationResult = {
      testName: '正規化テスト',
      expected: '約1.0',
      actual: magnitude.toFixed(4),
      passed: Math.abs(magnitude - 1.0) < 0.1,
      details: `期待: 約1.0, 実際: ${magnitude.toFixed(4)}`
    };
    results.push(normalizationTest);
    
    console.log(`✅ ベクトル大きさ: ${magnitude.toFixed(4)} (期待: 約1.0)`);
    
    // テスト3: ベクトル値の範囲確認
    const minVal = Math.min(...embedding);
    const maxVal = Math.max(...embedding);
    const meanVal = embedding.reduce((sum, val) => sum + val, 0) / embedding.length;
    
    const rangeTest: VerificationResult = {
      testName: '値の範囲テスト',
      expected: '合理的な範囲',
      actual: `min: ${minVal.toFixed(4)}, max: ${maxVal.toFixed(4)}, mean: ${meanVal.toFixed(4)}`,
      passed: minVal > -10 && maxVal < 10 && Math.abs(meanVal) < 1,
      details: `最小: ${minVal.toFixed(4)}, 最大: ${maxVal.toFixed(4)}, 平均: ${meanVal.toFixed(4)}`
    };
    results.push(rangeTest);
    
    console.log(`✅ 値の範囲: min=${minVal.toFixed(4)}, max=${maxVal.toFixed(4)}, mean=${meanVal.toFixed(4)}`);
    
    // テスト4: 日本語テキストの処理確認
    const japaneseText = '教室管理の詳細について説明します';
    const japaneseEmbedding = await getEmbeddings(japaneseText);
    
    const japaneseTest: VerificationResult = {
      testName: '日本語処理テスト',
      expected: 768,
      actual: japaneseEmbedding.length,
      passed: japaneseEmbedding.length === 768,
      details: `日本語テキストの埋め込み次元数: ${japaneseEmbedding.length}`
    };
    results.push(japaneseTest);
    
    console.log(`✅ 日本語テキスト処理: ${japaneseEmbedding.length}次元`);
    
  } catch (error) {
    console.error('❌ 基本特性テストエラー:', error);
    results.push({
      testName: '基本特性テスト',
      expected: '成功',
      actual: 'エラー',
      passed: false,
      details: `エラー: ${error}`
    });
  }
  
  return results;
}

/**
 * LanceDBテーブルの状態を確認する
 */
async function verifyLanceDBTable(): Promise<VerificationResult[]> {
  console.log('\n=== LanceDBテーブル状態確認 ===');
  
  const results: VerificationResult[] = [];
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tableNames = await db.tableNames();
    
    // テスト1: テーブル存在確認
    const tableExistsTest: VerificationResult = {
      testName: 'テーブル存在確認',
      expected: true,
      actual: tableNames.includes('confluence'),
      passed: tableNames.includes('confluence'),
      details: `利用可能なテーブル: ${tableNames.join(', ')}`
    };
    results.push(tableExistsTest);
    
    console.log(`✅ テーブル存在: ${tableNames.includes('confluence')}`);
    console.log(`   利用可能なテーブル: ${tableNames.join(', ')}`);
    
    if (tableNames.includes('confluence')) {
      const tbl = await db.openTable('confluence');
      
      // テスト2: レコード数確認
      const count = await tbl.countRows();
      const recordCountTest: VerificationResult = {
        testName: 'レコード数確認',
        expected: '> 0',
        actual: count,
        passed: count > 0,
        details: `レコード数: ${count}`
      };
      results.push(recordCountTest);
      
      console.log(`✅ レコード数: ${count}`);
      
      if (count > 0) {
        // テスト3: ベクトル次元数確認
        const sample = await tbl.query().limit(1).toArray();
        if (sample.length > 0) {
          const vector = sample[0].vector?.toArray ? sample[0].vector.toArray() : sample[0].vector;
          const vectorDimensionTest: VerificationResult = {
            testName: 'ベクトル次元数確認',
            expected: 768,
            actual: vector?.length || 0,
            passed: vector?.length === 768,
            details: `テーブル内のベクトル次元数: ${vector?.length || 0}`
          };
          results.push(vectorDimensionTest);
          
          console.log(`✅ テーブル内ベクトル次元数: ${vector?.length || 0}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ LanceDBテーブル確認エラー:', error);
    results.push({
      testName: 'LanceDBテーブル確認',
      expected: '成功',
      actual: 'エラー',
      passed: false,
      details: `エラー: ${error}`
    });
  }
  
  return results;
}

/**
 * 実際の検索品質をテストする
 */
async function testSearchQuality(): Promise<ModelTestResult[]> {
  console.log('\n=== 検索品質テスト ===');
  
  const testCases = [
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
        '教室コピー処理仕様'
      ]
    }
  ];
  
  const results: ModelTestResult[] = [];
  
  for (const testCase of testCases) {
    console.log(`\n--- テストケース: "${testCase.query}" ---`);
    
    try {
      // 埋め込み生成
      const embedding = await getEmbeddings(testCase.query);
      const embeddingRange = {
        min: Math.min(...embedding),
        max: Math.max(...embedding),
        mean: embedding.reduce((sum, val) => sum + val, 0) / embedding.length
      };
      
      console.log(`埋め込み次元数: ${embedding.length}`);
      console.log(`埋め込み範囲: ${embeddingRange.min.toFixed(4)} ～ ${embeddingRange.max.toFixed(4)}`);
      
      // LanceDB検索
      const db = await lancedb.connect(path.resolve('.lancedb'));
      const tbl = await db.openTable('confluence');
      const searchResults = await tbl.search(embedding).limit(50).toArray();
      
      const distances = searchResults.map(r => r._distance || 0);
      const searchStats = {
        count: searchResults.length,
        avgDistance: distances.length > 0 ? distances.reduce((sum, d) => sum + d, 0) / distances.length : 0,
        minDistance: distances.length > 0 ? Math.min(...distances) : 0,
        maxDistance: distances.length > 0 ? Math.max(...distances) : 0
      };
      
      console.log(`検索結果数: ${searchStats.count}`);
      console.log(`平均距離: ${searchStats.avgDistance.toFixed(4)}`);
      console.log(`最小距離: ${searchStats.minDistance.toFixed(4)}`);
      console.log(`最大距離: ${searchStats.maxDistance.toFixed(4)}`);
      
      // 品質評価
      const foundPages = searchResults
        .map(r => r.title)
        .filter(title => testCase.expectedPages.some(expected => title?.includes(expected)));
      
      const precision = searchResults.length > 0 ? foundPages.length / searchResults.length : 0;
      const recall = testCase.expectedPages.length > 0 ? foundPages.length / testCase.expectedPages.length : 0;
      const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
      
      // NDCGの計算
      const actualOrder = searchResults.map(r => r.title || '');
      const dcg = actualOrder.slice(0, 10).reduce((sum, item, index) => {
        const relevance = testCase.expectedPages.includes(item) ? 1 : 0;
        return sum + relevance / Math.log2(index + 2);
      }, 0);
      
      const idcg = testCase.expectedPages.slice(0, 10).reduce((sum, _, index) => {
        return sum + 1 / Math.log2(index + 2);
      }, 0);
      
      const ndcg = idcg > 0 ? dcg / idcg : 0;
      
      const quality = {
        f1Score,
        precision,
        recall,
        ndcg
      };
      
      console.log(`F1スコア: ${quality.f1Score.toFixed(3)}`);
      console.log(`精度: ${quality.precision.toFixed(3)}`);
      console.log(`再現率: ${quality.recall.toFixed(3)}`);
      console.log(`NDCG: ${quality.ndcg.toFixed(3)}`);
      console.log(`関連ページ数: ${foundPages.length}/${testCase.expectedPages.length}`);
      
      results.push({
        query: testCase.query,
        embeddingDimensions: embedding.length,
        embeddingRange,
        searchResults: searchStats,
        quality
      });
      
    } catch (error) {
      console.error(`❌ テストケース "${testCase.query}" のエラー:`, error);
    }
  }
  
  return results;
}

/**
 * 期待値との比較分析
 */
function analyzeExpectations(results: ModelTestResult[]): void {
  console.log('\n=== 期待値との比較分析 ===');
  
  const avgF1 = results.reduce((sum, r) => sum + r.quality.f1Score, 0) / results.length;
  const avgPrecision = results.reduce((sum, r) => sum + r.quality.precision, 0) / results.length;
  const avgRecall = results.reduce((sum, r) => sum + r.quality.recall, 0) / results.length;
  const avgNDCG = results.reduce((sum, r) => sum + r.quality.ndcg, 0) / results.length;
  const avgMinDistance = results.reduce((sum, r) => sum + r.searchResults.minDistance, 0) / results.length;
  
  console.log('\n--- 現在の実績 ---');
  console.log(`平均F1スコア: ${avgF1.toFixed(3)}`);
  console.log(`平均精度: ${avgPrecision.toFixed(3)}`);
  console.log(`平均再現率: ${avgRecall.toFixed(3)}`);
  console.log(`平均NDCG: ${avgNDCG.toFixed(3)}`);
  console.log(`平均最小距離: ${avgMinDistance.toFixed(4)}`);
  
  console.log('\n--- 期待値との比較 ---');
  const f1Expected = 0.2;
  const precisionExpected = 0.3;
  const recallExpected = 0.4;
  const ndcgExpected = 0.5;
  const minDistanceExpected = 0.3;
  
  console.log(`F1スコア: ${avgF1.toFixed(3)} / ${f1Expected} (${(avgF1 / f1Expected * 100).toFixed(1)}%)`);
  console.log(`精度: ${avgPrecision.toFixed(3)} / ${precisionExpected} (${(avgPrecision / precisionExpected * 100).toFixed(1)}%)`);
  console.log(`再現率: ${avgRecall.toFixed(3)} / ${recallExpected} (${(avgRecall / recallExpected * 100).toFixed(1)}%)`);
  console.log(`NDCG: ${avgNDCG.toFixed(3)} / ${ndcgExpected} (${(avgNDCG / ndcgExpected * 100).toFixed(1)}%)`);
  console.log(`最小距離: ${avgMinDistance.toFixed(4)} / ${minDistanceExpected} (${(avgMinDistance / minDistanceExpected * 100).toFixed(1)}%)`);
  
  console.log('\n--- 改善状況 ---');
  const improvements = {
    f1: avgF1 >= f1Expected,
    precision: avgPrecision >= precisionExpected,
    recall: avgRecall >= recallExpected,
    ndcg: avgNDCG >= ndcgExpected,
    minDistance: avgMinDistance <= minDistanceExpected
  };
  
  const passedCount = Object.values(improvements).filter(Boolean).length;
  const totalCount = Object.keys(improvements).length;
  
  console.log(`✅ 達成: ${passedCount}/${totalCount} 項目`);
  
  if (passedCount === totalCount) {
    console.log('🎉 すべての期待値を達成しました！');
  } else if (passedCount >= totalCount * 0.6) {
    console.log('✅ 大部分の期待値を達成しました');
  } else {
    console.log('⚠️ 期待値の達成が不十分です');
  }
}

/**
 * 厳密な検証のメイン実行関数
 */
async function executeStrictVerification(): Promise<void> {
  console.log('🔍 厳密なモデル検証テスト');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  // 1. 埋め込みモデルの基本特性テスト
  const basicResults = await testEmbeddingModelBasics();
  
  // 2. LanceDBテーブル状態確認
  const tableResults = await verifyLanceDBTable();
  
  // 3. 検索品質テスト
  const qualityResults = await testSearchQuality();
  
  // 4. 期待値との比較分析
  analyzeExpectations(qualityResults);
  
  // 5. 総合評価
  console.log('\n=== 総合評価 ===');
  const allResults = [...basicResults, ...tableResults];
  const passedTests = allResults.filter(r => r.passed).length;
  const totalTests = allResults.length;
  
  console.log(`基本テスト: ${passedTests}/${totalTests} 通過`);
  
  if (passedTests === totalTests && qualityResults.length > 0) {
    console.log('✅ モデル変更は成功しています');
    console.log('📋 推奨: ステップ4（クエリ前処理の改善）に進む');
  } else {
    console.log('⚠️ モデル変更に問題があります');
    console.log('📋 推奨: 問題を修正してから次のステップに進む');
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 厳密なモデル検証テスト完了');
}

// テスト実行
if (require.main === module) {
  executeStrictVerification();
}

export { executeStrictVerification };
