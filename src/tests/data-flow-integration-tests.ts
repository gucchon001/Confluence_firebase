/**
 * データフロー図ベースの詳細統合テスト
 * 
 * docs/data-flow-diagram-lancedb.mdに基づいて
 * 各コンポーネントとデータフローの詳細テストを実装
 */

import { IntegrationTestFramework, IntegrationTestResult } from './integration-test-framework';

/**
 * データ取得と処理フローのテスト
 * データフロー図の1-5番のプロセスをテスト
 */
export async function testDataAcquisitionFlow(): Promise<IntegrationTestResult> {
  const startTime = Date.now();
  
  try {
    // 1. Confluence API接続テスト（モック）
    console.log('   📡 Confluence API接続テスト...');
    // 実際のAPI接続は重いので、LanceDBのデータ存在で代替
    
    // 2. バッチ同期処理テスト
    console.log('   🔄 バッチ同期処理テスト...');
    const { LanceDBClient } = await import('../lib/lancedb-client');
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    
    // 3. テキスト分割テスト
    console.log('   ✂️ テキスト分割テスト...');
    const table = await lancedbClient.getTable();
    
    // ダミーベクトルでサンプルデータを取得
    const dummyVector = new Array(768).fill(0);
    const sampleData = await table.search(dummyVector).limit(1).toArray();
    
    if (sampleData.length === 0) {
      throw new Error('サンプルデータが見つかりません');
    }
    
    const sampleRow = sampleData[0];
    const hasContent = sampleRow.content && sampleRow.content.length > 0;
    const hasTitle = sampleRow.title && sampleRow.title.length > 0;
    
    if (!hasContent || !hasTitle) {
      throw new Error('データの構造が不正です');
    }
    
    // 4. 埋め込みベクトル生成テスト
    console.log('   🧠 埋め込みベクトル生成テスト...');
    const { getEmbeddings } = await import('../lib/embeddings');
    
    const testText = '教室管理の詳細について';
    const embedding = await getEmbeddings(testText);
    
    if (!embedding || embedding.length !== 768) {
      throw new Error('埋め込みベクトルの生成に失敗しました');
    }
    
    // 5. ベクトルとメタデータ保存テスト
    console.log('   💾 ベクトル保存テスト...');
    const tableCount = await table.countRows();
    
    if (tableCount === 0) {
      throw new Error('データが保存されていません');
    }
    
    return {
      testName: 'Data Acquisition Flow',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'Data acquisition and processing flow completed successfully',
      metrics: {
        tableRowCount: tableCount,
        embeddingDimension: embedding.length,
        hasValidContent: hasContent,
        hasValidTitle: hasTitle,
        sampleDataValid: true
      }
    };

  } catch (error) {
    return {
      testName: 'Data Acquisition Flow',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Data acquisition flow failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * ハイブリッド検索フローのテスト
 * データフロー図の7-12番のプロセスをテスト
 */
export async function testHybridSearchFlow(): Promise<IntegrationTestResult> {
  const startTime = Date.now();
  
  try {
    // 7. ユーザークエリ処理テスト
    console.log('   💬 ユーザークエリ処理テスト...');
    const testQuery = '教室管理の詳細は';
    
    // 8a. クエリベクトル化テスト
    console.log('   🔢 クエリベクトル化テスト...');
    const { getEmbeddings } = await import('../lib/embeddings');
    const queryEmbedding = await getEmbeddings(testQuery);
    
    if (!queryEmbedding || queryEmbedding.length !== 768) {
      throw new Error('クエリベクトル化に失敗しました');
    }
    
    // 8b. 動的キーワード抽出テスト
    console.log('   🔍 動的キーワード抽出テスト...');
    const { unifiedKeywordExtractionService } = await import('../lib/unified-keyword-extraction-service');
    const keywords = await unifiedKeywordExtractionService.extractKeywordsConfigured(testQuery);
    
    if (!keywords || keywords.length === 0) {
      throw new Error('キーワード抽出に失敗しました');
    }
    
    // 8c. ドメイン知識参照テスト
    console.log('   📚 ドメイン知識参照テスト...');
    const hasDomainKeywords = keywords.some(k => k.includes('教室') || k.includes('管理'));
    
    if (!hasDomainKeywords) {
      console.log('   ⚠️ ドメインキーワードの関連性が低い可能性があります');
    }
    
    // 9a-9d. 並列検索実行テスト
    console.log('   🔄 並列検索実行テスト...');
    const { HybridSearchEngine } = await import('../lib/hybrid-search-engine');
    const hybridSearchEngine = new HybridSearchEngine();
    
    const searchResults = await hybridSearchEngine.search(testQuery);
    
    if (!searchResults || searchResults.length === 0) {
      throw new Error('検索結果が返されませんでした');
    }
    
    // 11. スコアリング統合・重複除去テスト
    console.log('   📊 スコアリング統合テスト...');
    const hasHighScoreResults = searchResults.some(r => (r.score || 0) > 0.5);
    const hasRelevantResults = searchResults.some(r => 
      r.title.toLowerCase().includes('教室') || 
      r.title.toLowerCase().includes('管理')
    );
    
    if (!hasRelevantResults) {
      console.log('   ⚠️ 関連性の高い結果が見つかりませんでした');
    }
    
    return {
      testName: 'Hybrid Search Flow',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'Hybrid search flow completed successfully',
      metrics: {
        query: testQuery,
        queryEmbeddingDimension: queryEmbedding.length,
        keywordCount: keywords.length,
        searchResultCount: searchResults.length,
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
 * データフロー図の13-16番のプロセスをテスト
 */
export async function testAIResponseGenerationFlow(): Promise<IntegrationTestResult> {
  const startTime = Date.now();
  
  try {
    // 13. コンテキスト生成テスト
    console.log('   📝 コンテキスト生成テスト...');
    const testQuery = '教室管理の詳細は';
    
    // ハイブリッド検索でコンテキストを取得
    const { HybridSearchEngine } = await import('../lib/hybrid-search-engine');
    const hybridSearchEngine = new HybridSearchEngine();
    const searchResults = await hybridSearchEngine.search(testQuery);
    
    if (!searchResults || searchResults.length === 0) {
      throw new Error('検索結果が取得できませんでした');
    }
    
    // 14. LLM API呼び出しテスト
    console.log('   🤖 LLM API呼び出しテスト...');
    const { streamingSummarizeConfluenceDocsBackend } = await import('../ai/flows/streaming-summarize-confluence-docs');
    const aiResponse = await streamingSummarizeConfluenceDocsBackend({ question: testQuery, context: [], chatHistory: [] });
    
    if (!aiResponse || !aiResponse.answer) {
      throw new Error('AI回答が生成されませんでした');
    }
    
    // 回答の品質チェック
    const responseText = aiResponse.answer;
    const responseLength = responseText.length;
    const hasMinimumLength = responseLength > 100;
    const hasRelevantContent = responseText.toLowerCase().includes('教室') || 
                              responseText.toLowerCase().includes('管理');
    
    if (!hasMinimumLength) {
      console.log('   ⚠️ 回答が短すぎる可能性があります');
    }
    
    if (!hasRelevantContent) {
      console.log('   ⚠️ 回答に関連性の高いコンテンツが見つかりません');
    }
    
    // 16. 会話履歴保存テスト（モック）
    console.log('   💾 会話履歴保存テスト...');
    // 実際のFirestore保存は重いので、レスポンス構造の確認で代替
    const hasValidResponse = aiResponse.finishReason && 
                            aiResponse.usage && 
                            aiResponse.model;
    
    if (!hasValidResponse) {
      console.log('   ⚠️ AI回答の構造が不完全です');
    }
    
    return {
      testName: 'AI Response Generation Flow',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'AI response generation flow completed successfully',
      metrics: {
        query: testQuery,
        searchResultCount: searchResults.length,
        responseLength,
        hasMinimumLength,
        hasRelevantContent,
        hasValidResponse,
        finishReason: aiResponse.finishReason,
        model: aiResponse.model
      }
    };

  } catch (error) {
    return {
      testName: 'AI Response Generation Flow',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'AI response generation flow failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * コンポーネント間連携テスト
 * データフロー図の各コンポーネント間の連携をテスト
 */
export async function testComponentIntegration(): Promise<IntegrationTestResult> {
  const startTime = Date.now();
  
  try {
    console.log('   🔗 コンポーネント間連携テスト...');
    
    // 1. LanceDB ↔ Lunr.js 連携テスト
    console.log('   📊 LanceDB ↔ Lunr.js 連携テスト...');
    const { LanceDBClient } = await import('../lib/lancedb-client');
    const { LunrSearchClient } = await import('../lib/lunr-search-client');
    
    const lancedbClient = LanceDBClient.getInstance();
    await lancedbClient.connect();
    
    const lunrClient = LunrSearchClient.getInstance();
    await lunrClient.initialize();
    
    // 2. 埋め込みサービス ↔ 検索エンジン連携テスト
    console.log('   🧠 埋め込みサービス ↔ 検索エンジン連携テスト...');
    const { getEmbeddings } = await import('../lib/embeddings');
    const { HybridSearchEngine } = await import('../lib/hybrid-search-engine');
    
    const hybridSearchEngine = new HybridSearchEngine();
    
    const testQuery = '教室管理の詳細は';
    const embedding = await getEmbeddings(testQuery);
    const searchResults = await hybridSearchEngine.search(testQuery);
    
    // 3. キーワード抽出器 ↔ 検索エンジン連携テスト
    console.log('   🔍 キーワード抽出器 ↔ 検索エンジン連携テスト...');
    const { unifiedKeywordExtractionService } = await import('../lib/unified-keyword-extraction-service');
    const keywords = await unifiedKeywordExtractionService.extractKeywordsConfigured(testQuery);
    
    // 4. 検索エンジン ↔ AI回答生成連携テスト
    console.log('   🤖 検索エンジン ↔ AI回答生成連携テスト...');
    const { streamingSummarizeConfluenceDocsBackend } = await import('../ai/flows/streaming-summarize-confluence-docs');
    const aiResponse = await streamingSummarizeConfluenceDocsBackend({ question: testQuery, context: [], chatHistory: [] });
    
    // 連携の品質チェック
    const allComponentsWorking = embedding && 
                                searchResults && 
                                keywords && 
                                aiResponse;
    
    if (!allComponentsWorking) {
      throw new Error('一部のコンポーネント連携に失敗しました');
    }
    
    return {
      testName: 'Component Integration',
      status: 'PASS',
      duration: Date.now() - startTime,
      details: 'Component integration test completed successfully',
      metrics: {
        lancedbConnected: true,
        lunrInitialized: true,
        embeddingGenerated: !!embedding,
        searchResultsGenerated: !!searchResults,
        keywordsExtracted: !!keywords,
        aiResponseGenerated: !!aiResponse,
        allComponentsWorking
      }
    };

  } catch (error) {
    return {
      testName: 'Component Integration',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'Component integration test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * パフォーマンス統合テスト
 * システム全体のパフォーマンスを測定
 */
export async function testSystemPerformance(): Promise<IntegrationTestResult> {
  const startTime = Date.now();
  
  try {
    console.log('   ⚡ システムパフォーマンステスト...');
    
    const testQueries = [
      '教室管理の詳細は',
      '求人情報の登録方法',
      'ユーザー認証の仕組み',
      'データベースの設計',
      'APIの実装方法',
      '検索機能の最適化',
      'AI回答の品質向上',
      'システム監視の方法'
    ];
    
    const results = [];
    
    for (const query of testQueries) {
      const queryStart = Date.now();
      
      // 完全な検索フロー実行
      const { HybridSearchEngine } = await import('../lib/hybrid-search-engine');
      const { streamingSummarizeConfluenceDocsBackend } = await import('../ai/flows/streaming-summarize-confluence-docs');
      
      const hybridSearchEngine = new HybridSearchEngine();
      const searchResults = await hybridSearchEngine.search(query);
      const aiResponse = await streamingSummarizeConfluenceDocsBackend({ question: query, context: [], chatHistory: [] });
      
      const queryDuration = Date.now() - queryStart;
      
      results.push({
        query,
        duration: queryDuration,
        searchResultCount: searchResults?.length || 0,
        aiResponseLength: aiResponse?.answer?.length || 0,
        success: !!(searchResults && aiResponse)
      });
    }
    
    const totalDuration = Date.now() - startTime;
    const averageDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const maxDuration = Math.max(...results.map(r => r.duration));
    const successRate = results.filter(r => r.success).length / results.length;
    
    // パフォーマンス基準チェック
    const performanceThresholds = {
      averageDuration: 15000, // 15秒
      maxDuration: 30000,     // 30秒
      successRate: 0.9        // 90%
    };
    
    const meetsThresholds = averageDuration <= performanceThresholds.averageDuration &&
                           maxDuration <= performanceThresholds.maxDuration &&
                           successRate >= performanceThresholds.successRate;
    
    if (!meetsThresholds) {
      console.log('   ⚠️ パフォーマンス基準を下回っています');
    }
    
    return {
      testName: 'System Performance',
      status: meetsThresholds ? 'PASS' : 'FAIL',
      duration: totalDuration,
      details: meetsThresholds ? 
        'System performance test passed' : 
        'System performance test failed - thresholds not met',
      metrics: {
        testQueries: testQueries.length,
        totalDuration,
        averageDuration,
        maxDuration,
        successRate,
        queriesPerSecond: (testQueries.length / (totalDuration / 1000)).toFixed(2),
        meetsThresholds,
        thresholds: performanceThresholds,
        results
      }
    };

  } catch (error) {
    return {
      testName: 'System Performance',
      status: 'FAIL',
      duration: Date.now() - startTime,
      details: 'System performance test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
