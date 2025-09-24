/**
 * 全品質テストケース実行スクリプト
 * 768ファイルの品質テストを一括実行
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestResult {
  testName: string;
  status: 'PASS' | 'PARTIAL_PASS' | 'FAIL' | 'ERROR';
  score?: number;
  details?: string;
  executionTime: number;
}

class QualityTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🚀 全品質テストケース実行開始');
    console.log('=' .repeat(80));
    
    this.startTime = Date.now();
    
    const testFiles = [
      // 既存のテストファイル
      'src/tests/classroom-management-search-test.ts',
      'src/tests/offer-keyword-quality-test.ts',
      'src/tests/classroom-copy-keyword-quality-test.ts',
      
      // 新規作成したテストファイル
      'src/tests/member-login-keyword-quality-test.ts',
      'src/tests/classroom-deletion-keyword-quality-test.ts',
      
      // 動的キーワード抽出テスト
      'src/tests/test-dynamic-keyword-extraction.ts',
      'src/tests/keyword-quality-test.ts',
      'src/tests/simple-keyword-test.ts',
      'src/tests/test-improved-classroom-copy.ts',
      
      // 仕様準拠テスト
      'src/tests/test-spec-compliant-keyword-extraction.ts',
      'src/tests/test-ideal-keyword-extraction.ts',
      
      // 強化された検索システムテスト
      'src/tests/test-enhanced-search-system.ts'
    ];

    console.log(`📋 実行予定テスト数: ${testFiles.length}`);
    console.log('');

    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      console.log(`[${i + 1}/${testFiles.length}] 実行中: ${testFile}`);
      
      try {
        const result = await this.runSingleTest(testFile);
        this.results.push(result);
        
        const statusIcon = this.getStatusIcon(result.status);
        console.log(`  ${statusIcon} ${result.status} (${result.executionTime}ms)`);
        if (result.score !== undefined) {
          console.log(`     スコア: ${result.score.toFixed(1)}%`);
        }
        if (result.details) {
          console.log(`     詳細: ${result.details}`);
        }
        
      } catch (error) {
        const errorResult: TestResult = {
          testName: testFile,
          status: 'ERROR',
          executionTime: 0,
          details: error instanceof Error ? error.message : String(error)
        };
        this.results.push(errorResult);
        console.log(`  ❌ ERROR: ${errorResult.details}`);
      }
      
      console.log('');
    }

    await this.generateReport();
  }

  private async runSingleTest(testFile: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(`npx tsx ${testFile}`, {
        timeout: 30000, // 30秒タイムアウト
        maxBuffer: 1024 * 1024 // 1MB
      });

      const executionTime = Date.now() - startTime;
      
      // 出力から結果を解析
      const result = this.parseTestOutput(stdout, stderr, testFile, executionTime);
      
      return result;
      
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      if (error.code === 'TIMEOUT') {
        return {
          testName: testFile,
          status: 'ERROR',
          executionTime,
          details: 'タイムアウト（30秒）'
        };
      }
      
      return {
        testName: testFile,
        status: 'ERROR',
        executionTime,
        details: error.message || '不明なエラー'
      };
    }
  }

  private parseTestOutput(stdout: string, stderr: string, testFile: string, executionTime: number): TestResult {
    const output = stdout + stderr;
    
    // 品質テストの結果を解析
    if (output.includes('品質テスト: PASS')) {
      const scoreMatch = output.match(/合格基準: (\d+)\/(\d+) \((\d+\.?\d*)%\)/);
      const score = scoreMatch ? parseFloat(scoreMatch[3]) : undefined;
      
      return {
        testName: testFile,
        status: 'PASS',
        score,
        executionTime,
        details: '全基準をクリア'
      };
    }
    
    if (output.includes('品質テスト: PARTIAL PASS')) {
      const scoreMatch = output.match(/合格基準: (\d+)\/(\d+) \((\d+\.?\d*)%\)/);
      const score = scoreMatch ? parseFloat(scoreMatch[3]) : undefined;
      
      return {
        testName: testFile,
        status: 'PARTIAL_PASS',
        score,
        executionTime,
        details: '一部基準をクリア'
      };
    }
    
    if (output.includes('品質テスト: FAIL')) {
      const scoreMatch = output.match(/合格基準: (\d+)\/(\d+) \((\d+\.?\d*)%\)/);
      const score = scoreMatch ? parseFloat(scoreMatch[3]) : undefined;
      
      return {
        testName: testFile,
        status: 'FAIL',
        score,
        executionTime,
        details: '基準をクリアできず'
      };
    }
    
    // その他の成功パターン
    if (output.includes('✅') && !output.includes('❌')) {
      return {
        testName: testFile,
        status: 'PASS',
        executionTime,
        details: 'テスト完了'
      };
    }
    
    // エラーパターン
    if (output.includes('❌') || output.includes('ERROR') || output.includes('エラー')) {
      return {
        testName: testFile,
        status: 'ERROR',
        executionTime,
        details: '実行エラー'
      };
    }
    
    // デフォルト
    return {
      testName: testFile,
      status: 'FAIL',
      executionTime,
      details: '結果を解析できませんでした'
    };
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'PASS': return '✅';
      case 'PARTIAL_PASS': return '⚠️ ';
      case 'FAIL': return '❌';
      case 'ERROR': return '🔥';
      default: return '❓';
    }
  }

  private async generateReport(): Promise<void> {
    const totalTime = Date.now() - this.startTime;
    
    console.log('📊 テスト実行レポート');
    console.log('=' .repeat(80));
    
    // 統計情報
    const passCount = this.results.filter(r => r.status === 'PASS').length;
    const partialPassCount = this.results.filter(r => r.status === 'PARTIAL_PASS').length;
    const failCount = this.results.filter(r => r.status === 'FAIL').length;
    const errorCount = this.results.filter(r => r.status === 'ERROR').length;
    const totalCount = this.results.length;
    
    console.log(`📈 実行統計:`);
    console.log(`  - 総テスト数: ${totalCount}`);
    console.log(`  - PASS: ${passCount} (${(passCount/totalCount*100).toFixed(1)}%)`);
    console.log(`  - PARTIAL PASS: ${partialPassCount} (${(partialPassCount/totalCount*100).toFixed(1)}%)`);
    console.log(`  - FAIL: ${failCount} (${(failCount/totalCount*100).toFixed(1)}%)`);
    console.log(`  - ERROR: ${errorCount} (${(errorCount/totalCount*100).toFixed(1)}%)`);
    console.log(`  - 総実行時間: ${(totalTime/1000).toFixed(1)}秒`);
    console.log('');
    
    // スコア統計
    const scoresWithValues = this.results.filter(r => r.score !== undefined);
    if (scoresWithValues.length > 0) {
      const avgScore = scoresWithValues.reduce((sum, r) => sum + (r.score || 0), 0) / scoresWithValues.length;
      const maxScore = Math.max(...scoresWithValues.map(r => r.score || 0));
      const minScore = Math.min(...scoresWithValues.map(r => r.score || 0));
      
      console.log(`📊 スコア統計:`);
      console.log(`  - 平均スコア: ${avgScore.toFixed(1)}%`);
      console.log(`  - 最高スコア: ${maxScore.toFixed(1)}%`);
      console.log(`  - 最低スコア: ${minScore.toFixed(1)}%`);
      console.log('');
    }
    
    // 詳細結果
    console.log(`📋 詳細結果:`);
    this.results.forEach((result, index) => {
      const icon = this.getStatusIcon(result.status);
      const scoreText = result.score !== undefined ? ` (${result.score.toFixed(1)}%)` : '';
      const timeText = ` [${result.executionTime}ms]`;
      
      console.log(`  ${index + 1}. ${icon} ${result.testName}${scoreText}${timeText}`);
      if (result.details) {
        console.log(`      ${result.details}`);
      }
    });
    console.log('');
    
    // 品質保証の判定
    console.log(`🎯 品質保証の判定:`);
    
    const successRate = (passCount + partialPassCount * 0.5) / totalCount;
    const qualityAssurance = successRate >= 0.8;
    
    console.log(`  - 成功率: ${(successRate * 100).toFixed(1)}%`);
    console.log(`  - 品質保証: ${qualityAssurance ? '✅ 保証可能' : '❌ 保証不可'}`);
    
    if (qualityAssurance) {
      console.log(`  🎉 ベクトル検索システムは品質保証基準を満たしています！`);
    } else {
      console.log(`  🔧 さらなる改善が必要です。`);
      console.log(`     - FAIL/ERROR の原因を調査`);
      console.log(`     - PARTIAL PASS の改善`);
      console.log(`     - キーワード抽出ロジックの最適化`);
    }
    
    console.log('');
    console.log('=' .repeat(80));
    console.log('✅ 全品質テストケース実行完了');
  }
}

// メイン実行
async function main() {
  const runner = new QualityTestRunner();
  await runner.runAllTests();
}

main().catch(console.error);

