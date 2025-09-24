/**
 * 統合テストランナー
 * 
 * データフロー図に基づいてシステム全体の統合テストを実行
 * - データ同期フロー
 * - ハイブリッド検索フロー  
 * - AI回答生成フロー
 * - エンドツーエンドテスト
 */

import { IntegrationTestFramework, IntegrationTestSuite } from './integration-test-framework';

/**
 * データ同期フローのテストスイート
 */
const dataSyncTestSuite: IntegrationTestSuite = {
  name: 'データ同期フロー',
  description: 'Confluence APIからLanceDBへのデータ同期プロセスのテスト',
  tests: [
    {
      name: 'LanceDB接続テスト',
      description: 'LanceDBへの接続とテーブル存在確認',
      testFunction: IntegrationTestFramework.testDataSyncFlow,
      timeout: 30000
    },
    {
      name: 'データ整合性テスト',
      description: '同期されたデータの整合性と品質チェック',
      testFunction: async () => {
        const startTime = Date.now();
        
        try {
          const { LanceDBClient } = await import('../lib/lancedb-client');
          const lancedbClient = LanceDBClient.getInstance();
          await lancedbClient.connect();
          
          const table = await lancedbClient.getTable();
          const count = await table.countRows();
          
          // データ件数の妥当性チェック
          if (count < 100) {
            throw new Error(`データ件数が少なすぎます: ${count}件`);
          }
          
          // サンプルデータの品質チェック
          const dummyVector = new Array(768).fill(0);
          const sampleData = await table.search(dummyVector).limit(5).toArray();
          const hasValidData = sampleData.every(row => 
            row.title && 
            row.content && 
            row.spaceKey &&
            row.labels
          );
          
          if (!hasValidData) {
            throw new Error('サンプルデータに不正な形式が含まれています');
          }
          
          return {
            testName: 'Data Integrity Test',
            status: 'PASS',
            duration: Date.now() - startTime,
            details: 'Data integrity check completed successfully',
            metrics: {
              totalRows: count,
              sampleDataValid: hasValidData,
              sampleSize: sampleData.length
            }
          };

        } catch (error) {
          return {
            testName: 'Data Integrity Test',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'Data integrity check failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      timeout: 30000
    }
  ]
};

/**
 * ハイブリッド検索フローのテストスイート
 */
const hybridSearchTestSuite: IntegrationTestSuite = {
  name: 'ハイブリッド検索フロー',
  description: 'ベクトル検索、BM25検索、キーワード検索の統合テスト',
  tests: [
    {
      name: 'ハイブリッド検索基本テスト',
      description: 'ハイブリッド検索エンジンの基本動作確認',
      testFunction: IntegrationTestFramework.testHybridSearchFlow,
      timeout: 30000
    },
    {
      name: '検索結果品質テスト',
      description: '検索結果の関連性とスコア分布の確認',
      testFunction: async () => {
        const startTime = Date.now();
        
        try {
          const { HybridSearchEngine } = await import('../lib/hybrid-search-engine');
          const hybridSearchEngine = new HybridSearchEngine();
          
          const testQueries = [
            '教室管理の詳細は',
            '求人情報の登録方法',
            'ユーザー認証の仕組み',
            'データベースの設計',
            'APIの実装方法'
          ];
          
          const results = [];
          
          for (const query of testQueries) {
            const searchResults = await hybridSearchEngine.search(query);
            
            // 検索結果の品質チェック
            const hasResults = searchResults && searchResults.length > 0;
            const hasHighScoreResults = searchResults?.some(r => (r.score || 0) > 0.3);
            const hasRelevantResults = searchResults?.some(r => 
              r.title.toLowerCase().includes(query.split(' ')[0]) ||
              r.content?.toLowerCase().includes(query.split(' ')[0])
            );
            
            results.push({
              query,
              resultCount: searchResults?.length || 0,
              hasResults,
              hasHighScoreResults,
              hasRelevantResults,
              topScore: Math.max(...(searchResults?.map(r => r.score || 0) || [0]))
            });
          }
          
          const successRate = results.filter(r => r.hasResults).length / results.length;
          const highScoreRate = results.filter(r => r.hasHighScoreResults).length / results.length;
          const relevantRate = results.filter(r => r.hasRelevantResults).length / results.length;
          
          if (successRate < 0.8) {
            throw new Error(`検索成功率が低すぎます: ${(successRate * 100).toFixed(1)}%`);
          }
          
          return {
            testName: 'Search Quality Test',
            status: 'PASS',
            duration: Date.now() - startTime,
            details: 'Search quality check completed successfully',
            metrics: {
              testQueries: testQueries.length,
              successRate: successRate,
              highScoreRate: highScoreRate,
              relevantRate: relevantRate,
              results: results
            }
          };

        } catch (error) {
          return {
            testName: 'Search Quality Test',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'Search quality check failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      timeout: 60000
    }
  ]
};

/**
 * AI回答生成フローのテストスイート
 */
const aiResponseTestSuite: IntegrationTestSuite = {
  name: 'AI回答生成フロー',
  description: 'LLMを使用した回答生成プロセスのテスト',
  tests: [
    {
      name: 'AI回答生成基本テスト',
      description: 'AI回答生成の基本動作確認',
      testFunction: IntegrationTestFramework.testAIResponseFlow,
      timeout: 60000
    },
    {
      name: '回答品質テスト',
      description: '生成された回答の品質と関連性の確認',
      testFunction: async () => {
        const startTime = Date.now();
        
        try {
          const { summarizeConfluenceDocs } = await import('../ai/flows/summarize-confluence-docs');
          
          const testQueries = [
            '教室管理の詳細は',
            '求人登録の手順',
            'ユーザー管理の機能',
            'データ同期の仕組み',
            '検索機能の実装'
          ];
          
          const results = [];
          
          for (const query of testQueries) {
            const aiResponse = await summarizeConfluenceDocs(query);
            
            if (!aiResponse || !aiResponse.message) {
              throw new Error(`AI回答が生成されませんでした: ${query}`);
            }
            
            const responseText = aiResponse.message;
            const responseLength = responseText.length;
            const hasMinimumLength = responseLength > 100;
            const hasRelevantContent = responseText.toLowerCase().includes(query.split(' ')[0]);
            
            results.push({
              query,
              responseLength,
              hasMinimumLength,
              hasRelevantContent,
              finishReason: aiResponse.finishReason
            });
          }
          
          const successRate = results.filter(r => r.hasMinimumLength).length / results.length;
          const relevantRate = results.filter(r => r.hasRelevantContent).length / results.length;
          
          if (successRate < 0.8) {
            throw new Error(`回答品質が低すぎます: 成功率 ${(successRate * 100).toFixed(1)}%`);
          }
          
          return {
            testName: 'AI Response Quality Test',
            status: 'PASS',
            duration: Date.now() - startTime,
            details: 'AI response quality check completed successfully',
            metrics: {
              testQueries: testQueries.length,
              successRate: successRate,
              relevantRate: relevantRate,
              averageLength: results.reduce((sum, r) => sum + r.responseLength, 0) / results.length,
              results: results
            }
          };

        } catch (error) {
          return {
            testName: 'AI Response Quality Test',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'AI response quality check failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      timeout: 120000
    }
  ]
};

/**
 * エンドツーエンドテストスイート
 */
const endToEndTestSuite: IntegrationTestSuite = {
  name: 'エンドツーエンドテスト',
  description: 'システム全体の統合動作テスト',
  tests: [
    {
      name: '完全フローテスト',
      description: 'データ同期からAI回答生成までの完全フロー',
      testFunction: IntegrationTestFramework.testEndToEndFlow,
      timeout: 120000
    },
    {
      name: 'パフォーマンステスト',
      description: 'システム全体のパフォーマンス測定',
      testFunction: IntegrationTestFramework.testPerformanceFlow,
      timeout: 180000
    }
  ]
};

/**
 * メイン実行関数
 */
async function runIntegrationTests(): Promise<void> {
  console.log('🚀 統合テスト実行開始');
  console.log('📋 データフロー図ベースのシステム統合テスト');
  console.log('=' .repeat(60));

  const framework = new IntegrationTestFramework();
  
  // 全テストスイートを実行
  const testSuites = [
    dataSyncTestSuite,
    hybridSearchTestSuite,
    aiResponseTestSuite,
    endToEndTestSuite
  ];

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const suite of testSuites) {
    const results = await framework.runTestSuite(suite);
    
    totalPassed += results.filter(r => r.status === 'PASS').length;
    totalFailed += results.filter(r => r.status === 'FAIL').length;
    totalSkipped += results.filter(r => r.status === 'SKIP').length;
  }

  // 最終サマリー
  console.log('\n🎯 統合テスト最終結果');
  console.log('=' .repeat(60));
  console.log(`✅ 成功: ${totalPassed}件`);
  console.log(`❌ 失敗: ${totalFailed}件`);
  console.log(`⏭️  スキップ: ${totalSkipped}件`);
  console.log(`📈 成功率: ${((totalPassed / (totalPassed + totalFailed + totalSkipped)) * 100).toFixed(1)}%`);

  if (totalFailed === 0) {
    console.log('\n🎉 すべての統合テストが成功しました！');
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${totalFailed}件のテストが失敗しました。`);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみテストを実行
if (require.main === module) {
  runIntegrationTests().catch(error => {
    console.error('❌ 統合テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { runIntegrationTests, dataSyncTestSuite, hybridSearchTestSuite, aiResponseTestSuite, endToEndTestSuite };
