/**
 * 教室管理検索品質テスト
 * テスト仕様書: docs/case_classroom-management-search-quality-test.md
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from './test-helpers/env-loader';
loadTestEnv();

import { performance } from 'perf_hooks';

// 理想の抽出ページ（優先度：高）
const HIGH_PRIORITY_PAGES = [
    '160_【FIX】教室管理機能',
    '161_【FIX】教室一覧閲覧機能',
    '162_【FIX】教室新規登録機能',
    '163_【FIX】教室情報編集機能',
    '168_【FIX】教室コピー機能',
    '169-1_【FIX】教室掲載フラグ切り替え機能',
    '169-2_【FIX】教室公開フラグ切り替え機能',
    '164_【FIX】教室削除機能'
];

// 関連する求人管理ページ（優先度：中）
const MEDIUM_PRIORITY_PAGES = [
    '511_【FIX】教室管理-求人一覧閲覧機能',
    '512_【FIX】教室管理-求人情報新規登録機能',
    '513_【FIX】教室管理-求人情報編集機能',
    '514_【レビュー中】教室管理-求人削除機能',
    '515_【作成中】教室管理-教室コピー機能',
    '516_【FIX】教室管理-一括更新機能'
];

// 関連する基本情報ページ（優先度：中）
const BASIC_INFO_PAGES = [
    '【FIX】教室：基本情報／所在地',
    '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号',
    '【FIX】教室：塾チャート',
    '【FIX】教室：ロゴ・スライド画像'
];

// 除外されるべきページ
const EXCLUDED_PAGES = [
  '500_■教室管理機能',
  '510_■教室管理-求人管理機能',
  '010_■求人・教室管理機能',
  '塾講師ステーションドキュメントスペース',
  '710_■教室・求人情報関連バッチ',
  '910_■企業・教室グループ・教室',
  'レコメンドデータ',
  '教室アクセスデータ',
  '【作成中】塾チャート'
];

interface PerformanceMetrics {
  searchTime: number;
  aiGenerationTime: number;
  totalTime: number;
  cacheHit: boolean;
  initializationTime?: number;
  embeddingTime?: number;
  keywordExtractionTime?: number;
}

interface TestResult {
  query: string;
  totalResults: number;
  highPriorityFound: number;
  mediumPriorityFound: number;
  basicInfoFound: number;
  excludedFound: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageScore: number;
  top3Scores: number[];
  results: Array<{
    title: string;
    score: number;
    labels: string[];
    source: string;
  }>;
  aiPrompt?: string;
  aiResponse?: string;
  aiReferences?: Array<{
    title: string;
    url: string;
    spaceName?: string;
    lastUpdated?: string;
    distance?: number;
    source?: string;
    scoreText?: string;
  }>;
  performance?: PerformanceMetrics;
}

/**
 * ページタイトルが期待されるページに含まれるかチェック
 */
function isExpectedPage(title: string): { priority: string; found: boolean } {
  if (HIGH_PRIORITY_PAGES.some(page => title.includes(page))) {
    return { priority: 'high', found: true };
  }
  if (MEDIUM_PRIORITY_PAGES.some(page => title.includes(page))) {
    return { priority: 'medium', found: true };
  }
  if (BASIC_INFO_PAGES.some(page => title.includes(page))) {
    return { priority: 'basic', found: true };
  }
  if (EXCLUDED_PAGES.some(page => title.includes(page))) {
    return { priority: 'excluded', found: true };
  }
  return { priority: 'other', found: false };
}

/**
 * 品質メトリクスを計算
 */
function calculateMetrics(results: any[]): TestResult {
  const totalResults = results.length;
  let highPriorityFound = 0;
  let mediumPriorityFound = 0;
  let basicInfoFound = 0;
  let excludedFound = 0;
  
  const top3Scores = results.slice(0, 3).map(r => r.score);
  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalResults;
  
  // 各ページの分類
  results.forEach(result => {
    const { priority } = isExpectedPage(result.title);
    switch (priority) {
      case 'high':
        highPriorityFound++;
        break;
      case 'medium':
        mediumPriorityFound++;
        break;
      case 'basic':
        basicInfoFound++;
        break;
      case 'excluded':
        excludedFound++;
        break;
    }
  });
  
  // 関連ページ数（除外ページを除く）
  const relevantPages = highPriorityFound + mediumPriorityFound + basicInfoFound;
  
  // Precision = 関連するページ数 / 検索結果総数
  const precision = relevantPages / totalResults;
  
  // Recall = 検索結果に含まれる関連ページ数 / 理想の関連ページ総数
  const totalExpectedPages = HIGH_PRIORITY_PAGES.length + MEDIUM_PRIORITY_PAGES.length + BASIC_INFO_PAGES.length;
  const recall = relevantPages / totalExpectedPages;
  
  // F1スコア
  const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
  
  return {
    query: '教室管理の詳細は',
    totalResults,
    highPriorityFound,
    mediumPriorityFound,
    basicInfoFound,
    excludedFound,
    precision,
    recall,
    f1Score,
    averageScore,
    top3Scores,
    results: results.map(r => ({
      title: r.title,
      score: r.score,
      labels: r.labels || [],
      source: r.source || 'unknown'
    }))
  };
}

/**
 * テストケース1: 基本検索テスト（パフォーマンス測定付き）
 */
async function testBasicSearch(): Promise<TestResult> {
  console.log('🔍 テストケース1: 基本検索テスト（パフォーマンス測定付き）');
  console.log('クエリ: 教室管理の詳細は');
  
  try {
    // 動的インポートを使用（loadTestEnv()実行後にインポート）
    const { searchLanceDB } = await import('../lib/lancedb-search-client.js');
    
    const searchStartTime = performance.now();
    
    const results = await searchLanceDB({
      query: '教室管理の詳細は',
      topK: 20,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    
    const searchEndTime = performance.now();
    const searchTime = searchEndTime - searchStartTime;
    
    console.log(`📊 検索結果: ${results.length}件`);
    console.log(`⏱️  検索時間: ${searchTime.toFixed(2)}ms`);
    
    const testResult = calculateMetrics(results);
    
    // パフォーマンス情報を追加
    testResult.performance = {
      searchTime,
      aiGenerationTime: 0, // 基本検索ではAI生成は行わない
      totalTime: searchTime,
      cacheHit: false // キャッシュヒット情報は後で実装
    };
    
    // 結果表示
    console.log('\n📋 検索結果詳細:');
    results.forEach((result, index) => {
      const { priority } = isExpectedPage(result.title);
      const priorityIcon = priority === 'high' ? '🔥' : 
                         priority === 'medium' ? '⭐' : 
                         priority === 'basic' ? '📄' : 
                         priority === 'excluded' ? '❌' : '❓';
      
      console.log(`${index + 1}. ${priorityIcon} ${result.title}`);
      console.log(`   スコア: ${result.scoreText || result.score}, ラベル: ${JSON.stringify(result.labels)}, ソース: ${result.source}`);
    });
    
    return testResult;
  } catch (error) {
    console.error('❌ 検索エラー:', error);
    throw error;
  }
}

/**
 * テストケース4: AI回答生成テスト（パフォーマンス測定付き）
 */
async function testAIResponse(): Promise<{ prompt: string; response: string; references: any[]; performance: PerformanceMetrics }> {
  console.log('\n🤖 テストケース4: AI回答生成テスト（パフォーマンス測定付き）');
  console.log('クエリ: 教室管理の詳細は');
  
  try {
    // 動的インポートを使用（loadTestEnv()実行後にインポート）
    const { hybridSearchEngine } = await import('../lib/hybrid-search-engine.js');
    const { streamingSummarizeConfluenceDocsBackend } = await import('../ai/flows/streaming-summarize-confluence-docs.js');
    
    const totalStartTime = performance.now();
    const searchStartTime = performance.now();
    
    // 検索結果を取得（ハイブリッド検索エンジンを使用）
    const hybridResults = await hybridSearchEngine.search({
      query: '教室管理の詳細は',
      topK: 10,
      tableName: 'confluence',
      useLunrIndex: true,
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    
    const searchEndTime = performance.now();
    const searchTime = searchEndTime - searchStartTime;
    
    // ハイブリッド検索結果をLanceDB形式に変換
    const searchResults = hybridResults.map(result => ({
      id: `${result.pageId}-0`,
      title: result.title,
      content: result.content,
      distance: result.scoreRaw,
      space_key: '',
      labels: result.labels,
      url: result.url,
      lastUpdated: null,
      source: result.source,
      scoreKind: result.scoreKind,
      scoreText: result.scoreText
    }));
    
    // 検索結果をAI用の形式に変換
    const documents = searchResults.map(result => ({
      content: result.content || '',
      title: result.title,
      url: result.url || '',
      spaceName: result.spaceName || 'Unknown',
      lastUpdated: result.lastUpdated || null,
      labels: result.labels || [],
      // スコア情報を追加
      scoreText: result.scoreText,
      source: result.source,
      distance: result.distance
    }));
    
    console.log(`📄 AIに送信するドキュメント数: ${documents.length}件`);
    console.log(`⏱️  検索時間: ${searchTime.toFixed(2)}ms`);
    
    const aiStartTime = performance.now();
    
    // AI回答生成
    const aiResult = await streamingSummarizeConfluenceDocsBackend({
      question: '教室管理の詳細は',
      context: documents,
      chatHistory: []
    });
    
    const aiEndTime = performance.now();
    const aiGenerationTime = aiEndTime - aiStartTime;
    
    const totalEndTime = performance.now();
    const totalTime = totalEndTime - totalStartTime;
    
    console.log(`⏱️  AI生成時間: ${aiGenerationTime.toFixed(2)}ms`);
    console.log(`⏱️  総時間: ${totalTime.toFixed(2)}ms`);
    
    console.log('\n🤖 AI回答:');
    console.log(aiResult.answer);
    
    console.log('\n📚 AI参照元:');
    aiResult.references.forEach((ref, index) => {
      console.log(`${index + 1}. ${ref.title}`);
      console.log(`   URL: ${ref.url || 'N/A'}`);
      console.log(`   スコア: ${ref.scoreText || 'N/A'}`);
      console.log(`   ソース: ${ref.source || 'unknown'}`);
    });
    
    return {
      prompt: '', // streamingSummarizeConfluenceDocsBackendはpromptを返さない
      response: aiResult.answer,
      references: aiResult.references,
      performance: {
        searchTime,
        aiGenerationTime,
        totalTime,
        cacheHit: false
      }
    };
    
  } catch (error) {
    console.error('❌ AI回答生成エラー:', error);
    throw error;
  }
}

/**
 * テストケース2: キーワードマッチングテスト
 */
async function testKeywordMatching(): Promise<void> {
  console.log('\n🔍 テストケース2: キーワードマッチングテスト');
  
  // キーワード抽出のテスト（実際の実装に依存）
  console.log('期待されるキーワード抽出:');
  console.log('- 基本キーワード: ["教室", "管理"]');
  console.log('- 分割キーワード: ["教室管理", "詳細な仕様"]');
  console.log('- LLM拡張キーワード: 教室管理に関連する同義語');
  
  console.log('\n理想のキーワード抽出結果:');
  console.log(JSON.stringify({
    keywords: [
      "教室管理", "教室", "教室一覧", "教室登録", 
      "教室編集", "教室削除", "教室コピー", "教室管理の詳細"
    ],
    highPriority: ["教室管理", "教室"],
    lowPriority: ["教室一覧", "教室登録", "教室編集", "教室削除", "教室コピー", "教室管理の詳細"]
  }, null, 2));
}

/**
 * テストケース3: スコアリングテスト
 */
function testScoring(testResult: TestResult): void {
  console.log('\n🔍 テストケース3: スコアリングテスト');
  
  console.log('期待されるスコア分布:');
  console.log('- 主要な教室管理機能ページ: 70-90点');
  console.log('- 関連する求人管理ページ: 50-70点');
  console.log('- 関連する基本情報ページ: 40-60点');
  
  console.log('\n実際のスコア分布:');
  console.log(`- 平均スコア: ${testResult.averageScore.toFixed(2)}`);
  console.log(`- 上位3件のスコア: ${testResult.top3Scores.map(s => s.toFixed(2)).join(', ')}`);
  
  // スコアリングの評価
  const highScoreResults = testResult.results.filter(r => {
    const { priority } = isExpectedPage(r.title);
    return priority === 'high' && r.score >= 70;
  });
  
  console.log(`- 高スコア(70+)の主要ページ: ${highScoreResults.length}件`);
}

/**
 * パフォーマンス評価
 */
function evaluatePerformance(testResult: TestResult): void {
  console.log('\n⚡ パフォーマンス評価結果:');
  
  if (!testResult.performance) {
    console.log('⚠️ パフォーマンス情報が取得できませんでした');
    return;
  }
  
  const perf = testResult.performance;
  
  // パフォーマンス基準のチェック
  const performanceCriteria = {
    searchTime: perf.searchTime <= 5000, // 5秒以内
    aiGenerationTime: perf.aiGenerationTime <= 10000, // 10秒以内
    totalTime: perf.totalTime <= 15000, // 15秒以内
    searchTimeExcellent: perf.searchTime <= 2000, // 2秒以内（優秀）
    aiGenerationTimeExcellent: perf.aiGenerationTime <= 5000, // 5秒以内（優秀）
    totalTimeExcellent: perf.totalTime <= 7000 // 7秒以内（優秀）
  };
  
  console.log('パフォーマンス基準チェック:');
  console.log(`⚡ 検索時間 (目標: 5秒以内): ${perf.searchTime.toFixed(2)}ms ${performanceCriteria.searchTime ? '✅' : '❌'}`);
  console.log(`⚡ AI生成時間 (目標: 10秒以内): ${perf.aiGenerationTime.toFixed(2)}ms ${performanceCriteria.aiGenerationTime ? '✅' : '❌'}`);
  console.log(`⚡ 総時間 (目標: 15秒以内): ${perf.totalTime.toFixed(2)}ms ${performanceCriteria.totalTime ? '✅' : '❌'}`);
  
  console.log('\n優秀基準チェック:');
  console.log(`🔥 検索時間 (優秀: 2秒以内): ${perf.searchTime.toFixed(2)}ms ${performanceCriteria.searchTimeExcellent ? '🔥' : '⚡'}`);
  console.log(`🔥 AI生成時間 (優秀: 5秒以内): ${perf.aiGenerationTime.toFixed(2)}ms ${performanceCriteria.aiGenerationTimeExcellent ? '🔥' : '⚡'}`);
  console.log(`🔥 総時間 (優秀: 7秒以内): ${perf.totalTime.toFixed(2)}ms ${performanceCriteria.totalTimeExcellent ? '🔥' : '⚡'}`);
  
  // パフォーマンスレベルの判定
  const excellentCount = Object.values({
    searchTimeExcellent: performanceCriteria.searchTimeExcellent,
    aiGenerationTimeExcellent: performanceCriteria.aiGenerationTimeExcellent,
    totalTimeExcellent: performanceCriteria.totalTimeExcellent
  }).filter(Boolean).length;
  
  const passedCount = Object.values({
    searchTime: performanceCriteria.searchTime,
    aiGenerationTime: performanceCriteria.aiGenerationTime,
    totalTime: performanceCriteria.totalTime
  }).filter(Boolean).length;
  
  console.log(`\n🎯 パフォーマンスレベル: ${excellentCount}/3 優秀基準をクリア`);
  
  if (excellentCount === 3) {
    console.log('🚀 すべてのパフォーマンス基準で優秀レベルを達成しました！');
  } else if (passedCount === 3) {
    console.log('✅ すべてのパフォーマンス基準をクリアしました');
  } else {
    console.log('⚠️ 一部のパフォーマンス基準をクリアできませんでした。最適化が必要です。');
  }
  
  // パフォーマンス改善提案
  if (perf.searchTime > 3000) {
    console.log('\n💡 検索時間改善提案:');
    console.log('- 埋め込みベクトルキャッシュの実装');
    console.log('- キーワード抽出キャッシュの実装');
    console.log('- LanceDB接続の最適化');
  }
  
  if (perf.aiGenerationTime > 7000) {
    console.log('\n💡 AI生成時間改善提案:');
    console.log('- プロンプトの最適化');
    console.log('- コンテキスト長の調整');
    console.log('- AI APIの最適化');
  }
}

/**
 * 品質評価
 */
function evaluateQuality(testResult: TestResult): void {
  console.log('\n📊 品質評価結果:');
  
  // 合格基準のチェック（指定された値に調整）
  const criteria = {
    precision: testResult.precision >= 0.52,
    recall: testResult.recall >= 0.61,
    f1Score: testResult.f1Score >= 0.57,
    averageScore: testResult.averageScore >= 49,
    highPriorityFound: testResult.highPriorityFound >= 3,
    noExcludedPages: testResult.excludedFound <= 0,
    top3Scores: testResult.top3Scores.every(score => score >= 49)
  };
  
  console.log('合格基準チェック:');
  console.log(`✅ Precision (目標: 0.52+): ${testResult.precision.toFixed(3)} ${criteria.precision ? '✅' : '❌'}`);
  console.log(`✅ Recall (目標: 0.61+): ${testResult.recall.toFixed(3)} ${criteria.recall ? '✅' : '❌'}`);
  console.log(`✅ F1スコア (目標: 0.57+): ${testResult.f1Score.toFixed(3)} ${criteria.f1Score ? '✅' : '❌'}`);
  console.log(`✅ 平均スコア (目標: 49+): ${testResult.averageScore.toFixed(2)} ${criteria.averageScore ? '✅' : '❌'}`);
  console.log(`✅ 主要ページ検出 (目標: 3件+): ${testResult.highPriorityFound}件 ${criteria.highPriorityFound ? '✅' : '❌'}`);
  console.log(`✅ 除外ページ除外 (目標: 0件): ${testResult.excludedFound}件 ${criteria.noExcludedPages ? '✅' : '❌'}`);
  console.log(`✅ 上位3件スコア (目標: 49+): ${criteria.top3Scores ? '✅' : '❌'}`);
  
  const passedCriteria = Object.values(criteria).filter(Boolean).length;
  const totalCriteria = Object.keys(criteria).length;
  
  console.log(`\n🎯 総合評価: ${passedCriteria}/${totalCriteria} 基準をクリア`);
  
  if (passedCriteria === totalCriteria) {
    console.log('🎉 すべての品質基準をクリアしました！');
  } else {
    console.log('⚠️ 一部の品質基準をクリアできませんでした。改善が必要です。');
  }
}

/**
 * パフォーマンス比較テスト
 */
async function testPerformanceComparison(): Promise<void> {
  console.log('\n⚡ パフォーマンス比較テスト');
  console.log('複数回の検索実行によるパフォーマンス測定');
  
  // 動的インポートを使用（loadTestEnv()実行後にインポート）
  const { searchLanceDB } = await import('../lib/lancedb-search-client.js');
  
  const testQueries = [
    '教室管理の詳細は',
    '教室一覧機能',
    '教室登録機能',
    '教室編集機能',
    '教室削除機能'
  ];
  
  const performanceResults: PerformanceMetrics[] = [];
  
  for (let i = 0; i < testQueries.length; i++) {
    const query = testQueries[i];
    console.log(`\n🔄 検索${i + 1}: "${query}"`);
    
    const startTime = performance.now();
    
    try {
      const results = await searchLanceDB({
        query,
        topK: 10,
        tableName: 'confluence',
        labelFilters: {
          includeMeetingNotes: false,
          includeArchived: false
        }
      });
      
      const endTime = performance.now();
      const searchTime = endTime - startTime;
      
      console.log(`⏱️  検索時間: ${searchTime.toFixed(2)}ms`);
      console.log(`📋 結果数: ${results.length}件`);
      
      performanceResults.push({
        searchTime,
        aiGenerationTime: 0,
        totalTime: searchTime,
        cacheHit: false
      });
      
    } catch (error) {
      console.error(`❌ 検索エラー (${query}):`, error);
    }
  }
  
  // パフォーマンス統計の計算
  const avgSearchTime = performanceResults.reduce((sum, p) => sum + p.searchTime, 0) / performanceResults.length;
  const minSearchTime = Math.min(...performanceResults.map(p => p.searchTime));
  const maxSearchTime = Math.max(...performanceResults.map(p => p.searchTime));
  
  console.log('\n📈 パフォーマンス統計:');
  console.log(`平均検索時間: ${avgSearchTime.toFixed(2)}ms`);
  console.log(`最小検索時間: ${minSearchTime.toFixed(2)}ms`);
  console.log(`最大検索時間: ${maxSearchTime.toFixed(2)}ms`);
  
  // パフォーマンス安定性の評価
  const variance = performanceResults.reduce((sum, p) => sum + Math.pow(p.searchTime - avgSearchTime, 2), 0) / performanceResults.length;
  const standardDeviation = Math.sqrt(variance);
  
  console.log(`標準偏差: ${standardDeviation.toFixed(2)}ms`);
  
  if (standardDeviation < 1000) {
    console.log('✅ パフォーマンスは安定しています');
  } else {
    console.log('⚠️ パフォーマンスにばらつきがあります');
  }
}

/**
 * メインテスト実行（パフォーマンステスト付き）
 */
async function runClassroomManagementQualityTest(): Promise<void> {
  console.log('🚀 教室管理検索品質・パフォーマンステスト開始');
  console.log('=' .repeat(60));
  
  try {
    // テストケース1: 基本検索テスト（パフォーマンス測定付き）
    const testResult = await testBasicSearch();
    
    // テストケース2: キーワードマッチングテスト
    await testKeywordMatching();
    
    // テストケース3: スコアリングテスト
    testScoring(testResult);
    
    // テストケース4: AI回答生成テスト（パフォーマンス測定付き）
    const aiTestResult = await testAIResponse();
    
    // AI結果をテスト結果に追加
    testResult.aiPrompt = aiTestResult.prompt;
    testResult.aiResponse = aiTestResult.response;
    testResult.aiReferences = aiTestResult.references;
    
    // AIパフォーマンス情報を統合
    if (testResult.performance && aiTestResult.performance) {
      testResult.performance.aiGenerationTime = aiTestResult.performance.aiGenerationTime;
      testResult.performance.totalTime = aiTestResult.performance.totalTime;
    }
    
    // 品質評価
    evaluateQuality(testResult);
    
    // パフォーマンス評価
    evaluatePerformance(testResult);
    
    // パフォーマンス比較テスト
    await testPerformanceComparison();
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ 教室管理検索品質・パフォーマンステスト完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  runClassroomManagementQualityTest()
    .then(() => {
      // 正常終了時に明示的にexit(0)を呼ぶ
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

export { runClassroomManagementQualityTest, TestResult, PerformanceMetrics };