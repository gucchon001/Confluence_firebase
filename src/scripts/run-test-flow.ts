#!/usr/bin/env tsx

/**
 * スクリプトテスト→画面テストの自動化フロー実行スクリプト
 * 
 * 使用方法:
 *   npx tsx src/scripts/run-test-flow.ts [test-name]
 * 
 * 例:
 *   npx tsx src/scripts/run-test-flow.ts                    # 全テスト実行
 *   npx tsx src/scripts/run-test-flow.ts "教室管理の詳細"    # 単一テスト実行
 */

import { runAllTests, runSingleTest } from '../app/login/test-runner';

async function main() {
  const args = process.argv.slice(2);
  const testName = args[0];
  
  console.log('=== RAG テストフロー実行 ===');
  console.log(`実行時刻: ${new Date().toISOString()}`);
  console.log(`Node.js バージョン: ${process.version}`);
  console.log(`作業ディレクトリ: ${process.cwd()}\n`);
  
  try {
    if (testName) {
      console.log(`指定されたテストケースを実行: ${testName}`);
      await runSingleTest(testName);
    } else {
      console.log('全テストケースを実行');
      await runAllTests();
    }
    
    console.log('\n=== テストフロー実行完了 ===');
    process.exit(0);
    
  } catch (error) {
    console.error('\n=== テストフロー実行エラー ===');
    console.error(error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}
