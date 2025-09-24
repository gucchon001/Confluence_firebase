/**
 * 実際のベクトルファイルを使ったテストを実行するスクリプト
 * 
 * このスクリプトは、実際のConfluenceデータのベクトルファイルを使用して
 * ベクトル検索の質を包括的に評価します。
 * 実行方法: npx tsx src/tests/lancedb/run-real-vector-tests.ts
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';
import { searchLanceDB } from '../../lib/lancedb-search-client';

interface TestResult {
  testName: string;
  status: 'success' | 'error';
  duration: number;
  details: any;
  error?: string;
}

interface VectorSearchAnalysis {
  query: string;
  totalResults: number;
  relevantResults: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageDistance: number;
  averageScore: number;
  topResults: Array<{
    title: string;
    score: number;
    distance: number;
    isRelevant: boolean;
  }>;
}

/**
 * 実際のベクトルデータの確認
 */
async function verifyVectorData(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n=== 実際のベクトルデータの確認 ===');
  
  try {
    // LanceDBに接続
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tables = await db.tableNames();
    
    console.log('利用可能なテーブル:', tables);
    
    if (!tables.includes('confluence')) {
      throw new Error('テーブル "confluence" が見つかりません');
    }
    
    const tbl = await db.openTable('confluence');
    const rowCount = await tbl.countRows();
    
    console.log(`テーブル "confluence" のレコード数: ${rowCount}件`);
    
    if (rowCount === 0) {
      throw new Error('テーブル "confluence" にデータがありません');
    }
    
    // サンプルレコードを確認
    const sampleRecords = await tbl.query().limit(5).toArray();
    console.log('\nサンプルレコード:');
    
    const sampleData = sampleRecords.map((record, index) => ({
      index: index + 1,
      id: record.id,
      title: record.title,
      vectorLength: Array.isArray(record.vector) ? record.vector.length : 'N/A',
      hasContent: !!record.content,
      hasLabels: !!record.labels
    }));
    
    sampleData.forEach(data => {
      console.log(`${data.index}. ${data.title}`);
      console.log(`   ID: ${data.id}`);
      console.log(`   ベクトル次元: ${data.vectorLength}`);
      console.log(`   コンテンツ: ${data.hasContent ? 'あり' : 'なし'}`);
      console.log(`   ラベル: ${data.hasLabels ? 'あり' : 'なし'}`);
    });
    
    const duration = Date.now() - startTime;
    
    return {
      testName: 'ベクトルデータ確認',
      status: 'success',
      duration,
      details: {
        tableCount: tables.length,
        recordCount: rowCount,
        sampleRecords: sampleData
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: 'ベクトルデータ確認',
      status: 'error',
      duration,
      details: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 実際のクエリでのベクトル検索テスト
 */
async function testRealVectorSearch(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n=== 実際のクエリでのベクトル検索テスト ===');
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const testQueries = [
      '教室管理の詳細は',
      '教室コピー機能でコピー可能な項目は？',
      'オファー機能の種類と使い方は？'
    ];
    
    const results: any[] = [];
    
    for (const query of testQueries) {
      console.log(`\n--- クエリ: "${query}" ---`);
      
      try {
        // 実際の埋め込みベクトルを生成
        const vector = await getEmbeddings(query);
        console.log(`埋め込みベクトル生成完了: ${vector.length}次元`);
        
        // ベクトル検索を実行
        const searchResults = await tbl.search(vector).limit(10).toArray();
        
        console.log(`検索結果数: ${searchResults.length}件`);
        
        // 上位3件の結果を表示
        const topResults = searchResults.slice(0, 3).map((result, index) => ({
          rank: index + 1,
          title: result.title,
          distance: result._distance?.toFixed(4) || 'N/A',
          id: result.id
        }));
        
        topResults.forEach(result => {
          console.log(`${result.rank}. ${result.title}`);
          console.log(`   距離: ${result.distance}`);
          console.log(`   ID: ${result.id}`);
        });
        
        // 距離の統計
        const distances = searchResults.map(r => r._distance || 0);
        const minDistance = Math.min(...distances);
        const maxDistance = Math.max(...distances);
        const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        
        console.log(`距離統計: 最小=${minDistance.toFixed(4)}, 最大=${maxDistance.toFixed(4)}, 平均=${avgDistance.toFixed(4)}`);
        
        results.push({
          query,
          resultCount: searchResults.length,
          avgDistance,
          minDistance,
          maxDistance,
          topResults
        });
        
      } catch (error) {
        console.error(`クエリ "${query}" のエラー:`, error);
        throw error;
      }
    }
    
    const duration = Date.now() - startTime;
    
    return {
      testName: '実際のクエリでのベクトル検索',
      status: 'success',
      duration,
      details: {
        queries: results
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: '実際のクエリでのベクトル検索',
      status: 'error',
      duration,
      details: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 検索結果の関連性評価
 */
async function evaluateSearchRelevance(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n=== 検索結果の関連性評価 ===');
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
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
    
    const analyses: VectorSearchAnalysis[] = [];
    
    for (const testCase of testCases) {
      console.log(`\n--- ${testCase.description}: "${testCase.query}" ---`);
      
      try {
        // 実際の埋め込みベクトルを生成
        const vector = await getEmbeddings(testCase.query);
        
        // ベクトル検索を実行
        const results = await tbl.search(vector).limit(20).toArray();
        
        // 関連性の評価
        let relevantCount = 0;
        const topResults: any[] = [];
        
        results.forEach((result, index) => {
          const title = result.title || '';
          const content = result.content || '';
          const text = `${title} ${content}`.toLowerCase();
          
          // 期待されるキーワードが含まれているかチェック
          const hasRelevantKeyword = testCase.expectedKeywords.some(keyword => 
            text.includes(keyword.toLowerCase())
          );
          
          if (hasRelevantKeyword) {
            relevantCount++;
          }
          
          // 上位10件の結果を記録
          if (index < 10) {
            topResults.push({
              title: result.title,
              score: 0, // LanceDBの直接検索ではスコアは計算されない
              distance: result._distance || 0,
              isRelevant: hasRelevantKeyword
            });
          }
        });
        
        const precision = relevantCount / results.length;
        const recall = relevantCount / testCase.expectedKeywords.length; // 簡略化された再現率
        const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
        
        const distances = results.map(r => r._distance || 0);
        const averageDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
        
        console.log(`関連性評価結果:`);
        console.log(`- 総検索結果: ${results.length}件`);
        console.log(`- 関連結果: ${relevantCount}件`);
        console.log(`- 精度: ${(precision * 100).toFixed(1)}%`);
        console.log(`- 再現率: ${(recall * 100).toFixed(1)}%`);
        console.log(`- F1スコア: ${f1Score.toFixed(3)}`);
        console.log(`- 平均距離: ${averageDistance.toFixed(4)}`);
        
        analyses.push({
          query: testCase.query,
          totalResults: results.length,
          relevantResults: relevantCount,
          precision,
          recall,
          f1Score,
          averageDistance,
          averageScore: 0, // LanceDBの直接検索ではスコアは計算されない
          topResults
        });
        
      } catch (error) {
        console.error(`テストケース "${testCase.query}" のエラー:`, error);
        throw error;
      }
    }
    
    const duration = Date.now() - startTime;
    
    return {
      testName: '検索結果の関連性評価',
      status: 'success',
      duration,
      details: {
        analyses
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: '検索結果の関連性評価',
      status: 'error',
      duration,
      details: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * 統合検索クライアントのテスト
 */
async function testIntegratedSearchClient(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n=== 統合検索クライアントのテスト ===');
  
  try {
    const testQueries = [
      '教室管理の詳細は',
      '教室コピー機能でコピー可能な項目は？',
      'オファー機能の種類と使い方は？'
    ];
    
    const results: any[] = [];
    
    for (const query of testQueries) {
      console.log(`\n--- 統合検索: "${query}" ---`);
      
      try {
        // 統合検索クライアントを使用
        const searchResults = await searchLanceDB({
          query,
          topK: 10,
          useLunrIndex: false, // ベクトル検索のみを使用
          labelFilters: {
            includeMeetingNotes: false,
            includeArchived: false,
            includeFolders: false
          }
        });
        
        console.log(`統合検索結果数: ${searchResults.length}件`);
        
        // 上位3件の結果を表示
        const topResults = searchResults.slice(0, 3).map((result, index) => ({
          rank: index + 1,
          title: result.title,
          score: result.score?.toFixed(2) || 'N/A',
          distance: result.distance?.toFixed(4) || 'N/A',
          labels: result.labels?.join(', ') || 'なし'
        }));
        
        topResults.forEach(result => {
          console.log(`${result.rank}. ${result.title}`);
          console.log(`   スコア: ${result.score}`);
          console.log(`   距離: ${result.distance}`);
          console.log(`   ラベル: ${result.labels}`);
        });
        
        // スコアの統計
        const scores = searchResults.map(r => r.score || 0);
        const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        
        console.log(`スコア統計: 最小=${minScore.toFixed(2)}, 最大=${maxScore.toFixed(2)}, 平均=${avgScore.toFixed(2)}`);
        
        results.push({
          query,
          resultCount: searchResults.length,
          avgScore,
          minScore,
          maxScore,
          topResults
        });
        
      } catch (error) {
        console.error(`統合検索 "${query}" のエラー:`, error);
        throw error;
      }
    }
    
    const duration = Date.now() - startTime;
    
    return {
      testName: '統合検索クライアントのテスト',
      status: 'success',
      duration,
      details: {
        queries: results
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: '統合検索クライアントのテスト',
      status: 'error',
      duration,
      details: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * パフォーマンステスト
 */
async function testPerformance(): Promise<TestResult> {
  const startTime = Date.now();
  console.log('\n=== パフォーマンステスト ===');
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tbl = await db.openTable('confluence');
    
    const testQuery = '教室管理の詳細は';
    console.log(`テストクエリ: "${testQuery}"`);
    
    // 実際の埋め込みベクトルを生成
    const vector = await getEmbeddings(testQuery);
    
    // 複数回の検索を実行してパフォーマンスを測定
    const iterations = 10;
    const durations: number[] = [];
    
    console.log(`${iterations}回の検索を実行中...`);
    
    for (let i = 0; i < iterations; i++) {
      const searchStart = Date.now();
      await tbl.search(vector).limit(10).toArray();
      const searchDuration = Date.now() - searchStart;
      durations.push(searchDuration);
      
      if ((i + 1) % 5 === 0) {
        console.log(`${i + 1}/${iterations} 完了`);
      }
    }
    
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);
    
    // 標準偏差を計算
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    
    console.log(`\nパフォーマンス結果:`);
    console.log(`- 平均検索時間: ${avgDuration.toFixed(2)}ms`);
    console.log(`- 最小検索時間: ${minDuration}ms`);
    console.log(`- 最大検索時間: ${maxDuration}ms`);
    console.log(`- 標準偏差: ${stdDev.toFixed(2)}ms`);
    
    const duration = Date.now() - startTime;
    
    return {
      testName: 'パフォーマンステスト',
      status: 'success',
      duration,
      details: {
        iterations,
        avgDuration,
        minDuration,
        maxDuration,
        stdDev,
        allDurations: durations
      }
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      testName: 'パフォーマンステスト',
      status: 'error',
      duration,
      details: {},
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * メインテスト実行関数
 */
async function runRealVectorTests(): Promise<void> {
  console.log('🔍 実際のベクトルファイルを使ったベクトル検索テスト開始');
  console.log('='.repeat(80));
  console.log(`テスト実行時刻: ${new Date().toISOString()}`);
  
  const testResults: TestResult[] = [];
  
  try {
    // 1. ベクトルデータの確認
    const dataVerification = await verifyVectorData();
    testResults.push(dataVerification);
    
    if (dataVerification.status === 'error') {
      console.error('❌ ベクトルデータの確認に失敗しました。テストを中断します。');
      return;
    }
    
    // 2. 実際のクエリでのベクトル検索テスト
    const vectorSearchTest = await testRealVectorSearch();
    testResults.push(vectorSearchTest);
    
    // 3. 検索結果の関連性評価
    const relevanceEvaluation = await evaluateSearchRelevance();
    testResults.push(relevanceEvaluation);
    
    // 4. 統合検索クライアントのテスト
    const integratedSearchTest = await testIntegratedSearchClient();
    testResults.push(integratedSearchTest);
    
    // 5. パフォーマンステスト
    const performanceTest = await testPerformance();
    testResults.push(performanceTest);
    
    // 結果サマリーを表示
    console.log('\n' + '='.repeat(80));
    console.log('📊 テスト結果サマリー');
    console.log('='.repeat(80));
    
    const successCount = testResults.filter(t => t.status === 'success').length;
    const errorCount = testResults.filter(t => t.status === 'error').length;
    const totalDuration = testResults.reduce((sum, t) => sum + t.duration, 0);
    
    console.log(`総テスト数: ${testResults.length}`);
    console.log(`成功: ${successCount}件`);
    console.log(`失敗: ${errorCount}件`);
    console.log(`成功率: ${((successCount / testResults.length) * 100).toFixed(1)}%`);
    console.log(`総実行時間: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}秒)`);
    
    console.log(`\n各テストの結果:`);
    testResults.forEach(test => {
      const status = test.status === 'success' ? '✅' : '❌';
      const duration = (test.duration / 1000).toFixed(1);
      console.log(`  ${status} ${test.testName}: ${duration}秒`);
      if (test.error) {
        console.log(`    エラー: ${test.error}`);
      }
    });
    
    // 全体ステータス
    if (errorCount === 0) {
      console.log(`\n🎉 すべてのテストが成功しました！`);
    } else if (successCount > 0) {
      console.log(`\n⚠️ 一部のテストが失敗しました`);
    } else {
      console.log(`\n❌ すべてのテストが失敗しました`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 実際のベクトルファイルを使ったベクトル検索テスト完了');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runRealVectorTests();
}

export { runRealVectorTests };
