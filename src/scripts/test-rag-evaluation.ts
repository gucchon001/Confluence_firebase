#!/usr/bin/env tsx
// RAG評価テスト実行スクリプト

import { config } from 'dotenv';
config({ path: '.env' });

import { runFullEvaluation } from '../tests/rag-evaluation/run-evaluation';
import { generateHTMLReport, saveReport } from '../tests/rag-evaluation/generate-report';

console.log('🚀 RAG評価テストを開始します...\n');
console.log('環境変数の確認:');
console.log('- GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ 設定済み' : '❌ 未設定');
console.log('- CONFLUENCE_BASE_URL:', process.env.CONFLUENCE_BASE_URL ? '✅ 設定済み' : '❌ 未設定');
console.log('- CONFLUENCE_API_TOKEN:', process.env.CONFLUENCE_API_TOKEN ? '✅ 設定済み' : '❌ 未設定');
console.log('');

// 注意事項
console.log('⚠️  注意事項:');
console.log('1. このテストは実際のAPIを使用するため、APIの利用制限に注意してください');
console.log('2. モック環境では限定的な評価となります');
console.log('3. 本格的な評価には実際のConfluenceドキュメントが必要です\n');

// モックモードかどうかの確認
const isUsingMockData = !process.env.CONFLUENCE_API_TOKEN || process.env.USE_MOCK_DATA === 'true';

if (isUsingMockData) {
  console.log('📋 モックモードで実行します（実際のConfluenceデータは使用しません）\n');
} else {
  console.log('📋 実際のConfluenceデータを使用して評価を実行します\n');
}

// 評価を実行
async function main() {
  try {
    // テスト用のユーザーID
    const testUserId = 'rag-evaluation-test-user';
    
    // 評価する質問数（開発中は少なめに設定）
    const questionLimit = isUsingMockData ? 5 : 10;
    
    console.log(`評価する質問数: ${questionLimit}\n`);
    
    // 評価実行
    const { results, summary } = await runFullEvaluation(testUserId, questionLimit);
    
    // HTMLレポートを生成
    console.log('\n📄 評価レポートを生成中...');
    const htmlReport = generateHTMLReport(results, summary);
    
    // レポートを保存
    const reportPath = saveReport(htmlReport);
    console.log(`✅ レポートを保存しました: ${reportPath}`);
    
    // 結果に基づいた推奨事項
    console.log('\n🎯 推奨事項:');
    
    if (summary.overallAverage >= 4.0) {
      console.log('✨ 素晴らしいパフォーマンスです！RAGシステムは高品質な回答を生成しています。');
    } else if (summary.overallAverage >= 3.5) {
      console.log('✅ 良好なパフォーマンスです。いくつかの改善点はありますが、基準を満たしています。');
    } else if (summary.overallAverage >= 3.0) {
      console.log('⚠️  改善の余地があります。特に低スコアの評価基準に注目してください。');
    } else {
      console.log('❌ 大幅な改善が必要です。RAGシステムの設定やプロンプトの見直しを検討してください。');
    }
    
    // 特に改善が必要な領域
    const lowScoreCriteria = Object.entries(summary.criteriaAverages)
      .filter(([_, score]) => score < 3.0)
      .map(([criteria, score]) => ({ criteria, score }));
    
    if (lowScoreCriteria.length > 0) {
      console.log('\n📍 特に改善が必要な領域:');
      lowScoreCriteria.forEach(({ criteria, score }) => {
        console.log(`  - ${criteria}: ${score.toFixed(2)}/5.0`);
      });
    }
    
    // カテゴリ別の推奨事項
    const lowScoreCategories = Object.entries(summary.categoryScores)
      .filter(([_, scores]) => {
        const avg = (scores as number[]).reduce((sum, s) => sum + s, 0) / (scores as number[]).length;
        return avg < 3.0;
      })
      .map(([category]) => category);
    
    if (lowScoreCategories.length > 0) {
      console.log('\n📍 改善が必要なカテゴリ:');
      lowScoreCategories.forEach(category => {
        console.log(`  - ${category}`);
      });
    }
    
    console.log('\n✅ 評価が完了しました！詳細はHTMLレポートをご確認ください。');
    
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// エラーハンドリング
process.on('unhandledRejection', (error) => {
  console.error('未処理のエラー:', error);
  process.exit(1);
});

// メイン関数を実行
main();
