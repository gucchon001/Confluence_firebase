#!/usr/bin/env tsx

/**
 * 機能テストランナー
 * 05.02-feature-tests.md の機能テストを実行
 * 
 * 実行方法:
 *   npx tsx src/tests/runners/feature-tests-runner.ts
 *   または
 *   npm run test:feature
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from '../test-helpers/env-loader';
loadTestEnv();

import { execSync } from 'child_process';
import * as path from 'path';

interface TestConfig {
  name: string;
  file: string;
  description: string;
  category: 'search' | 'summary' | 'hybrid' | 'label';
}

// 機能テスト一覧（05.02-feature-tests.md に対応）
const tests: TestConfig[] = [
  // 1. 検索品質テスト
  {
    name: '教室削除検索',
    file: 'classroom-deletion-issue-search-test.ts',
    description: '1.1.1 教室削除検索テスト',
    category: 'search'
  },
  {
    name: '教室削除キーワード品質',
    file: 'classroom-deletion-keyword-quality-test.ts',
    description: '1.1.2 教室削除キーワード品質テスト',
    category: 'search'
  },
  {
    name: '教室管理検索',
    file: 'classroom-management-search-test.ts',
    description: '1.2 教室管理検索品質テスト',
    category: 'search'
  },
  // 2. 回答生成テスト
  {
    name: 'ストリーミング要約',
    file: 'test-streaming-direct.ts',
    description: '2.1 ストリーミング要約テスト',
    category: 'summary'
  },
  // 3. ハイブリッド検索テスト
  {
    name: 'ハイブリッド検索',
    file: 'real-hybrid-search-test.ts',
    description: '3.3 ハイブリッド統合テスト',
    category: 'hybrid'
  },
  {
    name: 'ベクトル検索品質',
    file: 'vector-search-quality-test.ts',
    description: '3.1 ベクトル検索テスト',
    category: 'hybrid'
  },
  {
    name: 'ベクトル検索一貫性',
    file: 'vector-search-consistency-test.ts',
    description: '3.1 ベクトル検索一貫性テスト',
    category: 'hybrid'
  },
  // 4. ラベル・タイトルマッチングテスト
  {
    name: 'キーワード品質',
    file: 'keyword-quality-test.ts',
    description: '4.1 キーワード品質テスト',
    category: 'label'
  }
];

interface TestResult {
  test: TestConfig;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  output: string;
}

/**
 * テストを実行
 */
function runTest(test: TestConfig): TestResult {
  const startTime = Date.now();
  const testPath = path.join(__dirname, '..', test.file);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${tests.indexOf(test) + 1}/${tests.length}] ${test.description}`);
  console.log(`実行: ${test.file}`);
  console.log('='.repeat(60));
  
  try {
    // 環境変数を明示的に引き継ぐ（loadTestEnv()で設定された環境変数を含む）
    // execSyncで実行される子プロセスに環境変数を確実に引き継ぐため、
    // process.envをスプレッド構文でコピーして明示的に渡す
    // これにより、loadTestEnv()で設定された環境変数が子プロセスでも利用可能になる
    const env = { ...process.env };
    
    const output = execSync(`npx tsx "${testPath}"`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
      env: env, // 明示的に環境変数を引き継ぐ
      shell: true,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    console.log(output);
    
    const duration = Date.now() - startTime;
    
    return {
      test,
      status: 'PASS',
      duration,
      output: output || ''
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    
    let errorMessage = error.message || 'Unknown error';
    let errorOutput = '';
    
    const stdout = error.stdout?.toString() || '';
    const stderr = error.stderr?.toString() || '';
    
    if (stdout) {
      console.error('=== 標準出力 ===');
      console.error(stdout);
      errorOutput += `\n標準出力:\n${stdout}`;
    }
    if (stderr) {
      console.error('=== 標準エラー出力 ===');
      console.error(stderr);
      errorOutput += `\n標準エラー出力:\n${stderr}`;
    }
    
    console.error('=== エラーメッセージ ===');
    console.error(errorMessage);
    
    const errorLines = errorMessage.split('\n');
    const firstErrorLine = errorLines[0] || errorMessage;
    const errorDetails = errorLines.slice(1, 20).join('\n');
    
    if (error.status !== undefined) {
      errorMessage = `${firstErrorLine} (Exit code: ${error.status})`;
    }
    if (error.signal) {
      errorMessage += ` (Signal: ${error.signal})`;
    }
    
    if (errorDetails) {
      errorOutput += `\n\nエラー詳細:\n${errorDetails}${errorLines.length > 20 ? '\n... (省略) ...' : ''}`;
    }
    
    return {
      test,
      status: 'FAIL',
      duration,
      error: errorMessage,
      output: errorOutput
    };
  }
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 機能テスト実行（05.02-feature-tests.md）');
  console.log('='.repeat(60));
  console.log(`全${tests.length}個の機能テストを順次実行します...\n`);

  const results: TestResult[] = [];
  let hasFailure = false;

  // カテゴリごとにグループ化
  const categories = {
    search: tests.filter(t => t.category === 'search'),
    summary: tests.filter(t => t.category === 'summary'),
    hybrid: tests.filter(t => t.category === 'hybrid'),
    label: tests.filter(t => t.category === 'label')
  };

  // カテゴリごとに実行
  for (const [categoryName, categoryTests] of Object.entries(categories)) {
    if (categoryTests.length === 0) continue;
    
    console.log(`\n📂 カテゴリ: ${categoryName.toUpperCase()}`);
    console.log('-'.repeat(60));
    
    for (const test of categoryTests) {
      try {
        const result = runTest(test);
        results.push(result);

        if (result.status === 'PASS') {
          console.log(`\n✅ ${test.description}: 成功 (${result.duration}ms)`);
        } else {
          console.log(`\n❌ ${test.description}: 失敗 (${result.duration}ms)`);
          if (result.error) {
            console.log(`   エラー: ${result.error}`);
          }
          hasFailure = true;
          console.log(`\n⏭️  次のテストに続行します...\n`);
        }
      } catch (error) {
        const result: TestResult = {
          test,
          status: 'FAIL',
          duration: 0,
          error: error instanceof Error ? error.message : 'Unknown error',
          output: ''
        };
        results.push(result);
        hasFailure = true;
        
        console.log(`\n❌ ${test.description}: 実行エラー`);
        console.log(`   エラー: ${result.error}`);
        console.log(`\n⏭️  次のテストに続行します...\n`);
      }
    }
  }

  // 結果サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 機能テスト実行結果サマリー');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n📈 全体統計:`);
  console.log(`  合計: ${results.length}件`);
  console.log(`  成功: ${passed}件 ✅`);
  console.log(`  失敗: ${failed}件 ❌`);
  console.log(`  実行時間: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)\n`);

  // カテゴリ別統計
  console.log('📋 カテゴリ別結果:');
  for (const [categoryName, categoryTests] of Object.entries(categories)) {
    if (categoryTests.length === 0) continue;
    const categoryResults = results.filter(r => categoryTests.includes(r.test));
    const categoryPassed = categoryResults.filter(r => r.status === 'PASS').length;
    const categoryFailed = categoryResults.filter(r => r.status === 'FAIL').length;
    console.log(`  ${categoryName}: ${categoryPassed}/${categoryTests.length} 成功, ${categoryFailed} 失敗`);
  }
  console.log('');

  // 詳細な結果を表示
  console.log('📋 詳細結果:');
  results.forEach((result, index) => {
    const statusIcon = result.status === 'PASS' ? '✅' : '❌';
    const statusText = result.status === 'PASS' ? '成功' : '失敗';
    console.log(`  ${index + 1}. ${statusIcon} ${result.test.description}: ${statusText} (${result.duration}ms)`);
    if (result.status === 'FAIL' && result.error) {
      const errorMsg = result.error.length > 200 
        ? result.error.substring(0, 200) + '...' 
        : result.error;
      console.log(`     エラー: ${errorMsg}`);
    }
  });
  console.log('');

  if (hasFailure) {
    console.log('='.repeat(60));
    console.log('❌ 一部のテストが失敗しました');
    console.log('='.repeat(60));
    console.log('\n💡 ヒント: 詳細は docs/05-testing/05.02-feature-tests.md を参照してください。\n');
    process.exit(1);
  } else {
    console.log('='.repeat(60));
    console.log('🎉 すべての機能テストが成功しました！');
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  }
}

// 実行
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ 予期しないエラー:', error);
    process.exit(1);
  });
}

export { main as runFeatureTests };

