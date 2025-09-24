/**
 * ベクトル検索テスト結果のレポート生成スクリプト
 * 
 * このスクリプトは以下の機能を提供します：
 * 1. 複数のテスト結果を統合したレポート生成
 * 2. HTML形式での詳細レポート出力
 * 3. JSON形式でのデータ出力
 * 4. グラフとチャートの生成
 * 5. 改善提案の自動生成
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

interface TestResult {
  testName: string;
  timestamp: string;
  query: string;
  totalResults: number;
  precision: number;
  recall: number;
  f1Score: number;
  averageScore: number;
  averageDistance?: number;
  issues: string[];
  topResults: Array<{
    title: string;
    score: number;
    distance?: number;
    labels: string[];
  }>;
}

interface ConsolidatedReport {
  testRunId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  overallMetrics: {
    averagePrecision: number;
    averageRecall: number;
    averageF1Score: number;
    averageScore: number;
  };
  categoryBreakdown: Array<{
    category: string;
    testCount: number;
    averagePrecision: number;
    averageRecall: number;
    averageF1Score: number;
  }>;
  commonIssues: Array<{
    issue: string;
    frequency: number;
    affectedTests: string[];
  }>;
  recommendations: string[];
  testResults: TestResult[];
}

/**
 * HTMLレポートを生成する
 */
function generateHTMLReport(report: ConsolidatedReport): string {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ベクトル検索品質テストレポート</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #007acc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #007acc;
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            color: #666;
            margin: 10px 0 0 0;
            font-size: 1.1em;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 2em;
        }
        .summary-card p {
            margin: 0;
            opacity: 0.9;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #007acc;
        }
        .metric-card h4 {
            margin: 0 0 10px 0;
            color: #007acc;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #007acc;
            padding-bottom: 10px;
        }
        .test-result {
            background: #f8f9fa;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 8px;
            border-left: 4px solid #28a745;
        }
        .test-result.failed {
            border-left-color: #dc3545;
        }
        .test-result h3 {
            margin: 0 0 15px 0;
            color: #333;
        }
        .test-metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
        }
        .test-metric {
            text-align: center;
            padding: 10px;
            background: white;
            border-radius: 5px;
        }
        .test-metric .label {
            font-size: 0.9em;
            color: #666;
            margin-bottom: 5px;
        }
        .test-metric .value {
            font-size: 1.5em;
            font-weight: bold;
            color: #333;
        }
        .issues {
            margin-top: 15px;
        }
        .issues h4 {
            color: #dc3545;
            margin: 0 0 10px 0;
        }
        .issue-list {
            list-style: none;
            padding: 0;
        }
        .issue-list li {
            background: #f8d7da;
            color: #721c24;
            padding: 8px 12px;
            margin-bottom: 5px;
            border-radius: 4px;
        }
        .recommendations {
            background: #d1ecf1;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #17a2b8;
        }
        .recommendations h3 {
            color: #17a2b8;
            margin: 0 0 15px 0;
        }
        .recommendations ul {
            margin: 0;
            padding-left: 20px;
        }
        .recommendations li {
            margin-bottom: 8px;
        }
        .top-results {
            margin-top: 15px;
        }
        .top-results h4 {
            margin: 0 0 10px 0;
            color: #333;
        }
        .result-item {
            background: white;
            padding: 10px;
            margin-bottom: 8px;
            border-radius: 4px;
            border-left: 3px solid #007acc;
        }
        .result-title {
            font-weight: bold;
            margin-bottom: 5px;
        }
        .result-meta {
            font-size: 0.9em;
            color: #666;
        }
        .status-pass {
            color: #28a745;
            font-weight: bold;
        }
        .status-fail {
            color: #dc3545;
            font-weight: bold;
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 ベクトル検索品質テストレポート</h1>
            <p>テスト実行ID: ${report.testRunId}</p>
            <p>実行日時: ${new Date(report.timestamp).toLocaleString('ja-JP')}</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>${report.totalTests}</h3>
                <p>総テスト数</p>
            </div>
            <div class="summary-card">
                <h3>${report.passedTests}</h3>
                <p>合格テスト数</p>
            </div>
            <div class="summary-card">
                <h3>${report.failedTests}</h3>
                <p>不合格テスト数</p>
            </div>
            <div class="summary-card">
                <h3>${((report.passedTests / report.totalTests) * 100).toFixed(1)}%</h3>
                <p>合格率</p>
            </div>
        </div>

        <div class="metrics">
            <div class="metric-card">
                <h4>平均精度</h4>
                <div class="metric-value">${report.overallMetrics.averagePrecision.toFixed(3)}</div>
            </div>
            <div class="metric-card">
                <h4>平均再現率</h4>
                <div class="metric-value">${report.overallMetrics.averageRecall.toFixed(3)}</div>
            </div>
            <div class="metric-card">
                <h4>平均F1スコア</h4>
                <div class="metric-value">${report.overallMetrics.averageF1Score.toFixed(3)}</div>
            </div>
            <div class="metric-card">
                <h4>平均スコア</h4>
                <div class="metric-value">${report.overallMetrics.averageScore.toFixed(2)}</div>
            </div>
        </div>

        <div class="section">
            <h2>📊 カテゴリ別分析</h2>
            ${report.categoryBreakdown.map(category => `
                <div class="metric-card">
                    <h4>${category.category}</h4>
                    <p>テスト数: ${category.testCount}件</p>
                    <p>平均精度: ${category.averagePrecision.toFixed(3)}</p>
                    <p>平均再現率: ${category.averageRecall.toFixed(3)}</p>
                    <p>平均F1スコア: ${category.averageF1Score.toFixed(3)}</p>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>🧪 テスト結果詳細</h2>
            ${report.testResults.map(test => `
                <div class="test-result ${test.issues.length > 0 ? 'failed' : ''}">
                    <h3>${test.testName}: "${test.query}"</h3>
                    <div class="test-metrics">
                        <div class="test-metric">
                            <div class="label">精度</div>
                            <div class="value">${test.precision.toFixed(3)}</div>
                        </div>
                        <div class="test-metric">
                            <div class="label">再現率</div>
                            <div class="value">${test.recall.toFixed(3)}</div>
                        </div>
                        <div class="test-metric">
                            <div class="label">F1スコア</div>
                            <div class="value">${test.f1Score.toFixed(3)}</div>
                        </div>
                        <div class="test-metric">
                            <div class="label">平均スコア</div>
                            <div class="value">${test.averageScore.toFixed(2)}</div>
                        </div>
                        <div class="test-metric">
                            <div class="label">結果数</div>
                            <div class="value">${test.totalResults}</div>
                        </div>
                        <div class="test-metric">
                            <div class="label">ステータス</div>
                            <div class="value ${test.issues.length === 0 ? 'status-pass' : 'status-fail'}">
                                ${test.issues.length === 0 ? '✅ 合格' : '❌ 不合格'}
                            </div>
                        </div>
                    </div>
                    
                    ${test.issues.length > 0 ? `
                        <div class="issues">
                            <h4>問題点</h4>
                            <ul class="issue-list">
                                ${test.issues.map(issue => `<li>${issue}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    
                    <div class="top-results">
                        <h4>上位検索結果</h4>
                        ${test.topResults.slice(0, 5).map(result => `
                            <div class="result-item">
                                <div class="result-title">${result.title}</div>
                                <div class="result-meta">
                                    スコア: ${result.score.toFixed(2)} | 
                                    距離: ${result.distance?.toFixed(4) || 'N/A'} | 
                                    ラベル: ${result.labels.join(', ')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>⚠️ 共通問題点</h2>
            ${report.commonIssues.length > 0 ? `
                ${report.commonIssues.map(issue => `
                    <div class="metric-card">
                        <h4>${issue.issue}</h4>
                        <p>発生頻度: ${issue.frequency}回</p>
                        <p>影響を受けたテスト: ${issue.affectedTests.join(', ')}</p>
                    </div>
                `).join('')}
            ` : '<p>共通の問題点はありません。</p>'}
        </div>

        <div class="recommendations">
            <h3>💡 改善提案</h3>
            <ul>
                ${report.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>

        <div class="footer">
            <p>このレポートは自動生成されました - ${new Date().toLocaleString('ja-JP')}</p>
        </div>
    </div>
</body>
</html>`;
  
  return html;
}

/**
 * 統合レポートを生成する
 */
function generateConsolidatedReport(testResults: TestResult[]): ConsolidatedReport {
  const testRunId = `test_${Date.now()}`;
  const timestamp = new Date().toISOString();
  
  // 全体の統計を計算
  const totalTests = testResults.length;
  const passedTests = testResults.filter(t => t.issues.length === 0).length;
  const failedTests = totalTests - passedTests;
  
  const averagePrecision = testResults.reduce((sum, t) => sum + t.precision, 0) / totalTests;
  const averageRecall = testResults.reduce((sum, t) => sum + t.recall, 0) / totalTests;
  const averageF1Score = testResults.reduce((sum, t) => sum + t.f1Score, 0) / totalTests;
  const averageScore = testResults.reduce((sum, t) => sum + t.averageScore, 0) / totalTests;
  
  // カテゴリ別の分析
  const categoryMap = new Map<string, TestResult[]>();
  testResults.forEach(test => {
    const category = test.query.includes('教室管理') ? '教室管理' :
                    test.query.includes('教室コピー') ? '教室コピー' :
                    test.query.includes('オファー') ? 'オファー機能' : 'その他';
    
    if (!categoryMap.has(category)) {
      categoryMap.set(category, []);
    }
    categoryMap.get(category)!.push(test);
  });
  
  const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, tests]) => ({
    category,
    testCount: tests.length,
    averagePrecision: tests.reduce((sum, t) => sum + t.precision, 0) / tests.length,
    averageRecall: tests.reduce((sum, t) => sum + t.recall, 0) / tests.length,
    averageF1Score: tests.reduce((sum, t) => sum + t.f1Score, 0) / tests.length
  }));
  
  // 共通問題点の分析
  const allIssues = testResults.flatMap(t => t.issues);
  const issueCounts = new Map<string, { frequency: number, affectedTests: string[] }>();
  
  allIssues.forEach(issue => {
    const count = issueCounts.get(issue) || { frequency: 0, affectedTests: [] };
    count.frequency++;
    issueCounts.set(issue, count);
  });
  
  testResults.forEach(test => {
    test.issues.forEach(issue => {
      const count = issueCounts.get(issue);
      if (count && !count.affectedTests.includes(test.testName)) {
        count.affectedTests.push(test.testName);
      }
    });
  });
  
  const commonIssues = Array.from(issueCounts.entries())
    .map(([issue, data]) => ({
      issue,
      frequency: data.frequency,
      affectedTests: data.affectedTests
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);
  
  // 改善提案の生成
  const recommendations: string[] = [];
  
  if (averagePrecision < 0.8) {
    recommendations.push('検索精度の向上: キーワード抽出アルゴリズムの改善を検討してください');
  }
  
  if (averageRecall < 0.7) {
    recommendations.push('検索再現率の向上: より多くの関連ページを検索結果に含めるよう調整してください');
  }
  
  if (averageF1Score < 0.75) {
    recommendations.push('F1スコアの向上: 精度と再現率のバランスを最適化してください');
  }
  
  if (averageScore < 70) {
    recommendations.push('スコアリングの改善: 検索結果のスコア計算ロジックを見直してください');
  }
  
  const lowPrecisionTests = testResults.filter(t => t.precision < 0.6);
  if (lowPrecisionTests.length > 0) {
    recommendations.push(`低精度テストの改善: ${lowPrecisionTests.map(t => t.testName).join(', ')}の検索精度を向上させてください`);
  }
  
  const highFalsePositiveTests = testResults.filter(t => t.precision < 0.5);
  if (highFalsePositiveTests.length > 0) {
    recommendations.push('偽陽性の削減: 関連性の低いページを検索結果から除外するフィルタリングを強化してください');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('全体的に良好な性能を維持しています。継続的な監視を続けてください');
  }
  
  return {
    testRunId,
    timestamp,
    totalTests,
    passedTests,
    failedTests,
    overallMetrics: {
      averagePrecision,
      averageRecall,
      averageF1Score,
      averageScore
    },
    categoryBreakdown,
    commonIssues,
    recommendations,
    testResults
  };
}

/**
 * レポートをファイルに保存する
 */
async function saveReport(report: ConsolidatedReport, outputDir: string = './reports'): Promise<void> {
  // 出力ディレクトリを作成
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseFileName = `vector-search-report-${timestamp}`;
  
  // HTMLレポートを生成・保存
  const htmlReport = generateHTMLReport(report);
  const htmlPath = path.join(outputDir, `${baseFileName}.html`);
  fs.writeFileSync(htmlPath, htmlReport, 'utf8');
  
  // JSONレポートを保存
  const jsonPath = path.join(outputDir, `${baseFileName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  
  // サマリーレポートを保存
  const summaryReport = `
ベクトル検索品質テストレポート
===============================

テスト実行ID: ${report.testRunId}
実行日時: ${new Date(report.timestamp).toLocaleString('ja-JP')}

📊 サマリー
-----------
総テスト数: ${report.totalTests}
合格テスト数: ${report.passedTests}
不合格テスト数: ${report.failedTests}
合格率: ${((report.passedTests / report.totalTests) * 100).toFixed(1)}%

📈 全体メトリクス
-----------------
平均精度: ${report.overallMetrics.averagePrecision.toFixed(3)}
平均再現率: ${report.overallMetrics.averageRecall.toFixed(3)}
平均F1スコア: ${report.overallMetrics.averageF1Score.toFixed(3)}
平均スコア: ${report.overallMetrics.averageScore.toFixed(2)}

💡 改善提案
-----------
${report.recommendations.map(rec => `- ${rec}`).join('\n')}

📁 生成ファイル
---------------
- HTMLレポート: ${htmlPath}
- JSONデータ: ${jsonPath}
- サマリーレポート: ${path.join(outputDir, `${baseFileName}-summary.txt`)}
`;
  
  const summaryPath = path.join(outputDir, `${baseFileName}-summary.txt`);
  fs.writeFileSync(summaryPath, summaryReport, 'utf8');
  
  console.log(`\n📊 レポートが生成されました:`);
  console.log(`- HTMLレポート: ${htmlPath}`);
  console.log(`- JSONデータ: ${jsonPath}`);
  console.log(`- サマリーレポート: ${summaryPath}`);
}

/**
 * メイン関数
 */
async function generateVectorSearchReport(): Promise<void> {
  console.log('📊 ベクトル検索テストレポート生成開始');
  
  try {
    // サンプルテスト結果を作成（実際のテストから取得する場合は、テスト実行結果を渡す）
    const sampleTestResults: TestResult[] = [
      {
        testName: '教室管理検索テスト',
        timestamp: new Date().toISOString(),
        query: '教室管理の詳細は',
        totalResults: 12,
        precision: 0.833,
        recall: 0.750,
        f1Score: 0.789,
        averageScore: 78.5,
        averageDistance: 0.324,
        issues: [],
        topResults: [
          { title: '160_【FIX】教室管理機能', score: 85.2, distance: 0.234, labels: ['機能要件'] },
          { title: '161_【FIX】教室一覧閲覧機能', score: 82.1, distance: 0.267, labels: ['機能要件'] },
          { title: '162_【FIX】教室新規登録機能', score: 79.8, distance: 0.289, labels: ['機能要件'] }
        ]
      },
      {
        testName: '教室コピー検索テスト',
        timestamp: new Date().toISOString(),
        query: '教室コピー機能でコピー可能な項目は？',
        totalResults: 15,
        precision: 0.800,
        recall: 0.700,
        f1Score: 0.747,
        averageScore: 76.3,
        averageDistance: 0.298,
        issues: ['再現率が低い: 0.700 < 0.7'],
        topResults: [
          { title: '168_【FIX】教室コピー機能', score: 88.5, distance: 0.198, labels: ['機能要件'] },
          { title: '教室コピー可能項目一覧', score: 85.7, distance: 0.223, labels: ['機能要件'] },
          { title: '教室コピー処理仕様', score: 82.3, distance: 0.245, labels: ['機能要件'] }
        ]
      }
    ];
    
    // 統合レポートを生成
    const consolidatedReport = generateConsolidatedReport(sampleTestResults);
    
    // レポートを保存
    await saveReport(consolidatedReport);
    
    console.log('✅ ベクトル検索テストレポート生成完了');
    
  } catch (error) {
    console.error('❌ レポート生成エラー:', error);
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  generateVectorSearchReport();
}

export { generateConsolidatedReport, generateHTMLReport, saveReport };
