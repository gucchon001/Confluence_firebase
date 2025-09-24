#!/usr/bin/env npx tsx

/**
 * データフロー図ベース統合テスト実行スクリプト
 * 
 * docs/data-flow-diagram-lancedb.mdに基づいて
 * システム全体の統合テストを実行
 */

import { IntegrationTestFramework } from './integration-test-framework';
import {
  dataAcquisitionTestSuite,
  hybridSearchTestSuite,
  aiResponseTestSuite,
  componentIntegrationTestSuite,
  endToEndTestSuite
} from './data-flow-test-suites';

/**
 * メイン実行関数
 */
async function runDataFlowIntegrationTests(): Promise<void> {
  console.log('🚀 データフロー図ベース統合テスト実行開始');
  console.log('📋 docs/data-flow-diagram-lancedb.mdに基づくシステム統合テスト');
  console.log('=' .repeat(80));

  const framework = new IntegrationTestFramework();
  
  // 全テストスイートを実行
  const testSuites = [
    dataAcquisitionTestSuite,
    hybridSearchTestSuite,
    aiResponseTestSuite,
    componentIntegrationTestSuite,
    endToEndTestSuite
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  const allResults: any[] = [];

  for (const suite of testSuites) {
    console.log(`\n📊 テストスイート実行: ${suite.name}`);
    console.log(`📝 ${suite.description}`);
    console.log('-' .repeat(60));
    
    const results = await framework.runTestSuite(suite);
    allResults.push(...results);
    
    totalPassed += results.filter(r => r.status === 'PASS').length;
    totalFailed += results.filter(r => r.status === 'FAIL').length;
    totalSkipped += results.filter(r => r.status === 'SKIP').length;
  }

  // 最終サマリー
  console.log('\n🎯 データフロー図ベース統合テスト最終結果');
  console.log('=' .repeat(80));
  console.log(`✅ 成功: ${totalPassed}件`);
  console.log(`❌ 失敗: ${totalFailed}件`);
  console.log(`⏭️  スキップ: ${totalSkipped}件`);
  console.log(`📈 成功率: ${((totalPassed / (totalPassed + totalFailed + totalSkipped)) * 100).toFixed(1)}%`);

  // 失敗したテストの詳細表示
  if (totalFailed > 0) {
    console.log(`\n❌ 失敗したテスト詳細:`);
    allResults
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        console.log(`   - ${r.testName}: ${r.error || 'Unknown error'}`);
        if (r.metrics) {
          console.log(`     メトリクス:`, r.metrics);
        }
      });
  }

  // パフォーマンス統計
  const performanceResults = allResults.filter(r => r.metrics && r.metrics.totalDuration);
  if (performanceResults.length > 0) {
    const totalDuration = performanceResults.reduce((sum, r) => sum + r.metrics.totalDuration, 0);
    const averageDuration = totalDuration / performanceResults.length;
    
    console.log(`\n⚡ パフォーマンス統計:`);
    console.log(`   総実行時間: ${(totalDuration / 1000).toFixed(2)}秒`);
    console.log(`   平均実行時間: ${(averageDuration / 1000).toFixed(2)}秒`);
  }

  // データフロー図の各段階の結果サマリー
  console.log(`\n📊 データフロー図段階別結果:`);
  const stageResults = {
    'データ取得と処理': allResults.filter(r => r.testName.includes('Data Acquisition') || r.testName.includes('Data Integrity')).length,
    'ハイブリッド検索': allResults.filter(r => r.testName.includes('Hybrid Search') || r.testName.includes('Search Accuracy')).length,
    'AI回答生成': allResults.filter(r => r.testName.includes('AI Response') || r.testName.includes('Response Quality')).length,
    'コンポーネント統合': allResults.filter(r => r.testName.includes('Component Integration') || r.testName.includes('System Performance')).length,
    'エンドツーエンド': allResults.filter(r => r.testName.includes('Complete Data Flow')).length
  };

  Object.entries(stageResults).forEach(([stage, count]) => {
    const passed = allResults.filter(r => 
      (r.testName.includes(stage.split('')[0]) || r.testName.includes(stage)) && 
      r.status === 'PASS'
    ).length;
    console.log(`   ${stage}: ${passed}/${count} 成功`);
  });

  if (totalFailed === 0) {
    console.log('\n🎉 すべてのデータフロー図ベース統合テストが成功しました！');
    console.log('✅ システム全体が正常に動作しています。');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalFailed}件のテストが失敗しました。`);
    console.log('🔧 システムの改善が必要です。');
    process.exit(1);
  }
}

// コマンドライン引数の処理
const args = process.argv.slice(2);
const runSpecificSuite = args[0];

async function runSpecificTestSuite(suiteName: string): Promise<void> {
  const suiteMap: { [key: string]: any } = {
    'data': dataAcquisitionTestSuite,
    'search': hybridSearchTestSuite,
    'ai': aiResponseTestSuite,
    'integration': componentIntegrationTestSuite,
    'e2e': endToEndTestSuite
  };

  const targetSuite = suiteMap[suiteName];
  if (targetSuite) {
    console.log(`🎯 特定テストスイート実行: ${targetSuite.name}`);
    const framework = new IntegrationTestFramework();
    await framework.runTestSuite(targetSuite);
  } else {
    console.log('❌ 無効なテストスイート名です。');
    console.log('利用可能なオプション: data, search, ai, integration, e2e');
    process.exit(1);
  }
}

if (runSpecificSuite) {
  // 特定のテストスイートのみ実行
  runSpecificTestSuite(runSpecificSuite).catch(error => {
    console.error('❌ 特定テストスイート実行中にエラーが発生しました:', error);
    process.exit(1);
  });
} else {
  // 全テストスイート実行
  runDataFlowIntegrationTests().catch(error => {
    console.error('❌ データフロー図ベース統合テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}
