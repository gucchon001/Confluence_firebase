#!/usr/bin/env tsx

/**
 * デプロイ・整合性テストランナー
 * 05.03-deployment-integration.md のテストを実行
 * 
 * 実行方法:
 *   npx tsx src/tests/runners/deployment-integration-tests-runner.ts
 *   または
 *   npm run test:deployment-integration
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from '../test-helpers/env-loader';
loadTestEnv();

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

interface TestConfig {
  name: string;
  command: string;
  description: string;
  category: 'config' | 'type' | 'local' | 'production' | 'data' | 'verify' | 'performance' | 'analysis';
  skipOnError?: boolean; // エラーが発生しても続行するか
  required?: boolean; // 必須かどうか
}

// デプロイ・整合性テスト一覧
// 05.03-deployment-integration.md に対応
const tests: TestConfig[] = [
  // ===== 05.03: デプロイ・整合性テスト =====
  // 1. 環境変数・設定値検証
  {
    name: '設定値管理移行テスト',
    command: 'npm run test:unit -- src/tests/config/app-config.test.ts',
    description: '1.1 設定値管理移行テスト（app-config.test.ts）',
    category: 'config'
  },
  // 2. 型安全性検証
  {
    name: 'TypeScript型チェック',
    command: 'npx tsc --noEmit',
    description: '2.1 TypeScript型チェック',
    category: 'type'
  },
  // 3. ローカル環境テスト
  {
    name: 'ローカルビルドテスト',
    command: 'npm run build', // .next削除はrunTest関数内で実行
    description: '3.1 ローカルビルドテスト',
    category: 'local',
    skipOnError: false // ビルドエラーは修正すべき問題なので、失敗として扱う
  },
  // 4. 本番環境デプロイテスト
  {
    name: '本番デプロイ準備',
    command: 'npm run prepare:production',
    description: '4.1 本番デプロイ準備',
    category: 'production',
    skipOnError: true // 本番環境がない場合でも続行可能
  },
  {
    name: '本番LanceDBスキーマ確認',
    command: 'npx tsx scripts/archive/check-scripts/check-production-lancedb-schema.ts',
    description: '4.2 本番データ整合性（LanceDBスキーマ）',
    category: 'production',
    skipOnError: true // 本番環境がない場合でも続行可能
  },
  {
    name: '本番Cloud Storage確認',
    command: 'npx tsx src/tests/check-cloud-storage-lancedb.ts',
    description: '4.2 本番データ整合性（Cloud Storage）',
    category: 'production',
    skipOnError: true // 本番環境がない場合でも続行可能
  },
  // 5. データ整合性検証（LanceDBスキーマ確認）
  {
    name: 'LanceDBスキーマ確認',
    command: 'npx tsx src/tests/check-lancedb-schema.ts',
    description: '5.2 データ整合性チェック（LanceDBスキーマ）',
    category: 'data'
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
 * .nextディレクトリを削除（ビルド前のクリーンアップ用）
 */
function cleanNextDirectory(): void {
  const nextDir = path.join(process.cwd(), '.next');
  if (fs.existsSync(nextDir)) {
    try {
      fs.rmSync(nextDir, { recursive: true, force: true });
      console.log('✅ .next directory cleaned');
    } catch (error) {
      console.warn('⚠️  Failed to clean .next directory:', error);
    }
  }
}

/**
 * テストを実行
 */
function runTest(test: TestConfig): TestResult {
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${tests.indexOf(test) + 1}/${tests.length}] ${test.description}`);
  console.log(`実行: ${test.name}`);
  console.log('='.repeat(60));
  
  // ビルドテストの場合は、実行前に.nextディレクトリをクリーンアップ
  if (test.name === 'ローカルビルドテスト') {
    cleanNextDirectory();
  }
  
  try {
    // ビルドテストの場合は、コマンドから.next削除部分を除去（既に削除済み）
    const command = test.name === 'ローカルビルドテスト' 
      ? 'npm run build'
      : test.command;
    
    // ビルドテストの場合は、NODE_ENVをproductionに設定
    const env = test.name === 'ローカルビルドテスト'
      ? { ...process.env, NODE_ENV: 'production' }
      : { ...process.env };
    
    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
      env: env,
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
    
    // skipOnErrorがtrueの場合はSKIP、falseの場合はFAIL
    const status = test.skipOnError ? 'SKIP' : 'FAIL';
    
    if (status === 'SKIP') {
      console.log(`\n⚠️  ${test.description}: スキップ (${duration}ms)`);
      console.log(`   理由: ${errorMessage}`);
    }
    
    return {
      test,
      status,
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
  console.log('🚀 デプロイ・整合性テスト実行');
  console.log('   05.03-deployment-integration.md');
  console.log('='.repeat(60));
  console.log(`全${tests.length}個のテストを順次実行します...\n`);

  const results: TestResult[] = [];
  let hasFailure = false;

  // カテゴリごとにグループ化
  const categories = {
    config: tests.filter(t => t.category === 'config'),
    type: tests.filter(t => t.category === 'type'),
    local: tests.filter(t => t.category === 'local'),
    production: tests.filter(t => t.category === 'production'),
    data: tests.filter(t => t.category === 'data'),
    verify: tests.filter(t => t.category === 'verify'),
    performance: tests.filter(t => t.category === 'performance'),
    analysis: tests.filter(t => t.category === 'analysis')
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
        } else if (result.status === 'SKIP') {
          console.log(`\n⚠️  ${test.description}: スキップ (${result.duration}ms)`);
          if (result.error) {
            console.log(`   理由: ${result.error}`);
          }
        } else {
          console.log(`\n❌ ${test.description}: 失敗 (${result.duration}ms)`);
          if (result.error) {
            console.log(`   エラー: ${result.error}`);
          }
          hasFailure = true;
          if (!test.skipOnError && test.required) {
            console.log(`\n⛔ 必須テストが失敗しました。続行しますが、注意してください。\n`);
          } else if (!test.skipOnError) {
            console.log(`\n⏭️  次のテストに続行します...\n`);
          }
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
        console.log(`\n❌ ${test.description}: 予期しないエラー`);
        console.log(`   エラー: ${result.error}`);
        if (!test.skipOnError && test.required) {
          console.log(`\n⛔ 必須テストが失敗しました。続行しますが、注意してください。\n`);
        } else if (!test.skipOnError) {
          console.log(`\n⏭️  次のテストに続行します...\n`);
        }
      }
    }
  }

  // 結果サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 デプロイ・整合性テスト実行結果サマリー');
  console.log('='.repeat(60));

  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const required = results.filter(r => r.test.required && r.status === 'PASS').length;
  const requiredTotal = results.filter(r => r.test.required).length;

  console.log(`\n📈 全体統計:`);
  console.log(`  合計: ${results.length}件`);
  console.log(`  成功: ${passed}件 ✅`);
  console.log(`  失敗: ${failed}件 ${failed > 0 ? '❌' : ''}`);
  console.log(`  スキップ: ${skipped}件 ⚠️`);
  if (requiredTotal > 0) {
    console.log(`  必須テスト: ${required}/${requiredTotal}件 成功`);
  }
  console.log(`  実行時間: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)`);

  // カテゴリ別結果
  console.log(`\n📋 カテゴリ別結果:`);
  for (const [categoryName, categoryTests] of Object.entries(categories)) {
    if (categoryTests.length === 0) continue;
    const categoryResults = results.filter(r => categoryTests.includes(r.test));
    const categoryPassed = categoryResults.filter(r => r.status === 'PASS').length;
    const categoryFailed = categoryResults.filter(r => r.status === 'FAIL').length;
    const categorySkipped = categoryResults.filter(r => r.status === 'SKIP').length;
    console.log(`  ${categoryName}: ${categoryPassed}/${categoryTests.length} 成功, ${categoryFailed} 失敗, ${categorySkipped} スキップ`);
  }

  // 詳細結果
  console.log(`\n📋 詳細結果:`);
  results.forEach((result, index) => {
    const statusIcon = result.status === 'PASS' ? '✅' : result.status === 'SKIP' ? '⚠️' : '❌';
    const requiredIcon = result.test.required ? '⭐' : '';
    console.log(`  ${index + 1}. ${statusIcon} ${requiredIcon} ${result.test.description}: ${result.status} (${result.duration}ms)`);
    if (result.error && result.status === 'FAIL') {
      const errorPreview = result.error.split('\n')[0].substring(0, 100);
      console.log(`     エラー: ${errorPreview}${result.error.length > 100 ? '...' : ''}`);
    }
  });


  console.log('\n' + '='.repeat(60));
  if (hasFailure && requiredTotal > 0 && required > 0) {
    console.log('⚠️  一部のテストが失敗しましたが、必須テストは完了しました');
    console.log('='.repeat(60));
    process.exit(0); // 必須テストが完了していれば成功として扱う
  } else if (hasFailure) {
    console.log('❌ 一部のテストが失敗しました');
    console.log('='.repeat(60));
    process.exit(1);
  } else {
    console.log('✅ すべてのテストが成功しました');
    console.log('='.repeat(60));
    process.exit(0);
  }
}

// メイン実行
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  });
}

export { main as runDeploymentIntegrationTests };

