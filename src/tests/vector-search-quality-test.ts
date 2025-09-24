/**
 * ベクトル検索の質を確認するテストスクリプト
 * 
 * このテストは以下の項目を評価します：
 * 1. ベクトル検索の精度（Precision）
 * 2. ベクトル検索の再現率（Recall）
 * 3. F1スコア
 * 4. ベクトル距離とスコアの関係
 * 5. 複数クエリでの一貫性
 * 6. 検索結果の関連性
 */

import 'dotenv/config';
import { getEmbeddings } from '../lib/embeddings';
import { searchLanceDB } from '../lib/lancedb-search-client';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

// テスト用のクエリと期待される結果
interface TestQuery {
  query: string;
  expectedPages: string[];
  excludedPages: string[];
  minScore: number;
  description: string;
}

const TEST_QUERIES: TestQuery[] = [
  {
    query: '教室管理の詳細は',
    expectedPages: [
      '160_【FIX】教室管理機能',
      '161_【FIX】教室一覧閲覧機能',
      '162_【FIX】教室新規登録機能',
      '163_【FIX】教室情報編集機能',
      '168_【FIX】教室コピー機能',
      '169-1_【FIX】教室掲載フラグ切り替え機能',
      '169-2_【FIX】教室公開フラグ切り替え機能',
      '164_【FIX】教室削除機能'
    ],
    excludedPages: [
      '500_■教室管理機能',
      '510_■教室管理-求人管理機能',
      '010_■求人・教室管理機能',
      '塾講師ステーションドキュメントスペース',
      '710_■教室・求人情報関連バッチ',
      '910_■企業・教室グループ・教室'
    ],
    minScore: 60,
    description: '教室管理機能の詳細仕様に関する検索'
  },
  {
    query: '教室コピー機能でコピー可能な項目は？',
    expectedPages: [
      '168_【FIX】教室コピー機能',
      '教室コピー可能項目一覧',
      '教室コピー処理仕様',
      '【FIX】教室：基本情報／所在地',
      '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号',
      '【FIX】教室：塾チャート',
      '【FIX】教室：ロゴ・スライド画像'
    ],
    excludedPages: [
      '■教室管理機能',
      '■コピー機能',
      '■教室情報管理',
      '教室統計データ',
      '教室作成ログ',
      '【作成中】教室削除機能'
    ],
    minScore: 70,
    description: '教室コピー機能のコピー可能項目に関する検索'
  },
  {
    query: 'オファー機能の種類と使い方は？',
    expectedPages: [
      'オファー機能概要',
      'スカウトオファー機能',
      'マッチオファー機能',
      '共通オファー機能',
      'オファー通知機能',
      'オファー管理機能'
    ],
    excludedPages: [
      '■オファー機能',
      'オファー統計データ',
      'オファーログ',
      '【作成中】オファー機能'
    ],
    minScore: 65,
    description: 'オファー機能の種類と使用方法に関する検索'
  }
];

interface VectorSearchResult {
  title: string;
  score: number;
  distance?: number;
  labels: string[];
  content: string;
  source: string;
}

interface TestResult {
  query: string;
  totalResults: number;
  expectedFound: number;
  excludedFound: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageScore: number;
  averageDistance: number;
  topResults: VectorSearchResult[];
  issues: string[];
}

/**
 * ベクトル検索の質をテストする
 */
async function testVectorSearchQuality(query: TestQuery): Promise<TestResult> {
  console.log(`\n=== ベクトル検索品質テスト: "${query.query}" ===`);
  console.log(`説明: ${query.description}`);
  
  try {
    // ベクトル検索を実行
    const searchResults = await searchLanceDB({
      query: query.query,
      topK: 20,
      useLunrIndex: false, // ベクトル検索のみを使用
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });
    
    console.log(`検索結果数: ${searchResults.length}件`);
    
    // 期待されるページの含有状況をチェック
    const foundExpectedPages = searchResults.filter(result => 
      query.expectedPages.some(expected => 
        result.title.includes(expected) || expected.includes(result.title)
      )
    );
    
    const foundExcludedPages = searchResults.filter(result => 
      query.excludedPages.some(excluded => 
        result.title.includes(excluded) || excluded.includes(result.title)
      )
    );
    
    console.log(`期待されるページ: ${foundExpectedPages.length}/${query.expectedPages.length}件`);
    console.log(`除外されるべきページ: ${foundExcludedPages.length}件`);
    
    // 品質メトリクスを計算
    const precision = searchResults.length > 0 ? foundExpectedPages.length / searchResults.length : 0;
    const recall = query.expectedPages.length > 0 ? foundExpectedPages.length / query.expectedPages.length : 0;
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    const averageScore = searchResults.length > 0 ? 
      searchResults.reduce((sum, r) => sum + (r.score || 0), 0) / searchResults.length : 0;
    const averageDistance = searchResults.length > 0 ? 
      searchResults.reduce((sum, r) => sum + (r.distance || 0), 0) / searchResults.length : 0;
    
    console.log(`\n--- 品質メトリクス ---`);
    console.log(`精度 (Precision): ${precision.toFixed(3)}`);
    console.log(`再現率 (Recall): ${recall.toFixed(3)}`);
    console.log(`F1スコア: ${f1Score.toFixed(3)}`);
    console.log(`平均スコア: ${averageScore.toFixed(2)}`);
    console.log(`平均距離: ${averageDistance.toFixed(4)}`);
    
    // 問題点を特定
    const issues: string[] = [];
    if (precision < 0.8) {
      issues.push(`精度が低い: ${precision.toFixed(3)} < 0.8`);
    }
    if (recall < 0.7) {
      issues.push(`再現率が低い: ${recall.toFixed(3)} < 0.7`);
    }
    if (f1Score < 0.75) {
      issues.push(`F1スコアが低い: ${f1Score.toFixed(3)} < 0.75`);
    }
    if (averageScore < query.minScore) {
      issues.push(`平均スコアが低い: ${averageScore.toFixed(2)} < ${query.minScore}`);
    }
    if (foundExcludedPages.length > 0) {
      issues.push(`除外されるべきページが含まれている: ${foundExcludedPages.length}件`);
    }
    
    // 上位結果を表示
    console.log(`\n--- 上位10件の検索結果 ---`);
    const topResults = searchResults.slice(0, 10).map(result => ({
      title: result.title,
      score: result.score || 0,
      distance: result.distance,
      labels: result.labels || [],
      content: result.content?.substring(0, 100) + '...' || '',
      source: result.source || 'unknown'
    }));
    
    topResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   スコア: ${result.score.toFixed(2)}`);
      console.log(`   距離: ${result.distance?.toFixed(4) || 'N/A'}`);
      console.log(`   ラベル: ${result.labels.join(', ')}`);
      console.log(`   ソース: ${result.source}`);
      console.log('');
    });
    
    return {
      query: query.query,
      totalResults: searchResults.length,
      expectedFound: foundExpectedPages.length,
      excludedFound: foundExcludedPages.length,
      precision,
      recall,
      f1Score,
      averageScore,
      averageDistance,
      topResults,
      issues
    };
    
  } catch (error) {
    console.error(`テスト実行エラー: ${error}`);
    return {
      query: query.query,
      totalResults: 0,
      expectedFound: 0,
      excludedFound: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      averageScore: 0,
      averageDistance: 0,
      topResults: [],
      issues: [`テスト実行エラー: ${error}`]
    };
  }
}

/**
 * ベクトル距離とスコアの関係を分析する
 */
async function analyzeVectorDistanceScoreRelationship(): Promise<void> {
  console.log('\n=== ベクトル距離とスコアの関係分析 ===');
  
  try {
    // LanceDBに直接接続してベクトル距離を取得
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    const testQuery = '教室管理の詳細は';
    const vector = await getEmbeddings(testQuery);
    
    // ベクトル検索を実行して距離を取得
    const vectorResults = await tbl.search(vector).limit(20).toArray();
    
    console.log(`テストクエリ: "${testQuery}"`);
    console.log(`ベクトル検索結果数: ${vectorResults.length}件`);
    
    // 距離とスコアの関係を分析
    console.log('\n--- 距離とスコアの関係 ---');
    vectorResults.forEach((result, index) => {
      const distance = result._distance || 0;
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   距離: ${distance.toFixed(4)}`);
      console.log(`   距離の解釈: ${distance < 0.3 ? '高類似' : distance < 0.6 ? '中類似' : '低類似'}`);
      console.log('');
    });
    
    // 距離の統計
    const distances = vectorResults.map(r => r._distance || 0);
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    const avgDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    console.log('--- 距離統計 ---');
    console.log(`最小距離: ${minDistance.toFixed(4)}`);
    console.log(`最大距離: ${maxDistance.toFixed(4)}`);
    console.log(`平均距離: ${avgDistance.toFixed(4)}`);
    
  } catch (error) {
    console.error(`距離分析エラー: ${error}`);
  }
}

/**
 * 複数クエリでの一貫性をテストする
 */
async function testConsistencyAcrossQueries(): Promise<void> {
  console.log('\n=== 複数クエリでの一貫性テスト ===');
  
  const results: TestResult[] = [];
  
  for (const query of TEST_QUERIES) {
    const result = await testVectorSearchQuality(query);
    results.push(result);
  }
  
  // 一貫性の分析
  console.log('\n--- 一貫性分析 ---');
  const avgPrecision = results.reduce((sum, r) => sum + r.precision, 0) / results.length;
  const avgRecall = results.reduce((sum, r) => sum + r.recall, 0) / results.length;
  const avgF1Score = results.reduce((sum, r) => sum + r.f1Score, 0) / results.length;
  const avgScore = results.reduce((sum, r) => sum + r.averageScore, 0) / results.length;
  
  console.log(`平均精度: ${avgPrecision.toFixed(3)}`);
  console.log(`平均再現率: ${avgRecall.toFixed(3)}`);
  console.log(`平均F1スコア: ${avgF1Score.toFixed(3)}`);
  console.log(`平均スコア: ${avgScore.toFixed(2)}`);
  
  // 一貫性の評価
  const precisionVariance = results.reduce((sum, r) => sum + Math.pow(r.precision - avgPrecision, 2), 0) / results.length;
  const recallVariance = results.reduce((sum, r) => sum + Math.pow(r.recall - avgRecall, 2), 0) / results.length;
  
  console.log(`精度の分散: ${precisionVariance.toFixed(6)}`);
  console.log(`再現率の分散: ${recallVariance.toFixed(6)}`);
  
  const consistencyScore = 1 - (precisionVariance + recallVariance) / 2;
  console.log(`一貫性スコア: ${consistencyScore.toFixed(3)}`);
  
  if (consistencyScore > 0.8) {
    console.log('✅ 一貫性: 良好');
  } else if (consistencyScore > 0.6) {
    console.log('⚠️ 一貫性: 普通');
  } else {
    console.log('❌ 一貫性: 低い');
  }
}

/**
 * テスト結果のレポートを生成する
 */
function generateTestReport(results: TestResult[]): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 ベクトル検索品質テスト レポート');
  console.log('='.repeat(60));
  
  // 全体の統計
  const totalTests = results.length;
  const passedTests = results.filter(r => r.issues.length === 0).length;
  const failedTests = totalTests - passedTests;
  
  console.log(`\n📈 テスト結果サマリー`);
  console.log(`総テスト数: ${totalTests}`);
  console.log(`合格: ${passedTests}件`);
  console.log(`不合格: ${failedTests}件`);
  console.log(`合格率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  
  // 各テストの詳細結果
  console.log(`\n📋 各テストの詳細結果`);
  results.forEach((result, index) => {
    console.log(`\n${index + 1}. "${result.query}"`);
    console.log(`   精度: ${result.precision.toFixed(3)}`);
    console.log(`   再現率: ${result.recall.toFixed(3)}`);
    console.log(`   F1スコア: ${result.f1Score.toFixed(3)}`);
    console.log(`   平均スコア: ${result.averageScore.toFixed(2)}`);
    console.log(`   期待ページ: ${result.expectedFound}/${TEST_QUERIES[index].expectedPages.length}`);
    console.log(`   除外ページ: ${result.excludedFound}`);
    
    if (result.issues.length > 0) {
      console.log(`   ❌ 問題点:`);
      result.issues.forEach(issue => console.log(`      - ${issue}`));
    } else {
      console.log(`   ✅ 問題なし`);
    }
  });
  
  // 推奨改善点
  console.log(`\n🔧 推奨改善点`);
  const allIssues = results.flatMap(r => r.issues);
  const issueCounts = allIssues.reduce((acc, issue) => {
    acc[issue] = (acc[issue] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const sortedIssues = Object.entries(issueCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);
  
  sortedIssues.forEach(([issue, count]) => {
    console.log(`   - ${issue} (${count}回)`);
  });
  
  console.log('\n' + '='.repeat(60));
}

/**
 * メインテスト実行関数
 */
async function runVectorSearchQualityTest(): Promise<void> {
  console.log('🚀 ベクトル検索品質テスト開始');
  console.log('='.repeat(50));
  console.log(`テスト実行時刻: ${new Date().toISOString()}`);
  
  try {
    // 1. 各クエリでのベクトル検索品質テスト
    const results: TestResult[] = [];
    for (const query of TEST_QUERIES) {
      const result = await testVectorSearchQuality(query);
      results.push(result);
    }
    
    // 2. ベクトル距離とスコアの関係分析
    await analyzeVectorDistanceScoreRelationship();
    
    // 3. 複数クエリでの一貫性テスト
    await testConsistencyAcrossQueries();
    
    // 4. テスト結果レポートの生成
    generateTestReport(results);
    
    console.log('\n' + '='.repeat(50));
    console.log('✅ ベクトル検索品質テスト完了');
    
  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runVectorSearchQualityTest();
}

export { runVectorSearchQualityTest, testVectorSearchQuality, analyzeVectorDistanceScoreRelationship };
