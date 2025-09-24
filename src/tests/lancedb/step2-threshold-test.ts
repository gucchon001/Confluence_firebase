/**
 * ステップ2: 距離閾値の最適化テスト
 * 
 * 修正されたLanceDB検索クライアントで距離閾値の最適化をテストする
 */

import 'dotenv/config';
import { searchLanceDB } from '../../lib/lancedb-search-client';

interface ThresholdTestResult {
  distanceThreshold: number;
  qualityThreshold: number;
  f1Score: number;
  precision: number;
  recall: number;
  resultCount: number;
  relevantCount: number;
}

/**
 * 指定された閾値で検索をテストする
 */
async function testThresholds(
  query: string,
  expectedPages: string[],
  distanceThreshold: number,
  qualityThreshold: number
): Promise<ThresholdTestResult> {
  try {
    const results = await searchLanceDB({
      query: query,
      topK: 50,
      maxDistance: distanceThreshold,
      qualityThreshold: qualityThreshold,
      useLunrIndex: false, // ベクトル検索のみをテスト
      labelFilters: { includeFolders: false }
    });
    
    const foundPages = results
      .map(r => r.title)
      .filter(title => expectedPages.some(expected => title?.includes(expected)));
    
    const precision = results.length > 0 ? foundPages.length / results.length : 0;
    const recall = expectedPages.length > 0 ? foundPages.length / expectedPages.length : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    return {
      distanceThreshold,
      qualityThreshold,
      f1Score,
      precision,
      recall,
      resultCount: results.length,
      relevantCount: foundPages.length
    };
  } catch (error) {
    console.error('閾値テストエラー:', error);
    return {
      distanceThreshold,
      qualityThreshold,
      f1Score: 0,
      precision: 0,
      recall: 0,
      resultCount: 0,
      relevantCount: 0
    };
  }
}

/**
 * ステップ2のテストを実行する
 */
async function executeStep2Test(): Promise<void> {
  console.log('🔧 ステップ2: 距離閾値の最適化テスト');
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
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`テストケース: ${testCase.description}`);
    console.log(`クエリ: "${testCase.query}"`);
    console.log(`期待ページ: ${testCase.expectedPages.join(', ')}`);
    
    // 現在の設定（デフォルト）
    console.log('\n--- 現在の設定（デフォルト） ---');
    const currentResult = await testThresholds(testCase.query, testCase.expectedPages, 0.7, 0.5);
    console.log(`距離閾値: ${currentResult.distanceThreshold}, 品質閾値: ${currentResult.qualityThreshold}`);
    console.log(`F1スコア: ${currentResult.f1Score.toFixed(3)}`);
    console.log(`精度: ${currentResult.precision.toFixed(3)}`);
    console.log(`再現率: ${currentResult.recall.toFixed(3)}`);
    console.log(`結果数: ${currentResult.resultCount}, 関連数: ${currentResult.relevantCount}`);
    
    // 最適化された設定
    console.log('\n--- 最適化された設定 ---');
    const optimizedResult = await testThresholds(testCase.query, testCase.expectedPages, 0.5, 0.3);
    console.log(`距離閾値: ${optimizedResult.distanceThreshold}, 品質閾値: ${optimizedResult.qualityThreshold}`);
    console.log(`F1スコア: ${optimizedResult.f1Score.toFixed(3)}`);
    console.log(`精度: ${optimizedResult.precision.toFixed(3)}`);
    console.log(`再現率: ${optimizedResult.recall.toFixed(3)}`);
    console.log(`結果数: ${optimizedResult.resultCount}, 関連数: ${optimizedResult.relevantCount}`);
    
    // 改善効果
    const f1Improvement = optimizedResult.f1Score - currentResult.f1Score;
    const precisionImprovement = optimizedResult.precision - currentResult.precision;
    const recallImprovement = optimizedResult.recall - currentResult.recall;
    
    console.log('\n--- 改善効果 ---');
    console.log(`F1スコア: ${f1Improvement >= 0 ? '+' : ''}${f1Improvement.toFixed(3)}`);
    console.log(`精度: ${precisionImprovement >= 0 ? '+' : ''}${precisionImprovement.toFixed(3)}`);
    console.log(`再現率: ${recallImprovement >= 0 ? '+' : ''}${recallImprovement.toFixed(3)}`);
    
    if (f1Improvement > 0) {
      const improvementPercent = (f1Improvement / currentResult.f1Score * 100).toFixed(1);
      console.log(`✅ F1スコアが${improvementPercent}%改善されました`);
    } else {
      console.log(`❌ F1スコアが改善されませんでした`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ステップ2: 距離閾値の最適化テスト完了');
}

// テスト実行
if (require.main === module) {
  executeStep2Test();
}

export { executeStep2Test };
