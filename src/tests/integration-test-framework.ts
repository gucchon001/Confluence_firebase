/**
 * 統合テストフレームワーク
 * 
 * データフロー図に基づいてシステム全体の統合テストを実行
 * - データ同期フロー
 * - ハイブリッド検索フロー  
 * - AI回答生成フロー
 * - エンドツーエンドテスト
 */

import { LanceDBClient } from '../lib/lancedb-client';
import { LunrSearchClient } from '../lib/lunr-search-client';
import { HybridSearchEngine } from '../lib/hybrid-search-engine';
import { DynamicKeywordExtractor } from '../lib/dynamic-keyword-extractor';
import { streamingSummarizeConfluenceDocsBackend } from '../ai/flows/streaming-summarize-confluence-docs';
import { UnifiedFirebaseService } from '../lib/unified-firebase-service';

export interface IntegrationTestResult {
  testName: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  details: string;
  metrics?: Record<string, any>;
  error?: string;
}

export interface IntegrationTestSuite {
  name: string;
  description: string;
  tests: IntegrationTestCase[];
}

export interface IntegrationTestCase {
  name: string;
  description: string;
  testFunction: () => Promise<IntegrationTestResult>;
  timeout?: number;
  retries?: number;
}

export class IntegrationTestFramework {
  private results: IntegrationTestResult[] = [];
  private startTime: number = 0;

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * テストスイートを実行
   */
  async runTestSuite(suite: IntegrationTestSuite): Promise<IntegrationTestResult[]> {
    console.log(`\n🧪 統合テストスイート実行開始: ${suite.name}`);
    console.log(`📝 説明: ${suite.description}`);
    console.log(`📊 テスト数: ${suite.tests.length}件\n`);

    this.results = [];

    for (const testCase of suite.tests) {
      await this.runTestCase(testCase);
    }

    this.printSummary(suite);
    return this.results;
  }

  /**
   * 個別テストケースを実行
   */
  private async runTestCase(testCase: IntegrationTestCase): Promise<void> {
    const timeout = testCase.timeout || 30000; // デフォルト30秒
    const retries = testCase.retries || 0;
    
    console.log(`\n🔍 テスト実行: ${testCase.name}`);
    console.log(`📝 説明: ${testCase.description}`);

    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await Promise.race([
          testCase.testFunction(),
          new Promise<IntegrationTestResult>((_, reject) => 
            setTimeout(() => reject(new Error('Test timeout')), timeout)
          )
        ]);

        result.testName = testCase.name;
        this.results.push(result);
        
        const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⏭️';
        console.log(`${statusIcon} ${testCase.name}: ${result.status}`);
        
        if (result.status === 'FAIL' && result.error) {
          console.log(`   ❌ エラー: ${result.error}`);
        }
        
        if (result.metrics) {
          console.log(`   📊 メトリクス:`, result.metrics);
        }
        
        return; // 成功したら終了
        
      } catch (error) {
        lastError = error as Error;
        console.log(`   ⚠️ 試行 ${attempt + 1}/${retries + 1} 失敗: ${lastError.message}`);
        
        if (attempt < retries) {
          console.log(`   🔄 リトライ中...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待機
        }
      }
    }

    // すべてのリトライが失敗した場合
    const result: IntegrationTestResult = {
      testName: testCase.name,
      status: 'FAIL',
      duration: Date.now() - this.startTime,
      details: `All ${retries + 1} attempts failed`,
      error: lastError?.message || 'Unknown error'
    };
    
    this.results.push(result);
    console.log(`❌ ${testCase.name}: FAIL (${retries + 1} attempts failed)`);
  }

  /**
   * テスト結果サマリーを表示
   */
  private printSummary(suite: IntegrationTestSuite): void {
    const totalDuration = Date.now() - this.startTime;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;

    console.log(`\n📊 統合テストスイート結果: ${suite.name}`);
    console.log(`⏱️  実行時間: ${(totalDuration / 1000).toFixed(2)}秒`);
    console.log(`✅ 成功: ${passed}件`);
    console.log(`❌ 失敗: ${failed}件`);
    console.log(`⏭️  スキップ: ${skipped}件`);
    console.log(`📈 成功率: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log(`\n❌ 失敗したテスト:`);
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`   - ${r.testName}: ${r.error || 'Unknown error'}`);
        });
    }

    console.log(`\n🎯 統合テスト完了\n`);
  }

  /**
   * データ同期フローのテスト
   */
  static async testDataSyncFlow(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      // 1. LanceDB接続テスト
      const lancedbClient = LanceDBClient.getInstance();
      await lancedbClient.connect();
      
      // 2. テーブル存在確認
      const tables = await lancedbClient.listTables();
      if (!tables.includes('confluence')) {
        throw new Error('Confluence table not found');
      }

      // 3. データ件数確認
      const table = await lancedbClient.getTable();
      const count = await table.countRows();
      
      if (count === 0) {
        throw new Error('No data found in confluence table');
      }

      return {
        testName: 'Data Sync Flow',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: `Data sync flow completed successfully`,
        metrics: {
          tableCount: tables.length,
          confluenceRowCount: count,
          tables: tables
        }
      };

    } catch (error) {
      return {
        testName: 'Data Sync Flow',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Data sync flow failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ハイブリッド検索フローのテスト
   */
  static async testHybridSearchFlow(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      // 1. 検索エンジン初期化
      const hybridSearchEngine = new HybridSearchEngine();
      
      // 2. テストクエリで検索実行
      const testQuery = '教室管理の詳細は';
      const searchResults = await hybridSearchEngine.search(testQuery);
      
      if (!searchResults || searchResults.length === 0) {
        throw new Error('No search results returned');
      }

      // 3. 検索結果の品質チェック
      const hasHighScoreResults = searchResults.some(r => (r.score || 0) > 0.5);
      const hasRelevantResults = searchResults.some(r => 
        r.title.toLowerCase().includes('教室') || 
        r.title.toLowerCase().includes('管理')
      );

      if (!hasHighScoreResults) {
        console.log('   ⚠️ 高スコアの結果が見つかりません');
      }

      if (!hasRelevantResults) {
        console.log('   ⚠️ 関連性の高い結果が見つかりません');
      }

      return {
        testName: 'Hybrid Search Flow',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: `Hybrid search completed successfully`,
        metrics: {
          query: testQuery,
          resultCount: searchResults.length,
          hasHighScoreResults,
          hasRelevantResults,
          topScore: Math.max(...searchResults.map(r => r.score || 0)),
          averageScore: searchResults.reduce((sum, r) => sum + (r.score || 0), 0) / searchResults.length
        }
      };

    } catch (error) {
      return {
        testName: 'Hybrid Search Flow',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Hybrid search flow failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * AI回答生成フローのテスト
   */
  static async testAIResponseFlow(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      // 1. テストクエリでAI回答生成
      const testQuery = '教室管理の詳細は';
      const aiResponse = await streamingSummarizeConfluenceDocsBackend({ question: testQuery, context: [], chatHistory: [] });
      
      if (!aiResponse || !aiResponse.answer) {
        throw new Error('No AI response generated');
      }

      // 2. 回答の品質チェック
      const responseText = aiResponse.answer;
      const hasRelevantContent = responseText.toLowerCase().includes('教室') || 
                                responseText.toLowerCase().includes('管理');
      
      const responseLength = responseText.length;
      const hasMinimumLength = responseLength > 100;

      if (!hasRelevantContent) {
        console.log('   ⚠️ 回答に関連性の高いコンテンツが見つかりません');
      }

      if (!hasMinimumLength) {
        console.log('   ⚠️ 回答が短すぎます');
      }

      return {
        testName: 'AI Response Flow',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: `AI response generation completed successfully`,
        metrics: {
          query: testQuery,
          responseLength,
          hasRelevantContent,
          hasMinimumLength,
          finishReason: aiResponse.finishReason
        }
      };

    } catch (error) {
      return {
        testName: 'AI Response Flow',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'AI response generation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * エンドツーエンドテスト
   */
  static async testEndToEndFlow(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
      // 1. 全コンポーネントの初期化
      const lancedbClient = LanceDBClient.getInstance();
      await lancedbClient.connect();

      const lunrClient = LunrSearchClient.getInstance();
      await lunrClient.initialize();

      const hybridSearchEngine = new HybridSearchEngine();
      const keywordExtractor = new DynamicKeywordExtractor();

      // 2. 完全な検索フロー実行
      const testQuery = '教室管理の詳細は';
      
      // キーワード抽出
      const keywords = await keywordExtractor.extractKeywords(testQuery);
      
      // ハイブリッド検索
      const searchResults = await hybridSearchEngine.search(testQuery);
      
      // AI回答生成
      const aiResponse = await streamingSummarizeConfluenceDocsBackend({ question: testQuery, context: [], chatHistory: [] });

      // 3. 結果の統合チェック
      const hasKeywords = keywords && keywords.length > 0;
      const hasSearchResults = searchResults && searchResults.length > 0;
      const hasAIResponse = aiResponse && aiResponse.answer;

      if (!hasKeywords) {
        throw new Error('Keyword extraction failed');
      }

      if (!hasSearchResults) {
        throw new Error('Search execution failed');
      }

      if (!hasAIResponse) {
        throw new Error('AI response generation failed');
      }

      return {
        testName: 'End-to-End Flow',
        status: 'PASS',
        duration: Date.now() - startTime,
        details: `Complete end-to-end flow executed successfully`,
        metrics: {
          query: testQuery,
          keywordCount: keywords?.length || 0,
          searchResultCount: searchResults?.length || 0,
          aiResponseLength: aiResponse?.answer?.length || 0,
          allComponentsWorking: true
        }
      };

    } catch (error) {
      return {
        testName: 'End-to-End Flow',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'End-to-end flow failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * パフォーマンステスト
   */
  static async testPerformanceFlow(): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    
    try {
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
        const queryStart = Date.now();
        const searchResults = await hybridSearchEngine.search(query);
        const queryDuration = Date.now() - queryStart;
        
        results.push({
          query,
          duration: queryDuration,
          resultCount: searchResults?.length || 0
        });
      }

      const totalDuration = Date.now() - startTime;
      const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
      const maxDuration = Math.max(...results.map(r => r.duration));

      return {
        testName: 'Performance Flow',
        status: 'PASS',
        duration: totalDuration,
        details: `Performance test completed successfully`,
        metrics: {
          totalQueries: testQueries.length,
          totalDuration,
          averageDuration,
          maxDuration,
          queriesPerSecond: (testQueries.length / (totalDuration / 1000)).toFixed(2),
          results
        }
      };

    } catch (error) {
      return {
        testName: 'Performance Flow',
        status: 'FAIL',
        duration: Date.now() - startTime,
        details: 'Performance test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
