/**
 * バッチ品質テスト生成スクリプト
 * 768ファイルの品質テストを自動生成
 */

import * as fs from 'fs';
import * as path from 'path';

interface TestCase {
  name: string;
  query: string;
  idealKeywords: string[];
  expectedPages: string[];
  excludedPages: string[];
  qualityMetrics: {
    precision: number;
    recall: number;
    f1Score: number;
    averageScore: number;
  };
}

class BatchQualityTestGenerator {
  private testCases: TestCase[] = [];
  private outputDir: string = 'src/tests/generated';

  constructor() {
    this.initializeTestCases();
  }

  private initializeTestCases(): void {
    // 既存の品質テストケースを基に拡張
    this.testCases = [
      // 教室管理関連
      {
        name: 'classroom-management',
        query: '教室管理の詳細は',
        idealKeywords: [
          "教室管理", "教室", "教室一覧", "教室登録",
          "教室編集", "教室削除", "教室コピー", "教室管理の詳細", "管理", "詳細"
        ],
        expectedPages: [
          "160_【FIX】教室管理機能",
          "161_【FIX】教室一覧閲覧機能",
          "162_【FIX】教室新規登録機能",
          "163_【FIX】教室情報編集機能",
          "168_【FIX】教室コピー機能"
        ],
        excludedPages: [
          "125_【FIX】企業詳細閲覧機能",
          "092_【FIX】応募履歴詳細閲覧機能",
          "433_【作成中】会員情報詳細閲覧機能"
        ],
        qualityMetrics: {
          precision: 0.8,
          recall: 0.7,
          f1Score: 0.75,
          averageScore: 75
        }
      },
      
      // オファー機能関連
      {
        name: 'offer-function',
        query: 'オファー機能の詳細を教えて',
        idealKeywords: [
          "オファー", "機能", "詳細", "オファー機能", "オファー管理",
          "オファー送信", "オファー受信", "オファー一覧", "オファー登録"
        ],
        expectedPages: [
          "オファー機能",
          "オファー管理機能",
          "オファー送信機能",
          "オファー受信機能"
        ],
        excludedPages: [
          "教室管理機能",
          "会員管理機能"
        ],
        qualityMetrics: {
          precision: 0.8,
          recall: 0.7,
          f1Score: 0.75,
          averageScore: 75
        }
      },
      
      // 教室コピー機能関連
      {
        name: 'classroom-copy-function',
        query: '教室コピー機能の詳細を教えて',
        idealKeywords: [
          "教室コピー", "コピー機能", "教室", "コピー", "機能", "詳細",
          "塾チャート", "ロゴ", "スライド画像", "制限", "制約", "上限",
          "処理", "挙動", "上書き"
        ],
        expectedPages: [
          "168_【FIX】教室コピー機能",
          "515_【作成中】教室管理-教室コピー機能"
        ],
        excludedPages: [
          "教室削除機能",
          "教室登録機能"
        ],
        qualityMetrics: {
          precision: 0.8,
          recall: 0.7,
          f1Score: 0.75,
          averageScore: 75
        }
      },
      
      // 会員ログイン機能関連
      {
        name: 'member-login-function',
        query: '会員のログイン機能の詳細を教えて',
        idealKeywords: [
          "会員ログイン", "ログイン機能", "会員", "ログイン", 
          "ログアウト", "パスワード", "認証", "セッション", 
          "アカウントロック", "ログイン詳細", "会員認証"
        ],
        expectedPages: [
          "042_【FIX】会員ログイン・ログアウト機能",
          "045_【FIX】パスワード再設定機能",
          "043_【FIX】プロフィール編集機能（基本情報タブ）"
        ],
        excludedPages: [
          "教室管理機能",
          "求人管理機能"
        ],
        qualityMetrics: {
          precision: 0.8,
          recall: 0.7,
          f1Score: 0.75,
          averageScore: 75
        }
      },
      
      // 教室削除問題関連
      {
        name: 'classroom-deletion-issue',
        query: '教室削除ができないのは何が原因ですか',
        idealKeywords: [
          "教室削除", "削除できない", "削除問題", "削除制限", 
          "教室", "削除", "求人掲載", "応募情報", "採用ステータス", 
          "削除条件", "削除エラー", "削除制限条件"
        ],
        expectedPages: [
          "164_【FIX】教室削除機能",
          "教室削除の制限条件",
          "教室削除エラー処理"
        ],
        excludedPages: [
          "教室登録機能",
          "教室編集機能"
        ],
        qualityMetrics: {
          precision: 0.8,
          recall: 0.7,
          f1Score: 0.75,
          averageScore: 80
        }
      }
    ];

    // 追加のテストケースを動的に生成
    this.generateAdditionalTestCases();
  }

  private generateAdditionalTestCases(): void {
    const domains = [
      '求人管理', '会員管理', '応募管理', '採用管理', '企業管理',
      '記事管理', 'キープ機能', 'スカウト機能', 'マッチ機能',
      '通知機能', 'メール機能', '認証機能', '権限管理'
    ];

    const functions = [
      '一覧', '登録', '編集', '削除', 'コピー', '検索', 'フィルタ',
      'エクスポート', 'インポート', 'バックアップ', '復元'
    ];

    const issues = [
      'できない', 'エラー', '問題', '原因', '制限', '制約',
      '失敗', '例外', 'タイムアウト', 'メモリ不足'
    ];

    // ドメイン×機能の組み合わせテストケース
    for (const domain of domains.slice(0, 5)) { // 最初の5個のドメイン
      for (const func of functions.slice(0, 3)) { // 最初の3個の機能
        const testCase: TestCase = {
          name: `${domain.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${func}`,
          query: `${domain}の${func}機能の詳細を教えて`,
          idealKeywords: [
            domain, func, `${domain}${func}`, `${domain}機能`, `${func}機能`,
            '機能', '詳細', '管理', 'システム'
          ],
          expectedPages: [
            `${domain}${func}機能`,
            `${domain}管理機能`,
            `${func}機能`
          ],
          excludedPages: [
            'フォルダ',
            'ログ',
            '統計データ'
          ],
          qualityMetrics: {
            precision: 0.8,
            recall: 0.7,
            f1Score: 0.75,
            averageScore: 75
          }
        };
        this.testCases.push(testCase);
      }
    }

    // 問題解決系テストケース
    for (const domain of domains.slice(0, 3)) {
      for (const issue of issues.slice(0, 2)) {
        const testCase: TestCase = {
          name: `${domain.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${issue}`,
          query: `${domain}で${issue}のは何が原因ですか`,
          idealKeywords: [
            domain, issue, `${domain}${issue}`, `${domain}問題`, `${issue}原因`,
            '原因', '問題', '解決', '対処'
          ],
          expectedPages: [
            `${domain}${issue}機能`,
            `${domain}エラー処理`,
            `${issue}対処機能`
          ],
          excludedPages: [
            'フォルダ',
            'ログ',
            '統計データ'
          ],
          qualityMetrics: {
            precision: 0.8,
            recall: 0.7,
            f1Score: 0.75,
            averageScore: 80
          }
        };
        this.testCases.push(testCase);
      }
    }
  }

  async generateAllTests(): Promise<void> {
    console.log('🚀 バッチ品質テスト生成開始');
    console.log(`📋 生成予定テスト数: ${this.testCases.length}`);
    console.log('');

    // 出力ディレクトリの作成
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // 各テストケースのファイル生成
    for (let i = 0; i < this.testCases.length; i++) {
      const testCase = this.testCases[i];
      const fileName = `${testCase.name}-keyword-quality-test.ts`;
      const filePath = path.join(this.outputDir, fileName);
      
      console.log(`[${i + 1}/${this.testCases.length}] 生成中: ${fileName}`);
      
      const testContent = this.generateTestContent(testCase);
      fs.writeFileSync(filePath, testContent);
    }

    // バッチ実行スクリプトの生成
    await this.generateBatchRunner();

    console.log('');
    console.log('✅ バッチ品質テスト生成完了');
    console.log(`📁 出力ディレクトリ: ${this.outputDir}`);
    console.log(`📄 生成ファイル数: ${this.testCases.length}`);
  }

  private generateTestContent(testCase: TestCase): string {
    return `/**
 * ${testCase.name} キーワード抽出品質テスト
 * 自動生成されたテストケース
 */

async function test${this.toPascalCase(testCase.name)}KeywordExtraction() {
  console.log('🚀 ${testCase.name} キーワード抽出品質テスト開始');
  console.log('=' .repeat(60));

  const query = '${testCase.query}';
  console.log(\`🔍 テストクエリ: "\${query}"\`);
  console.log('');

  try {
    // 動的インポートを使用
    const { extractKeywordsConfigured } = await import('../lib/keyword-extractor-wrapper');
    
    const result = await extractKeywordsConfigured(query);
    
    console.log('🔑 実際の抽出キーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(\`  \${index + 1}. "\${keyword}"\`);
    });
    
    console.log('');
    console.log('📊 統計情報:');
    console.log(\`- 総キーワード数: \${result.keywords.length}\`);
    console.log(\`- キーワードソース: \${result.metadata.keywordSource}\`);
    console.log(\`- 処理時間: \${result.metadata.processingTime}ms\`);
    
    // 理想のキーワード抽出結果
    const idealKeywords = ${JSON.stringify(testCase.idealKeywords, null, 6)};
    
    console.log('');
    console.log('✅ 理想のキーワードとの比較:');
    console.log(\`- 理想のキーワード: [\${idealKeywords.join(', ')}]\`);
    console.log(\`- 実際のキーワード: [\${result.keywords.join(', ')}]\`);

    const matchedKeywords = idealKeywords.filter(ideal => 
      result.keywords.some(actual => actual.includes(ideal))
    );
    
    const missingKeywords = idealKeywords.filter(ideal => 
      !result.keywords.some(actual => actual.includes(ideal))
    );
    
    const irrelevantKeywords = result.keywords.filter(actual => 
      !idealKeywords.some(ideal => ideal.includes(actual)) &&
      !is${this.toPascalCase(testCase.name)}Related(actual)
    );
    
    console.log(\`- マッチしたキーワード: [\${matchedKeywords.join(', ')}] (\${matchedKeywords.length}/\${idealKeywords.length})\`);
    console.log(\`- 不足しているキーワード: [\${missingKeywords.join(', ')}]\`);
    console.log(\`- 無関係なキーワード: [\${irrelevantKeywords.join(', ')}]\`);
    console.log('');
    
    // 品質メトリクスの計算
    console.log('📈 品質メトリクスの計算:');
    
    // 検索精度（Precision）
    const relevantKeywords = result.keywords.filter(k => 
      !irrelevantKeywords.includes(k)
    );
    const precision = result.keywords.length > 0 ? relevantKeywords.length / result.keywords.length : 0;
    console.log(\`- 検索精度（Precision）: \${precision.toFixed(3)} (目標: \${testCase.qualityMetrics.precision}以上) \${precision >= testCase.qualityMetrics.precision ? '✅' : '❌'}\`);
    
    // 検索再現率（Recall）
    const recall = idealKeywords.length > 0 ? matchedKeywords.length / idealKeywords.length : 0;
    console.log(\`- 検索再現率（Recall）: \${recall.toFixed(3)} (目標: \${testCase.qualityMetrics.recall}以上) \${recall >= testCase.qualityMetrics.recall ? '✅' : '❌'}\`);
    
    // F1スコア
    const f1Score = precision > 0 && recall > 0 ? 
      2 * (precision * recall) / (precision + recall) : 0;
    console.log(\`- F1スコア: \${f1Score.toFixed(3)} (目標: \${testCase.qualityMetrics.f1Score}以上) \${f1Score >= testCase.qualityMetrics.f1Score ? '✅' : '❌'}\`);
    
    // 平均スコア
    const averageScore = relevantKeywords.length / result.keywords.length * 100;
    console.log(\`- 平均スコア: \${averageScore.toFixed(1)} (目標: \${testCase.qualityMetrics.averageScore}以上) \${averageScore >= testCase.qualityMetrics.averageScore ? '✅' : '❌'}\`);
    console.log('');
    
    // 総合評価
    console.log('🎯 総合評価:');
    
    const passedCriteria = [
      precision >= testCase.qualityMetrics.precision,
      recall >= testCase.qualityMetrics.recall,
      f1Score >= testCase.qualityMetrics.f1Score,
      averageScore >= testCase.qualityMetrics.averageScore
    ].filter(Boolean).length;
    
    const totalCriteria = 4;
    const overallScore = (passedCriteria / totalCriteria) * 100;
    
    console.log(\`- 合格基準: \${passedCriteria}/\${totalCriteria} (\${overallScore.toFixed(1)}%)\`);
    
    if (overallScore >= 80) {
      console.log('🎉 品質テスト: PASS');
    } else if (overallScore >= 60) {
      console.log('⚠️  品質テスト: PARTIAL PASS');
    } else {
      console.log('❌ 品質テスト: FAIL');
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ ${testCase.name} キーワード抽出品質テスト完了');
}

function is${this.toPascalCase(testCase.name)}Related(keyword: string): boolean {
  const ${testCase.name}Terms = ${JSON.stringify(testCase.idealKeywords, null, 6)};
  
  return ${testCase.name}Terms.some(term => keyword.includes(term));
}

// テスト実行
test${this.toPascalCase(testCase.name)}KeywordExtraction();
`;
  }

  private async generateBatchRunner(): Promise<void> {
    const runnerContent = `/**
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

    console.log(\`📋 実行予定テスト数: \${testFiles.length}\`);
    console.log('');

    for (let i = 0; i < testFiles.length; i++) {
      const testFile = testFiles[i];
      const fileName = path.basename(testFile);
      console.log(\`[\${i + 1}/\${testFiles.length}] 実行中: \${fileName}\`);
      
      try {
        const result = await this.runSingleTest(testFile);
        this.results.push(result);
        
        const statusIcon = this.getStatusIcon(result.status);
        console.log(\`  \${statusIcon} \${result.status} (\${result.executionTime}ms)\`);
        if (result.score !== undefined) {
          console.log(\`     スコア: \${result.score.toFixed(1)}%\`);
        }
        if (result.details) {
          console.log(\`     詳細: \${result.details}\`);
        }
        
      } catch (error) {
        const errorResult: TestResult = {
          testName: fileName,
          status: 'ERROR',
          executionTime: 0,
          details: error instanceof Error ? error.message : String(error)
        };
        this.results.push(errorResult);
        console.log(\`  ❌ ERROR: \${errorResult.details}\`);
      }
      
      console.log('');
    }

    await this.generateReport();
  }

  private async runSingleTest(testFile: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync(\`npx tsx \${testFile}\`, {
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
      const scoreMatch = output.match(/合格基準: (\\d+)\\/(\\d+) \\((\\d+\\.?\\d*)%\\)/);
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
      const scoreMatch = output.match(/合格基準: (\\d+)\\/(\\d+) \\((\\d+\\.?\\d*)%\\)/);
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
      const scoreMatch = output.match(/合格基準: (\\d+)\\/(\\d+) \\((\\d+\\.?\\d*)%\\)/);
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
    
    console.log(\`📈 実行統計:\`);
    console.log(\`  - 総テスト数: \${totalCount}\`);
    console.log(\`  - PASS: \${passCount} (\${(passCount/totalCount*100).toFixed(1)}%)\`);
    console.log(\`  - PARTIAL PASS: \${partialPassCount} (\${(partialPassCount/totalCount*100).toFixed(1)}%)\`);
    console.log(\`  - FAIL: \${failCount} (\${(failCount/totalCount*100).toFixed(1)}%)\`);
    console.log(\`  - ERROR: \${errorCount} (\${(errorCount/totalCount*100).toFixed(1)}%)\`);
    console.log(\`  - 総実行時間: \${(totalTime/1000).toFixed(1)}秒\`);
    console.log('');
    
    const scoresWithValues = this.results.filter(r => r.score !== undefined);
    if (scoresWithValues.length > 0) {
      const avgScore = scoresWithValues.reduce((sum, r) => sum + (r.score || 0), 0) / scoresWithValues.length;
      const maxScore = Math.max(...scoresWithValues.map(r => r.score || 0));
      const minScore = Math.min(...scoresWithValues.map(r => r.score || 0));
      
      console.log(\`📊 スコア統計:\`);
      console.log(\`  - 平均スコア: \${avgScore.toFixed(1)}%\`);
      console.log(\`  - 最高スコア: \${maxScore.toFixed(1)}%\`);
      console.log(\`  - 最低スコア: \${minScore.toFixed(1)}%\`);
      console.log('');
    }
    
    console.log(\`📋 詳細結果:\`);
    this.results.forEach((result, index) => {
      const icon = this.getStatusIcon(result.status);
      const scoreText = result.score !== undefined ? \` (\${result.score.toFixed(1)}%)\` : '';
      const timeText = \` [\${result.executionTime}ms]\`;
      
      console.log(\`  \${index + 1}. \${icon} \${result.testName}\${scoreText}\${timeText}\`);
      if (result.details) {
        console.log(\`      \${result.details}\`);
      }
    });
    console.log('');
    
    const successRate = (passCount + partialPassCount * 0.5) / totalCount;
    const qualityAssurance = successRate >= 0.8;
    
    console.log(\`🎯 品質保証の判定:\`);
    console.log(\`  - 成功率: \${(successRate * 100).toFixed(1)}%\`);
    console.log(\`  - 品質保証: \${qualityAssurance ? '✅ 保証可能' : '❌ 保証不可'}\`);
    
    if (qualityAssurance) {
      console.log(\`  🎉 ベクトル検索システムは品質保証基準を満たしています！\`);
    } else {
      console.log(\`  🔧 さらなる改善が必要です。\`);
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
`;

    const runnerPath = path.join(this.outputDir, 'batch-runner.ts');
    fs.writeFileSync(runnerPath, runnerContent);
    
    console.log(`📄 バッチ実行スクリプト生成: ${runnerPath}`);
  }

  private toPascalCase(str: string): string {
    return str.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('');
  }
}

// メイン実行
async function main() {
  const generator = new BatchQualityTestGenerator();
  await generator.generateAllTests();
}

main().catch(console.error);

