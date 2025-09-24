/**
 * データフロー図ベースのテストスイート定義
 * 
 * docs/data-flow-diagram-lancedb.mdの各段階に対応する
 * 詳細なテストスイートを定義
 */

import { IntegrationTestSuite } from './integration-test-framework';
import { 
  testDataAcquisitionFlow, 
  testHybridSearchFlow, 
  testAIResponseGenerationFlow,
  testComponentIntegration,
  testSystemPerformance
} from './data-flow-integration-tests';

/**
 * データ取得と処理段階のテストスイート
 * データフロー図の1-5番のプロセス
 */
export const dataAcquisitionTestSuite: IntegrationTestSuite = {
  name: 'データ取得と処理段階',
  description: 'Confluence APIからLanceDBへのデータ取得・処理・保存プロセス',
  tests: [
    {
      name: 'データ取得フロー',
      description: 'Confluence APIからのデータ取得からLanceDB保存までの完全フロー',
      testFunction: testDataAcquisitionFlow,
      timeout: 60000
    },
    {
      name: 'データ整合性検証',
      description: '同期されたデータの整合性と品質の検証',
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
          
          // サンプルデータの詳細チェック
          const dummyVector = new Array(768).fill(0);
          const sampleData = await table.search(dummyVector).limit(10).toArray();
          const validationResults = {
            hasTitle: 0,
            hasContent: 0,
            hasSpaceKey: 0,
            hasLabels: 0,
            hasValidEmbedding: 0
          };
          
          for (const row of sampleData) {
            if (row.title && row.title.length > 0) validationResults.hasTitle++;
            if (row.content && row.content.length > 0) validationResults.hasContent++;
            if (row.spaceKey && row.spaceKey.length > 0) validationResults.hasSpaceKey++;
            if (row.labels && Array.isArray(row.labels)) validationResults.hasLabels++;
            if (row.embedding && Array.isArray(row.embedding) && row.embedding.length === 768) {
              validationResults.hasValidEmbedding++;
            }
          }
          
          const validationRate = Object.values(validationResults).reduce((sum, count) => sum + count, 0) / 
                                (Object.keys(validationResults).length * sampleData.length);
          
          if (validationRate < 0.8) {
            throw new Error(`データ品質が低すぎます: 検証率 ${(validationRate * 100).toFixed(1)}%`);
          }
          
          return {
            testName: 'Data Integrity Validation',
            status: 'PASS',
            duration: Date.now() - startTime,
            details: 'Data integrity validation completed successfully',
            metrics: {
              totalRows: count,
              sampleSize: sampleData.length,
              validationRate: validationRate,
              validationResults
            }
          };

        } catch (error) {
          return {
            testName: 'Data Integrity Validation',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'Data integrity validation failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      timeout: 30000
    }
  ]
};

/**
 * ハイブリッド検索段階のテストスイート
 * データフロー図の7-12番のプロセス
 */
export const hybridSearchTestSuite: IntegrationTestSuite = {
  name: 'ハイブリッド検索段階',
  description: 'ベクトル検索、BM25検索、キーワード検索の統合検索プロセス',
  tests: [
    {
      name: 'ハイブリッド検索フロー',
      description: 'クエリ処理から検索結果統合までの完全フロー',
      testFunction: testHybridSearchFlow,
      timeout: 60000
    },
    {
      name: '検索精度評価',
      description: '検索結果の精度と関連性の詳細評価',
      testFunction: async () => {
        const startTime = Date.now();
        
        try {
          const testQueries = [
            { query: '教室管理の詳細は', expectedKeywords: ['教室', '管理', '詳細'] },
            { query: '求人情報の登録方法', expectedKeywords: ['求人', '登録', '方法'] },
            { query: 'ユーザー認証の仕組み', expectedKeywords: ['ユーザー', '認証', '仕組み'] },
            { query: 'データベースの設計', expectedKeywords: ['データベース', '設計'] },
            { query: 'APIの実装方法', expectedKeywords: ['API', '実装', '方法'] }
          ];
          
          const { HybridSearchEngine } = await import('../lib/hybrid-search-engine');
          const hybridSearchEngine = new HybridSearchEngine();
          
          const results = [];
          
          for (const testCase of testQueries) {
            const searchResults = await hybridSearchEngine.search(testCase.query);
            
            // 検索結果の精度評価
            const hasResults = searchResults && searchResults.length > 0;
            const hasHighScoreResults = searchResults?.some(r => (r.score || 0) > 0.3);
            
            // 関連性評価（タイトルに期待キーワードが含まれているか）
            const relevantResults = searchResults?.filter(r => 
              testCase.expectedKeywords.some(keyword => 
                r.title.toLowerCase().includes(keyword.toLowerCase())
              )
            ) || [];
            
            const relevanceRate = relevantResults.length / (searchResults?.length || 1);
            
            results.push({
              query: testCase.query,
              expectedKeywords: testCase.expectedKeywords,
              resultCount: searchResults?.length || 0,
              hasResults,
              hasHighScoreResults,
              relevantResults: relevantResults.length,
              relevanceRate,
              topScore: Math.max(...(searchResults?.map(r => r.score || 0) || [0]))
            });
          }
          
          const overallSuccessRate = results.filter(r => r.hasResults).length / results.length;
          const overallRelevanceRate = results.reduce((sum, r) => sum + r.relevanceRate, 0) / results.length;
          
          if (overallSuccessRate < 0.8) {
            throw new Error(`検索成功率が低すぎます: ${(overallSuccessRate * 100).toFixed(1)}%`);
          }
          
          return {
            testName: 'Search Accuracy Evaluation',
            status: 'PASS',
            duration: Date.now() - startTime,
            details: 'Search accuracy evaluation completed successfully',
            metrics: {
              testQueries: testQueries.length,
              overallSuccessRate,
              overallRelevanceRate,
              results
            }
          };

        } catch (error) {
          return {
            testName: 'Search Accuracy Evaluation',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'Search accuracy evaluation failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      timeout: 90000
    }
  ]
};

/**
 * AI回答生成段階のテストスイート
 * データフロー図の13-16番のプロセス
 */
export const aiResponseTestSuite: IntegrationTestSuite = {
  name: 'AI回答生成段階',
  description: 'LLMを使用した回答生成と会話履歴保存プロセス',
  tests: [
    {
      name: 'AI回答生成フロー',
      description: 'コンテキスト生成からAI回答生成までの完全フロー',
      testFunction: testAIResponseGenerationFlow,
      timeout: 120000
    },
    {
      name: '回答品質評価',
      description: '生成された回答の品質と関連性の詳細評価',
      testFunction: async () => {
        const startTime = Date.now();
        
        try {
          const testQueries = [
            { query: '教室管理の詳細は', expectedTopics: ['教室', '管理', '機能'] },
            { query: '求人登録の手順', expectedTopics: ['求人', '登録', '手順'] },
            { query: 'ユーザー管理の機能', expectedTopics: ['ユーザー', '管理', '機能'] },
            { query: 'データ同期の仕組み', expectedTopics: ['データ', '同期', '仕組み'] },
            { query: '検索機能の実装', expectedTopics: ['検索', '機能', '実装'] }
          ];
          
          const { summarizeConfluenceDocs } = await import('../ai/flows/summarize-confluence-docs');
          
          const results = [];
          
          for (const testCase of testQueries) {
            const aiResponse = await summarizeConfluenceDocs(testCase.query);
            
            if (!aiResponse || !aiResponse.message) {
              throw new Error(`AI回答が生成されませんでした: ${testCase.query}`);
            }
            
            const responseText = aiResponse.message;
            const responseLength = responseText.length;
            
            // 回答の品質評価
            const hasMinimumLength = responseLength > 100;
            const hasRelevantContent = testCase.expectedTopics.some(topic => 
              responseText.toLowerCase().includes(topic.toLowerCase())
            );
            
            // 回答の構造評価
            const hasStructure = responseText.includes('###') || responseText.includes('*') || responseText.includes('-');
            const hasReferences = responseText.includes('参照') || responseText.includes('詳細');
            
            results.push({
              query: testCase.query,
              expectedTopics: testCase.expectedTopics,
              responseLength,
              hasMinimumLength,
              hasRelevantContent,
              hasStructure,
              hasReferences,
              finishReason: aiResponse.finishReason,
              model: aiResponse.model
            });
          }
          
          const successRate = results.filter(r => r.hasMinimumLength && r.hasRelevantContent).length / results.length;
          const structureRate = results.filter(r => r.hasStructure).length / results.length;
          
          if (successRate < 0.7) {
            throw new Error(`回答品質が低すぎます: 成功率 ${(successRate * 100).toFixed(1)}%`);
          }
          
          return {
            testName: 'AI Response Quality Evaluation',
            status: 'PASS',
            duration: Date.now() - startTime,
            details: 'AI response quality evaluation completed successfully',
            metrics: {
              testQueries: testQueries.length,
              successRate,
              structureRate,
              averageLength: results.reduce((sum, r) => sum + r.responseLength, 0) / results.length,
              results
            }
          };

        } catch (error) {
          return {
            testName: 'AI Response Quality Evaluation',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'AI response quality evaluation failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      timeout: 180000
    }
  ]
};

/**
 * コンポーネント統合テストスイート
 * データフロー図の各コンポーネント間の連携
 */
export const componentIntegrationTestSuite: IntegrationTestSuite = {
  name: 'コンポーネント統合',
  description: 'システム内の各コンポーネント間の連携と統合動作',
  tests: [
    {
      name: 'コンポーネント間連携',
      description: 'LanceDB、Lunr.js、埋め込みサービス、検索エンジン、AI回答生成の連携',
      testFunction: testComponentIntegration,
      timeout: 120000
    },
    {
      name: 'システム全体パフォーマンス',
      description: 'システム全体のパフォーマンス測定と最適化確認',
      testFunction: testSystemPerformance,
      timeout: 300000
    }
  ]
};

/**
 * エンドツーエンドテストスイート
 * データフロー図の完全なフロー
 */
export const endToEndTestSuite: IntegrationTestSuite = {
  name: 'エンドツーエンドテスト',
  description: 'データ同期からAI回答生成までの完全なシステムフロー',
  tests: [
    {
      name: '完全データフローテスト',
      description: 'データフロー図の全プロセスを順次実行する完全テスト',
      testFunction: async () => {
        const startTime = Date.now();
        
        try {
          console.log('   🔄 完全データフローテスト開始...');
          
          // 1. データ取得と処理（1-5番）
          console.log('   📥 データ取得と処理段階...');
          const dataAcquisitionResult = await testDataAcquisitionFlow();
          if (dataAcquisitionResult.status !== 'PASS') {
            throw new Error('データ取得と処理段階で失敗しました');
          }
          
          // 2. ハイブリッド検索（7-12番）
          console.log('   🔍 ハイブリッド検索段階...');
          const hybridSearchResult = await testHybridSearchFlow();
          if (hybridSearchResult.status !== 'PASS') {
            throw new Error('ハイブリッド検索段階で失敗しました');
          }
          
          // 3. AI回答生成（13-16番）
          console.log('   🤖 AI回答生成段階...');
          const aiResponseResult = await testAIResponseGenerationFlow();
          if (aiResponseResult.status !== 'PASS') {
            throw new Error('AI回答生成段階で失敗しました');
          }
          
          // 4. コンポーネント統合確認
          console.log('   🔗 コンポーネント統合確認...');
          const componentIntegrationResult = await testComponentIntegration();
          if (componentIntegrationResult.status !== 'PASS') {
            throw new Error('コンポーネント統合で失敗しました');
          }
          
          const totalDuration = Date.now() - startTime;
          
          return {
            testName: 'Complete Data Flow Test',
            status: 'PASS',
            duration: totalDuration,
            details: 'Complete data flow test passed successfully',
            metrics: {
              dataAcquisitionDuration: dataAcquisitionResult.duration,
              hybridSearchDuration: hybridSearchResult.duration,
              aiResponseDuration: aiResponseResult.duration,
              componentIntegrationDuration: componentIntegrationResult.duration,
              totalDuration,
              allStagesPassed: true
            }
          };

        } catch (error) {
          return {
            testName: 'Complete Data Flow Test',
            status: 'FAIL',
            duration: Date.now() - startTime,
            details: 'Complete data flow test failed',
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      },
      timeout: 600000 // 10分
    }
  ]
};
