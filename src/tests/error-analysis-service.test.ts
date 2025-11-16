/**
 * エラー分析サービスのテスト
 * 
 * 実行方法:
 *   npx tsx src/tests/error-analysis-service.test.ts
 */

import { errorAnalysisService } from '@/lib/error-analysis-service';
import type { PostLog, ErrorLog } from '@/types';

// テスト用のモックデータ生成関数
function createMockErrorLog(
  id: string,
  category: ErrorLog['category'],
  level: ErrorLog['level'],
  message: string,
  resolved: boolean = false,
  timestamp: Date = new Date()
): ErrorLog {
  return {
    id,
    timestamp,
    level,
    category,
    message,
    context: {
      userId: 'user1',
      sessionId: 'session1',
    },
    resolved,
  };
}

function createMockPostLog(
  id: string,
  errors: ErrorLog[] = [],
  timestamp: Date = new Date()
): PostLog {
  return {
    id,
    userId: 'user1',
    question: 'テスト質問',
    answer: 'テスト回答',
    timestamp,
    totalTime: 1000,
    searchTime: 500,
    aiGenerationTime: 500,
    referencesCount: 0,
    references: [],
    errors,
    metadata: {
      userDisplayName: 'テストユーザー',
      sessionId: 'session1',
    },
  };
}

// テスト結果の型
interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

// テスト結果を表示
function printTestResult(result: TestResult): void {
  const icon = result.passed ? '✅' : '❌';
  console.log(`${icon} ${result.name}`);
  if (!result.passed || result.details) {
    console.log(`   ${result.message}`);
    if (result.details) {
      console.log(`   詳細:`, JSON.stringify(result.details, null, 2));
    }
  }
}

// テスト1: エラーがない場合は空の分析結果を返す
function testEmptyAnalysis(): TestResult {
  console.log('\n📊 テスト1: エラーがない場合の空の分析結果');
  
  const postLogs: PostLog[] = [
    createMockPostLog('1'),
    createMockPostLog('2'),
  ];

  const result = errorAnalysisService.analyzeErrors(postLogs);

  if (result.byCategory.search.count !== 0) {
    return {
      name: '空の分析結果',
      passed: false,
      message: `検索エラーのカウントが0ではありません: ${result.byCategory.search.count}`,
      details: { result }
    };
  }

  if (result.recentErrors.length !== 0) {
    return {
      name: '空の分析結果',
      passed: false,
      message: `最近のエラーが空ではありません: ${result.recentErrors.length}件`,
      details: { result }
    };
  }

  return {
    name: '空の分析結果',
    passed: true,
    message: 'エラーがない場合、空の分析結果が返されました'
  };
}

// テスト2: エラー種別別の統計を正しく計算する
function testCategoryAnalysis(): TestResult {
  console.log('\n📊 テスト2: エラー種別別統計');
  
  const postLogs: PostLog[] = [
    createMockPostLog('1', [
      createMockErrorLog('e1', 'search', 'error', '検索エラー1'),
      createMockErrorLog('e2', 'search', 'warning', '検索エラー2'),
    ]),
    createMockPostLog('2', [
      createMockErrorLog('e3', 'ai', 'error', 'AI生成エラー1'),
    ]),
    createMockPostLog('3', [
      createMockErrorLog('e4', 'system', 'error', 'システムエラー1'),
      createMockErrorLog('e5', 'auth', 'warning', '認証エラー1'),
    ]),
  ];

  const result = errorAnalysisService.analyzeErrors(postLogs);

  if (result.byCategory.search.count !== 2) {
    return {
      name: 'エラー種別別統計',
      passed: false,
      message: `検索エラーのカウントが正しくありません: 期待値=2, 実際=${result.byCategory.search.count}`,
      details: { result }
    };
  }

  if (result.byCategory.ai.count !== 1) {
    return {
      name: 'エラー種別別統計',
      passed: false,
      message: `AIエラーのカウントが正しくありません: 期待値=1, 実際=${result.byCategory.ai.count}`,
      details: { result }
    };
  }

  if (Math.abs(result.byCategory.search.percentage - 40) > 1) {
    return {
      name: 'エラー種別別統計',
      passed: false,
      message: `検索エラーのパーセンテージが正しくありません: 期待値≈40%, 実際=${result.byCategory.search.percentage}%`,
      details: { result }
    };
  }

  return {
    name: 'エラー種別別統計',
    passed: true,
    message: 'エラー種別別の統計が正しく計算されました',
    details: {
      search: result.byCategory.search.count,
      ai: result.byCategory.ai.count,
      system: result.byCategory.system.count,
      auth: result.byCategory.auth.count,
    }
  };
}

// テスト3: エラーレベル別の統計を正しく計算する
function testLevelAnalysis(): TestResult {
  console.log('\n📊 テスト3: エラーレベル別統計');
  
  const postLogs: PostLog[] = [
    createMockPostLog('1', [
      createMockErrorLog('e1', 'search', 'error', 'エラー1'),
      createMockErrorLog('e2', 'search', 'warning', '警告1'),
      createMockErrorLog('e3', 'search', 'info', '情報1'),
    ]),
  ];

  const result = errorAnalysisService.analyzeErrors(postLogs);

  if (result.byLevel.error !== 1) {
    return {
      name: 'エラーレベル別統計',
      passed: false,
      message: `エラーレベルのカウントが正しくありません: 期待値=1, 実際=${result.byLevel.error}`,
      details: { result }
    };
  }

  if (result.byLevel.warning !== 1) {
    return {
      name: 'エラーレベル別統計',
      passed: false,
      message: `警告レベルのカウントが正しくありません: 期待値=1, 実際=${result.byLevel.warning}`,
      details: { result }
    };
  }

  return {
    name: 'エラーレベル別統計',
    passed: true,
    message: 'エラーレベル別の統計が正しく計算されました',
    details: result.byLevel
  };
}

// テスト4: 解決状況を正しく分析する
function testResolutionStatus(): TestResult {
  console.log('\n📊 テスト4: 解決状況分析');
  
  const postLogs: PostLog[] = [
    createMockPostLog('1', [
      createMockErrorLog('e1', 'search', 'error', 'エラー1', true),
      createMockErrorLog('e2', 'search', 'error', 'エラー2', false),
      createMockErrorLog('e3', 'search', 'warning', '警告1', false),
    ]),
  ];

  const result = errorAnalysisService.analyzeErrors(postLogs);

  if (result.resolutionStatus.resolved !== 1) {
    return {
      name: '解決状況分析',
      passed: false,
      message: `解決済みのカウントが正しくありません: 期待値=1, 実際=${result.resolutionStatus.resolved}`,
      details: { result }
    };
  }

  if (result.resolutionStatus.unresolved !== 2) {
    return {
      name: '解決状況分析',
      passed: false,
      message: `未解決のカウントが正しくありません: 期待値=2, 実際=${result.resolutionStatus.unresolved}`,
      details: { result }
    };
  }

  return {
    name: '解決状況分析',
    passed: true,
    message: '解決状況が正しく分析されました',
    details: result.resolutionStatus
  };
}

// テスト5: 最近のエラーを時系列順に返す
function testRecentErrorsOrdering(): TestResult {
  console.log('\n📊 テスト5: 最近のエラーの時系列順');
  
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const postLogs: PostLog[] = [
    createMockPostLog('1', [
      createMockErrorLog('e1', 'search', 'error', 'エラー1', false, twoHoursAgo),
    ], twoHoursAgo),
    createMockPostLog('2', [
      createMockErrorLog('e2', 'search', 'error', 'エラー2', false, now),
    ], now),
    createMockPostLog('3', [
      createMockErrorLog('e3', 'search', 'error', 'エラー3', false, oneHourAgo),
    ], oneHourAgo),
  ];

  const result = errorAnalysisService.analyzeErrors(postLogs);

  if (result.recentErrors.length !== 3) {
    return {
      name: '最近のエラーの時系列順',
      passed: false,
      message: `最近のエラーの数が正しくありません: 期待値=3, 実際=${result.recentErrors.length}`,
      details: { result }
    };
  }

  if (result.recentErrors[0].id !== 'e2') {
    return {
      name: '最近のエラーの時系列順',
      passed: false,
      message: `最新のエラーが正しくありません: 期待値=e2, 実際=${result.recentErrors[0].id}`,
      details: { recentErrors: result.recentErrors.map(e => ({ id: e.id, timestamp: e.timestamp })) }
    };
  }

  return {
    name: '最近のエラーの時系列順',
    passed: true,
    message: '最近のエラーが時系列順に返されました',
    details: { recentErrors: result.recentErrors.map(e => ({ id: e.id, timestamp: e.timestamp })) }
  };
}

// テスト6: 最近のエラーは最大20件まで返す
function testRecentErrorsLimit(): TestResult {
  console.log('\n📊 テスト6: 最近のエラーの上限');
  
  const postLogs: PostLog[] = Array.from({ length: 25 }, (_, i) =>
    createMockPostLog(
      `log${i}`,
      [createMockErrorLog(`e${i}`, 'search', 'error', `エラー${i}`)]
    )
  );

  const result = errorAnalysisService.analyzeErrors(postLogs);

  if (result.recentErrors.length > 20) {
    return {
      name: '最近のエラーの上限',
      passed: false,
      message: `最近のエラーが20件を超えています: ${result.recentErrors.length}件`,
      details: { result }
    };
  }

  return {
    name: '最近のエラーの上限',
    passed: true,
    message: `最近のエラーは${result.recentErrors.length}件（上限20件以内）`,
    details: { count: result.recentErrors.length }
  };
}

// テスト7: エラーパターンを正しく分析する
function testErrorPatterns(): TestResult {
  console.log('\n📊 テスト7: エラーパターン分析');
  
  const postLogs: PostLog[] = [
    createMockPostLog('1', [
      createMockErrorLog('e1', 'search', 'error', '検索エラー: タイムアウト'),
      createMockErrorLog('e2', 'search', 'error', '検索エラー: タイムアウト'),
      createMockErrorLog('e3', 'search', 'error', '検索エラー: タイムアウト'),
    ]),
    createMockPostLog('2', [
      createMockErrorLog('e4', 'ai', 'error', 'AI生成エラー: レート制限'),
      createMockErrorLog('e5', 'ai', 'error', 'AI生成エラー: レート制限'),
    ]),
  ];

  const result = errorAnalysisService.analyzeErrors(postLogs);

  if (result.errorPatterns.length === 0) {
    return {
      name: 'エラーパターン分析',
      passed: false,
      message: 'エラーパターンが検出されませんでした',
      details: { result }
    };
  }

  // 最も頻繁に発生するパターンが最初に来る
  if (result.errorPatterns[0].count < 2) {
    return {
      name: 'エラーパターン分析',
      passed: false,
      message: `最も頻繁なパターンのカウントが正しくありません: ${result.errorPatterns[0].count}`,
      details: { patterns: result.errorPatterns }
    };
  }

  return {
    name: 'エラーパターン分析',
    passed: true,
    message: `エラーパターンが${result.errorPatterns.length}件検出されました`,
    details: { patterns: result.errorPatterns.map(p => ({ pattern: p.pattern, count: p.count })) }
  };
}

// テスト8: resolveError
function testResolveError(): TestResult {
  console.log('\n📊 テスト8: エラー解決機能');
  
  const error = createMockErrorLog('e1', 'search', 'error', 'エラー1', false);
  const resolvedBy = 'admin1';

  const resolved = errorAnalysisService.resolveError(error, resolvedBy);

  if (!resolved.resolved) {
    return {
      name: 'エラー解決',
      passed: false,
      message: 'エラーが解決済みにマークされませんでした',
      details: { resolved }
    };
  }

  if (resolved.resolvedBy !== resolvedBy) {
    return {
      name: 'エラー解決',
      passed: false,
      message: `解決者が正しく設定されませんでした: 期待値=${resolvedBy}, 実際=${resolved.resolvedBy}`,
      details: { resolved }
    };
  }

  if (!resolved.resolvedAt) {
    return {
      name: 'エラー解決',
      passed: false,
      message: '解決日時が設定されませんでした',
      details: { resolved }
    };
  }

  // 元のエラーオブジェクトが変更されていないことを確認
  if (error.resolved) {
    return {
      name: 'エラー解決',
      passed: false,
      message: '元のエラーオブジェクトが変更されました',
      details: { original: error, resolved }
    };
  }

  return {
    name: 'エラー解決',
    passed: true,
    message: 'エラーが正しく解決されました',
    details: { resolved }
  };
}

// テスト9: getCategoryName
function testGetCategoryName(): TestResult {
  console.log('\n📊 テスト9: カテゴリ名取得');
  
  const categoryNames = {
    search: errorAnalysisService.getCategoryName('search'),
    ai: errorAnalysisService.getCategoryName('ai'),
    system: errorAnalysisService.getCategoryName('system'),
    auth: errorAnalysisService.getCategoryName('auth'),
  };

  if (categoryNames.search !== '検索エラー') {
    return {
      name: 'カテゴリ名取得',
      passed: false,
      message: `検索エラーのカテゴリ名が正しくありません: ${categoryNames.search}`,
      details: { categoryNames }
    };
  }

  return {
    name: 'カテゴリ名取得',
    passed: true,
    message: 'すべてのカテゴリ名が正しく返されました',
    details: { categoryNames }
  };
}

// テスト10: getLevelName
function testGetLevelName(): TestResult {
  console.log('\n📊 テスト10: レベル名取得');
  
  const levelNames = {
    error: errorAnalysisService.getLevelName('error'),
    warning: errorAnalysisService.getLevelName('warning'),
    info: errorAnalysisService.getLevelName('info'),
  };

  if (levelNames.error !== 'エラー') {
    return {
      name: 'レベル名取得',
      passed: false,
      message: `エラーレベルの名前が正しくありません: ${levelNames.error}`,
      details: { levelNames }
    };
  }

  return {
    name: 'レベル名取得',
    passed: true,
    message: 'すべてのレベル名が正しく返されました',
    details: { levelNames }
  };
}

// メイン実行関数
async function runTests(): Promise<void> {
  console.log('🚀 エラー分析サービスのテスト開始\n');
  console.log('='.repeat(60));

  const tests = [
    testEmptyAnalysis,
    testCategoryAnalysis,
    testLevelAnalysis,
    testResolutionStatus,
    testRecentErrorsOrdering,
    testRecentErrorsLimit,
    testErrorPatterns,
    testResolveError,
    testGetCategoryName,
    testGetLevelName,
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    try {
      const result = test();
      results.push(result);
      printTestResult(result);
    } catch (error) {
      const errorResult: TestResult = {
        name: test.name,
        passed: false,
        message: `テスト実行中にエラーが発生しました: ${error instanceof Error ? error.message : String(error)}`,
        details: { error }
      };
      results.push(errorResult);
      printTestResult(errorResult);
    }
  }

  // サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 テスト結果サマリー');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`総テスト数: ${total}`);
  console.log(`✅ 成功: ${passed}`);
  console.log(`❌ 失敗: ${failed}`);
  console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n❌ 失敗したテスト:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`   - ${r.name}: ${r.message}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ すべてのテストが成功しました！');
    process.exit(0);
  }
}

// テスト実行
if (require.main === module) {
  runTests().catch(error => {
    console.error('❌ テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { runTests };

