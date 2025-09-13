#!/usr/bin/env tsx
// モック環境でのRAG評価テスト

import { config } from 'dotenv';
config({ path: '.env' });

console.log('🚀 モック環境でのRAG評価テストを開始します...\n');

// モック環境用の簡易評価質問
const mockEvaluationQuestions = [
  {
    id: 'mock-1',
    question: '求人詳細機能の仕様について教えてください',
    expectedAnswer: '求人詳細機能は、求職者に求人情報を詳細に伝えるための画面です',
    expectedTopics: ['求人情報', '表示', '応募']
  },
  {
    id: 'mock-2',
    question: 'ログイン認証の仕組みはどうなっていますか？',
    expectedAnswer: 'Firebase Authenticationを使用してGoogleアカウントでログイン',
    expectedTopics: ['Firebase', 'Google', '認証']
  }
];

// モック回答を生成
function generateMockAnswer(question: string): {
  answer: string;
  sources: Array<{ title: string; url: string }>;
} {
  if (question.includes('求人詳細')) {
    return {
      answer: '求人詳細機能は、求職者に求人情報を詳細に伝えるための重要な画面です。主な構成要素として、求人情報の表示エリア、応募ボタン、関連求人の表示セクションがあります。',
      sources: [
        { title: '[PROJ-123] 求人詳細画面仕様書', url: 'https://example.atlassian.net/wiki/spaces/PROJ/pages/123456' },
        { title: '[ARCH-45] 求人データモデル定義', url: 'https://example.atlassian.net/wiki/spaces/ARCH/pages/45678' }
      ]
    };
  } else if (question.includes('ログイン認証')) {
    return {
      answer: 'ログイン認証は、Firebase Authenticationを使用してGoogleアカウントでのシングルサインオンを実装しています。ユーザーは既存のGoogleアカウントを使用して簡単にログインできます。',
      sources: [
        { title: '[AUTH-001] 認証機能仕様書', url: 'https://example.atlassian.net/wiki/spaces/AUTH/pages/11111' }
      ]
    };
  } else {
    return {
      answer: 'この質問に関する情報が見つかりませんでした。',
      sources: []
    };
  }
}

// 簡易評価関数
function evaluateMockAnswer(
  question: string,
  answer: string,
  sources: Array<{ title: string; url: string }>,
  expectedTopics: string[]
): {
  score: number;
  details: {
    faithfulness: number;
    relevance: number;
    referenceAccuracy: number;
    completeness: number;
    clarity: number;
  };
} {
  const answerLower = answer.toLowerCase();
  const topicsFound = expectedTopics.filter(topic => 
    answerLower.includes(topic.toLowerCase())
  );
  
  const topicCoverage = topicsFound.length / expectedTopics.length;
  
  const details = {
    faithfulness: sources.length > 0 ? 4 : 2,
    relevance: topicCoverage > 0.7 ? 4 : topicCoverage > 0.4 ? 3 : 2,
    referenceAccuracy: sources.length > 0 ? 4 : 2,
    completeness: answer.length > 50 ? 4 : 3,
    clarity: answer.includes('。') ? 4 : 3
  };
  
  const score = Object.values(details).reduce((sum, val) => sum + val, 0) / Object.values(details).length;
  
  return { score, details };
}

// メイン実行関数
async function runMockEvaluation() {
  console.log('📋 モックデータを使用した評価を実行します\n');
  
  const results = [];
  
  for (const q of mockEvaluationQuestions) {
    console.log(`\n評価中: ${q.question}`);
    
    // モック回答を生成
    const { answer, sources } = generateMockAnswer(q.question);
    console.log(`  回答: ${answer.substring(0, 80)}...`);
    console.log(`  参照元: ${sources.length}件`);
    
    // 評価
    const evaluation = evaluateMockAnswer(q.question, answer, sources, q.expectedTopics);
    console.log(`  平均スコア: ${evaluation.score.toFixed(2)}/5.0`);
    console.log(`  合否: ${evaluation.score >= 3.5 ? '✅ 合格' : '❌ 不合格'}`);
    
    results.push({
      question: q.question,
      answer,
      sources,
      evaluation
    });
  }
  
  // サマリー表示
  console.log('\n📊 評価結果サマリー');
  console.log('='.repeat(50));
  
  const totalScore = results.reduce((sum, r) => sum + r.evaluation.score, 0);
  const avgScore = totalScore / results.length;
  const passingCount = results.filter(r => r.evaluation.score >= 3.5).length;
  
  console.log(`総質問数: ${results.length}`);
  console.log(`合格数: ${passingCount}`);
  console.log(`不合格数: ${results.length - passingCount}`);
  console.log(`全体平均スコア: ${avgScore.toFixed(2)}/5.0`);
  console.log(`合格率: ${((passingCount / results.length) * 100).toFixed(1)}%`);
  
  // 評価基準別の平均
  console.log('\n📋 評価基準別平均スコア:');
  const criteriaAverages: any = {
    faithfulness: 0,
    relevance: 0,
    referenceAccuracy: 0,
    completeness: 0,
    clarity: 0
  };
  
  results.forEach(r => {
    Object.entries(r.evaluation.details).forEach(([key, value]) => {
      criteriaAverages[key] += value;
    });
  });
  
  Object.entries(criteriaAverages).forEach(([key, total]) => {
    const avg = (total as number) / results.length;
    console.log(`  ${key}: ${avg.toFixed(2)}/5.0`);
  });
  
  console.log('\n✅ モック評価が完了しました！');
  console.log('\n⚠️  注意: これはモックデータを使用した限定的な評価です。');
  console.log('本格的な評価には実際のConfluenceデータとの連携が必要です。');
}

// 実行
runMockEvaluation().catch(console.error);
