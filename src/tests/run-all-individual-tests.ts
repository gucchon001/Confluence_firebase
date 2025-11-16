#!/usr/bin/env tsx

/**
 * データ関連テスト - 個別実行 → 一括実行
 * 05.01-data-validation.md の全テスト項目を個別に実行し、
 * 全て成功したら一括テストを実行
 */

import { execSync } from 'child_process';
import * as path from 'path';

interface TestConfig {
  name: string;
  file: string;
  description: string;
}

// Confluenceのみのテスト（Jiraテストは除外）
const tests: TestConfig[] = [
  {
    name: 'LanceDBスキーマ検証',
    file: 'check-lancedb-schema.ts',
    description: '1.1 LanceDBスキーマ検証（Confluence）'
  },
  {
    name: 'Firestoreラベル統合',
    file: 'test-firestore-labels-integration.ts',
    description: '1.2 Firestoreラベル統合（Confluence）'
  },
  {
    name: 'LanceDBインデックス',
    file: 'test-lancedb-indexes.ts',
    description: '2.1 LanceDBインデックス（Confluence）'
  },
  {
    name: 'Lunrインデックス',
    file: 'test-lunr-index.ts',
    description: '2.2 Lunrインデックス（Confluence）'
  },
  {
    name: 'Confluence同期',
    file: 'test-confluence-sync.ts',
    description: '3.1 Confluence同期'
  },
  // Jira同期テストは除外（Confluenceのみのテスト）
  // {
  //   name: 'Jira同期',
  //   file: 'test-jira-sync.ts',
  //   description: '3.2 Jira同期'
  // },
  {
    name: 'ラベル生成',
    file: 'test-label-generation.ts',
    description: '4.1 ラベル生成（Confluence）'
  },
  {
    name: 'ラベルフィルタリング',
    file: 'test-label-filtering.ts',
    description: '4.2 ラベルフィルタリング（Confluence）'
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
 * テストを実行（execSyncを使用）
 */
function runTest(test: TestConfig): TestResult {
  const startTime = Date.now();
  const testPath = path.join(__dirname, test.file);
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${tests.indexOf(test) + 1}/${tests.length}] ${test.description}`);
  console.log(`実行: ${test.file}`);
  console.log('='.repeat(60));
  
  try {
    // stdout/stderrをキャプチャ（stdio: 'pipe'で全てキャプチャ）
    const output = execSync(`npx tsx "${testPath}"`, {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe', // stdout/stderrを全てキャプチャ
      env: process.env,
      shell: true,
      maxBuffer: 10 * 1024 * 1024 // 10MB
    });
    
    // 成功時は標準出力を表示
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
    
    // より詳細なエラー情報を取得
    let errorMessage = error.message || 'Unknown error';
    let errorOutput = '';
    
    // stdoutとstderrを取得（execSyncのエラーオブジェクトには含まれる）
    const stdout = error.stdout?.toString() || '';
    const stderr = error.stderr?.toString() || '';
    
    // エラー出力を構築（全て表示）
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
    
    // エラーメッセージ
    console.error('=== エラーメッセージ ===');
    console.error(errorMessage);
    
    // エラーメッセージが長い場合は最初の部分を取得
    const errorLines = errorMessage.split('\n');
    const firstErrorLine = errorLines[0] || errorMessage;
    const errorDetails = errorLines.slice(1, 20).join('\n'); // 最初の20行
    
    if (error.status !== undefined) {
      errorMessage = `${firstErrorLine} (Exit code: ${error.status})`;
    }
    if (error.signal) {
      errorMessage += ` (Signal: ${error.signal})`;
    }
    
    // エラー詳細を追加
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
  console.log('🚀 データ関連テスト - 個別実行（Confluenceのみ）');
  console.log('='.repeat(60));
  console.log(`全${tests.length}個のConfluenceテストを順次実行します...\n`);

  const results: TestResult[] = [];
  let hasFailure = false;

  // 個別テストを順次実行（全て実行）
  for (const test of tests) {
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
        if (result.output) {
          // エラー出力が長すぎる場合は最初の500文字のみ表示
          const errorOutput = result.output.length > 500 
            ? result.output.substring(0, 500) + '...' 
            : result.output;
          console.log(`   詳細: ${errorOutput}`);
        }
        hasFailure = true;
        
        // 失敗しても続行（全てのテストを実行）
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

  // 結果サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 個別テスト実行結果サマリー');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`\n📈 全体統計:`);
  console.log(`  合計: ${results.length}件`);
  console.log(`  成功: ${passed}件 ✅`);
  console.log(`  失敗: ${failed}件 ❌`);
  console.log(`  実行時間: ${totalDuration}ms (${(totalDuration / 1000).toFixed(2)}秒)\n`);

  // 詳細な結果を表示
  console.log('📋 詳細結果:');
  results.forEach((result, index) => {
    const statusIcon = result.status === 'PASS' ? '✅' : '❌';
    const statusText = result.status === 'PASS' ? '成功' : '失敗';
    console.log(`  ${index + 1}. ${statusIcon} ${result.test.description}: ${statusText} (${result.duration}ms)`);
    if (result.status === 'FAIL') {
      if (result.error) {
        // エラーメッセージの最初の200文字を表示
        const errorMsg = result.error.length > 200 
          ? result.error.substring(0, 200) + '...' 
          : result.error;
        console.log(`     エラー: ${errorMsg}`);
      }
      if (result.output) {
        // エラー出力の最初の500文字を表示
        const outputPreview = result.output.length > 500 
          ? result.output.substring(0, 500) + '\n      ... (省略) ...' 
          : result.output;
        console.log(`     詳細:`);
        outputPreview.split('\n').forEach(line => {
          if (line.trim()) {
            console.log(`       ${line}`);
          }
        });
      }
    }
  });
  console.log('');

  // 全て成功した場合のみ一括テストを実行
  if (!hasFailure && results.length === tests.length) {
    console.log('='.repeat(60));
    console.log('✅ 全個別テスト成功！');
    console.log('='.repeat(60));
    console.log('\n一括テストを実行します...\n');
    
    const comprehensiveTestPath = path.join(__dirname, 'test-data-validation-all.ts');
    
    try {
      execSync(`npx tsx "${comprehensiveTestPath}"`, {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'inherit',
        env: process.env
      });
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 全テスト成功！');
      console.log('='.repeat(60) + '\n');
    } catch (error: any) {
      console.log('\n' + '='.repeat(60));
      console.log('❌ 一括テストが失敗しました');
      if (error.message) {
        console.log(`エラー: ${error.message}`);
      }
      console.log('='.repeat(60) + '\n');
      process.exit(1);
    }
  } else {
    console.log('='.repeat(60));
    console.log('❌ 一部のテストが失敗したため、一括テストをスキップします');
    console.log('='.repeat(60));
    console.log('\n💡 ヒント: 環境変数が設定されていない場合は、`.env.local`ファイルを確認してください。');
    console.log('   詳細は `docs/05-testing/TROUBLESHOOTING.md` を参照してください。\n');
    
    // 失敗があっても終了コードは1で終了（CI/CDで検知できるように）
    process.exit(1);
  }
}

// 実行
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ 予期しないエラー:', error);
    process.exit(1);
  });
}

export { main as runAllIndividualTests };

