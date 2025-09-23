/**
 * 軽量パイプライン実行スクリプト
 * 既存データを使用した軽量実行
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface PipelineStep {
  name: string;
  command: string;
  description: string;
  required: boolean;
  skipIfExists: string; // このファイルが存在する場合はスキップ
}

interface PipelineResult {
  step: string;
  success: boolean;
  duration: number;
  output?: string;
  error?: string;
  skipped?: boolean;
}

class LightweightPipeline {
  private steps: PipelineStep[] = [
    {
      name: 'keyword-lists-generation',
      command: 'npx tsx src/scripts/generate-keyword-lists.ts',
      description: 'キーワード一覧ファイル生成',
      required: true,
      skipIfExists: 'data/domain-knowledge-v2/keyword-lists-v2.json'
    },
    {
      name: 'keyword-extraction-test',
      command: 'npx tsx src/tests/test-keyword-extractor-configured.ts',
      description: '設定値化キーワード抽出テスト',
      required: false,
      skipIfExists: ''
    },
    {
      name: 'search-precision-test',
      command: 'npx tsx src/tests/analyze-offer-search-precision.ts',
      description: '検索精度分析テスト',
      required: false,
      skipIfExists: ''
    }
  ];

  private results: PipelineResult[] = [];

  async run(): Promise<void> {
    console.log('🚀 軽量パイプライン実行開始');
    console.log('=====================================');
    console.log('');

    const startTime = Date.now();

    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      
      // スキップ条件チェック
      if (step.skipIfExists && existsSync(step.skipIfExists)) {
        console.log(`⏭️  Step ${i + 1}/${this.steps.length}: ${step.description}`);
        console.log(`   スキップ: ${step.skipIfExists} が既に存在`);
        
        this.results.push({
          step: step.name,
          success: true,
          duration: 0,
          skipped: true,
          output: 'スキップ済み'
        });
        
        console.log(`✅ Step ${i + 1} スキップ完了`);
        console.log('');
        continue;
      }

      console.log(`📋 Step ${i + 1}/${this.steps.length}: ${step.description}`);
      console.log(`   コマンド: ${step.command}`);
      
      const stepStartTime = Date.now();
      const result = await this.executeStep(step);
      const duration = Date.now() - stepStartTime;
      
      result.duration = duration;
      this.results.push(result);

      if (result.success) {
        console.log(`✅ Step ${i + 1} 完了 (${duration}ms)`);
      } else {
        console.log(`❌ Step ${i + 1} 失敗 (${duration}ms)`);
        console.log(`   エラー: ${result.error}`);
        
        if (step.required) {
          console.log('');
          console.log('💥 必須ステップが失敗しました。パイプラインを中断します。');
          break;
        } else {
          console.log('⚠️  オプションステップのため、続行します。');
        }
      }
      
      console.log('');
    }

    const totalDuration = Date.now() - startTime;
    this.printSummary(totalDuration);
  }

  private async executeStep(step: PipelineStep): Promise<PipelineResult> {
    try {
      execSync(step.command, { 
        encoding: 'utf8',
        stdio: 'inherit',
        timeout: 5 * 60 * 1000, // 5分タイムアウト
        maxBuffer: 1024 * 1024 * 5 // 5MB バッファサイズ
      });
      
      return {
        step: step.name,
        success: true,
        duration: 0,
        output: '実行完了'
      };
    } catch (error: any) {
      return {
        step: step.name,
        success: false,
        duration: 0,
        error: error.message,
        output: 'エラー詳細なし'
      };
    }
  }

  private printSummary(totalDuration: number): void {
    console.log('📊 軽量パイプライン実行結果サマリー');
    console.log('=====================================');
    console.log('');

    const successfulSteps = this.results.filter(r => r.success).length;
    const failedSteps = this.results.filter(r => !r.success).length;
    const skippedSteps = this.results.filter(r => r.skipped).length;
    const totalSteps = this.results.length;

    console.log(`総実行時間: ${Math.round(totalDuration / 1000)}秒`);
    console.log(`成功ステップ: ${successfulSteps}/${totalSteps}`);
    console.log(`失敗ステップ: ${failedSteps}/${totalSteps}`);
    console.log(`スキップステップ: ${skippedSteps}/${totalSteps}`);
    console.log('');

    // 各ステップの詳細
    console.log('📋 ステップ別結果:');
    this.results.forEach((result, index) => {
      const step = this.steps[index];
      const status = result.skipped ? '⏭️' : (result.success ? '✅' : '❌');
      const duration = Math.round(result.duration / 1000);
      const statusText = result.skipped ? 'スキップ' : `${duration}秒`;
      console.log(`   ${status} ${step.description} (${statusText})`);
    });

    console.log('');

    // 出力ファイル確認
    this.checkOutputFiles();

    // 最終結果
    if (failedSteps === 0) {
      console.log('🎉 軽量パイプラインが正常に完了しました！');
    } else {
      console.log(`⚠️  ${failedSteps}個のステップが失敗しました。`);
    }
  }

  private checkOutputFiles(): void {
    console.log('📁 生成されたファイル:');
    
    const files = [
      {
        path: 'data/domain-knowledge-v2/final-domain-knowledge-v2.json',
        description: '最終統合結果'
      },
      {
        path: 'data/domain-knowledge-v2/keyword-lists-v2.json',
        description: 'キーワード一覧'
      }
    ];

    files.forEach(file => {
      const exists = existsSync(file.path);
      const status = exists ? '✅' : '❌';
      console.log(`   ${status} ${file.description}: ${file.path}`);
      
      if (exists) {
        try {
          const stats = require('fs').statSync(file.path);
          const sizeKB = Math.round(stats.size / 1024);
          console.log(`      サイズ: ${sizeKB}KB`);
          
          // 統計情報を表示
          if (file.path.includes('final-domain-knowledge-v2.json')) {
            this.printFinalStatistics(file.path);
          } else if (file.path.includes('keyword-lists-v2.json')) {
            this.printKeywordListsStatistics(file.path);
          }
        } catch (error) {
          console.log(`      エラー: ファイル読み込み失敗`);
        }
      }
    });
  }

  private printFinalStatistics(filePath: string): void {
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      console.log(`      統計: ページ数=${data.statistics.totalPages}, キーワード数=${data.statistics.totalKeywords}`);
    } catch (error) {
      // エラーは無視
    }
  }

  private printKeywordListsStatistics(filePath: string): void {
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      console.log(`      統計: 総キーワード数=${data.statistics.totalKeywords}, カテゴリ数=${data.statistics.totalCategories}`);
    } catch (error) {
      // エラーは無視
    }
  }
}

// メイン実行
async function main(): Promise<void> {
  const pipeline = new LightweightPipeline();
  await pipeline.run();
}

// コマンドライン引数の処理
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
軽量パイプライン実行スクリプト

使用方法:
  npm run lightweight-pipeline

実行されるステップ:
  1. キーワード一覧ファイル生成（既存の場合はスキップ）
  2. 設定値化キーワード抽出テスト（オプション）
  3. 検索精度分析テスト（オプション）

オプション:
  --help, -h     このヘルプを表示
  `);
  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ 軽量パイプライン実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}

export { LightweightPipeline };
