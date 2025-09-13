// RAG評価レポート生成

import { EvaluationResult } from './evaluation-criteria';
import { evaluationQuestions } from './questions';
import * as fs from 'fs';
import * as path from 'path';

export function generateHTMLReport(
  results: EvaluationResult[],
  summary: any
): string {
  const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RAG評価レポート - ${new Date().toLocaleDateString('ja-JP')}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1, h2, h3 {
            color: #2c3e50;
        }
        .summary-card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric {
            display: inline-block;
            margin: 10px 20px 10px 0;
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #3498db;
        }
        .metric-label {
            font-size: 0.9em;
            color: #666;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
            margin-top: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #34495e;
            color: white;
            font-weight: bold;
        }
        tr:hover {
            background-color: #f5f5f5;
        }
        .score {
            font-weight: bold;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .score-5 { background-color: #27ae60; color: white; }
        .score-4 { background-color: #3498db; color: white; }
        .score-3 { background-color: #f39c12; color: white; }
        .score-2 { background-color: #e74c3c; color: white; }
        .score-1 { background-color: #c0392b; color: white; }
        .pass { color: #27ae60; font-weight: bold; }
        .fail { color: #e74c3c; font-weight: bold; }
        .answer-preview {
            max-width: 400px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 0.9em;
            color: #666;
        }
        .sources {
            font-size: 0.8em;
            color: #3498db;
        }
        .chart-container {
            margin: 20px 0;
            text-align: center;
        }
        .criteria-scores {
            display: flex;
            justify-content: space-around;
            flex-wrap: wrap;
            gap: 10px;
        }
        .criteria-item {
            text-align: center;
            padding: 10px;
        }
    </style>
</head>
<body>
    <h1>🤖 RAG評価レポート</h1>
    <p>生成日時: ${new Date().toLocaleString('ja-JP')}</p>
    
    <div class="summary-card">
        <h2>📊 評価サマリー</h2>
        <div class="metric">
            <div class="metric-value">${summary.overallAverage.toFixed(2)}/5.0</div>
            <div class="metric-label">全体平均スコア</div>
        </div>
        <div class="metric">
            <div class="metric-value">${summary.passingRate.toFixed(1)}%</div>
            <div class="metric-label">合格率</div>
        </div>
        <div class="metric">
            <div class="metric-value">${summary.passingCount}/${summary.totalQuestions}</div>
            <div class="metric-label">合格数/総数</div>
        </div>
    </div>

    <div class="summary-card">
        <h2>📈 評価基準別スコア</h2>
        <div class="criteria-scores">
            ${Object.entries(summary.criteriaAverages).map(([key, value]) => `
                <div class="criteria-item">
                    <div class="metric-value">${(value as number).toFixed(2)}</div>
                    <div class="metric-label">${key}</div>
                </div>
            `).join('')}
        </div>
    </div>

    <div class="summary-card">
        <h2>📋 カテゴリ別パフォーマンス</h2>
        <table>
            <thead>
                <tr>
                    <th>カテゴリ</th>
                    <th>質問数</th>
                    <th>平均スコア</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(summary.categoryScores).map(([category, scores]) => {
                    const scoresArray = scores as number[];
                    const avg = scoresArray.reduce((sum: number, s: number) => sum + s, 0) / scoresArray.length;
                    return `
                        <tr>
                            <td>${category}</td>
                            <td>${scoresArray.length}</td>
                            <td><span class="score score-${Math.round(avg)}">${avg.toFixed(2)}</span></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>

    <h2>📝 詳細評価結果</h2>
    <table>
        <thead>
            <tr>
                <th>質問</th>
                <th>回答プレビュー</th>
                <th>忠実性</th>
                <th>関連性</th>
                <th>参照元</th>
                <th>完全性</th>
                <th>明確性</th>
                <th>平均</th>
                <th>合否</th>
            </tr>
        </thead>
        <tbody>
            ${results.map(result => {
                const isPassing = result.averageScore >= 3.5;
                const question = evaluationQuestions.find(q => q.id === result.questionId);
                return `
                    <tr>
                        <td>${result.question}</td>
                        <td class="answer-preview" title="${result.answer.replace(/"/g, '&quot;')}">${result.answer}</td>
                        <td><span class="score score-${result.criteria.faithfulness}">${result.criteria.faithfulness}</span></td>
                        <td><span class="score score-${result.criteria.relevance}">${result.criteria.relevance}</span></td>
                        <td><span class="score score-${result.criteria.referenceAccuracy}">${result.criteria.referenceAccuracy}</span></td>
                        <td><span class="score score-${result.criteria.completeness}">${result.criteria.completeness}</span></td>
                        <td><span class="score score-${result.criteria.clarity}">${result.criteria.clarity}</span></td>
                        <td><span class="score score-${Math.round(result.averageScore)}">${result.averageScore.toFixed(2)}</span></td>
                        <td class="${isPassing ? 'pass' : 'fail'}">${isPassing ? '✅ 合格' : '❌ 不合格'}</td>
                    </tr>
                `;
            }).join('')}
        </tbody>
    </table>

    <div class="summary-card" style="margin-top: 30px;">
        <h2>🎯 改善提案</h2>
        ${summary.overallAverage < 3.5 ? `
            <p>⚠️ 全体的なスコアが基準値（3.5）を下回っています。以下の改善を検討してください：</p>
            <ul>
                ${summary.criteriaAverages.faithfulness < 3 ? '<li>忠実性: ドキュメントからの情報抽出精度を向上させる</li>' : ''}
                ${summary.criteriaAverages.relevance < 3 ? '<li>関連性: 質問意図の理解と適切な回答生成を改善する</li>' : ''}
                ${summary.criteriaAverages.referenceAccuracy < 3 ? '<li>参照元: より正確な情報源の特定と提示を行う</li>' : ''}
                ${summary.criteriaAverages.completeness < 3 ? '<li>完全性: より包括的な回答を生成するようプロンプトを調整する</li>' : ''}
                ${summary.criteriaAverages.clarity < 3 ? '<li>明確性: 回答の構造化と表現を改善する</li>' : ''}
            </ul>
        ` : `
            <p>✅ 全体的に良好なパフォーマンスです！</p>
            <p>さらなる改善のために：</p>
            <ul>
                <li>継続的な評価とフィードバックループの確立</li>
                <li>エッジケースの質問に対する対応強化</li>
                <li>ドキュメントの更新に応じた定期的な再評価</li>
            </ul>
        `}
    </div>
</body>
</html>
`;

  return html;
}

// レポートをファイルに保存
export function saveReport(html: string, filename?: string): string {
  const reportDir = path.join(process.cwd(), 'rag-evaluation-reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportFilename = filename || `rag-evaluation-${new Date().toISOString().split('T')[0]}.html`;
  const reportPath = path.join(reportDir, reportFilename);
  
  fs.writeFileSync(reportPath, html, 'utf-8');
  
  return reportPath;
}
