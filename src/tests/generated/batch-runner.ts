/**
 * 生成された品質テストのバッチ実行スクリプト
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface TestResult {
  testName: string;
  status: 'PASS' | 'PARTIAL_PASS' | 'FAIL' | 'ERROR';
  score?: number;
  details?: string;
  executionTime: number;
}

class GeneratedTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllGeneratedTests(): Promise<void> {
    console.log('🚀 生成された品質テスト実行開始');
    console.log('=' .repeat(80));
    
    this.startTime = Date.now();
    
    // 生成されたテストファイルを動的に取得
    const testDir = __dirname;
    const testFiles = fs.readdirSync(testDir)
      .filter(file => file.endsWith('-keyword-quality-test.ts'))
      .map(file => path.join(testDir, file));

    console.log(`📋 実行予定テスト数: ${testFiles.length}`);
    console.log('');

    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      const fileName = path.basename(testFile);
      console.log(`[${i + 1}/${testFiles.length}] 実行中: ${fileName}`);
      
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
          testName: fileName,
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
        timeout: 30000,
        maxBuffer: 1024 * 1024
      });

      const executionTime = Date.now() - startTime;
      const result = this.parseTestOutput(stdout, stderr, path.basename(testFile), executionTime);
      
      return result;
      
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      if (error.code === 'TIMEOUT') {
        return {
          testName: path.basename(testFile),
          status: 'ERROR',
          executionTime,
          details: 'タイムアウト（30秒）'
        };
      }
      
      return {
        testName: path.basename(testFile),
        status: 'ERROR',
        executionTime,
        details: error.message || '不明なエラー'
      };
    }
  }

  private parseTestOutput(stdout: string, stderr: string, testFile: string, executionTime: number): TestResult {
    const output = stdout + stderr;
    
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
    
    if (output.includes('✅') && !output.includes('❌')) {
      return {
        testName: testFile,
        status: 'PASS',
        executionTime,
        details: 'テスト完了'
      };
    }
    
    if (output.includes('❌') || output.includes('ERROR') || output.includes('エラー')) {
      return {
        testName: testFile,
        status: 'ERROR',
        executionTime,
        details: '実行エラー'
      };
    }
    
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
    
    console.log('📊 生成テスト実行レポート');
    console.log('=' .repeat(80));
    
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
    
    const successRate = (passCount + partialPassCount * 0.5) / totalCount;
    const qualityAssurance = successRate >= 0.8;
    
    console.log(`🎯 品質保証の判定:`);
    console.log(`  - 成功率: ${(successRate * 100).toFixed(1)}%`);
    console.log(`  - 品質保証: ${qualityAssurance ? '✅ 保証可能' : '❌ 保証不可'}`);
    
    if (qualityAssurance) {
      console.log(`  🎉 ベクトル検索システムは品質保証基準を満たしています！`);
    } else {
      console.log(`  🔧 さらなる改善が必要です。`);
    }
    
    console.log('');
    console.log('=' .repeat(80));
    console.log('✅ 生成された品質テスト実行完了');
  }
}

// メイン実行
async function main() {
  const runner = new GeneratedTestRunner();
  await runner.runAllGeneratedTests();
}

main().catch(console.error);
