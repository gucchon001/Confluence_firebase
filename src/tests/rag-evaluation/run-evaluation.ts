// RAG評価実行スクリプト

import { evaluationQuestions } from './questions';
import { EvaluationResult, EvaluationCriteria, calculateAverageScore, isPassingScore } from './evaluation-criteria';
import { askQuestion } from '@/app/actions';

// 模擬的な評価関数（実際の評価では人間のレビューが必要）
async function evaluateAnswer(
  question: string,
  answer: string,
  sources: Array<{ title: string; url: string }>,
  expectedTopics: string[]
): Promise<EvaluationCriteria> {
  // 自動評価のための簡易的な実装
  // 実際の評価では、人間のレビューアーが各基準を評価する必要があります
  
  const answerLower = answer.toLowerCase();
  const topicsFound = expectedTopics.filter(topic => 
    answerLower.includes(topic.toLowerCase())
  );
  
  // トピックのカバー率に基づいて評価
  const topicCoverage = topicsFound.length / expectedTopics.length;
  
  return {
    faithfulness: sources.length > 0 ? 4 : 2,  // 参照元があれば高めの評価
    relevance: topicCoverage > 0.7 ? 4 : topicCoverage > 0.4 ? 3 : 2,
    referenceAccuracy: sources.length > 0 && sources[0].url ? 4 : 2,
    completeness: topicCoverage > 0.8 ? 4 : topicCoverage > 0.5 ? 3 : 2,
    clarity: answer.length > 100 ? 4 : 3  // 詳細な回答なら高評価
  };
}

// 単一の質問を評価
async function evaluateSingleQuestion(
  questionData: typeof evaluationQuestions[0],
  userId: string
): Promise<EvaluationResult> {
  console.log(`\n評価中: ${questionData.question}`);
  
  try {
    // RAGシステムに質問を投げる
    const response = await askQuestion(questionData.question, userId);
    
    // レスポンスから回答と参照元を抽出
    const answer = response.content || '回答を生成できませんでした';
    const sources = response.sources || [];
    
    // 回答を評価
    const criteria = await evaluateAnswer(
      questionData.question,
      answer,
      sources,
      questionData.expectedTopics
    );
    
    const averageScore = calculateAverageScore(criteria);
    
    const result: EvaluationResult = {
      questionId: questionData.id,
      question: questionData.question,
      answer,
      sources,
      criteria,
      averageScore,
      comments: `自動評価完了。期待されるトピックの${Math.round((criteria.relevance / 5) * 100)}%をカバー。`,
      timestamp: new Date().toISOString()
    };
    
    console.log(`  - 平均スコア: ${averageScore.toFixed(2)}`);
    console.log(`  - 合否: ${isPassingScore(result) ? '✅ 合格' : '❌ 不合格'}`);
    
    return result;
  } catch (error) {
    console.error(`エラー: ${error}`);
    
    // エラー時のデフォルト評価結果
    return {
      questionId: questionData.id,
      question: questionData.question,
      answer: 'エラーが発生しました',
      sources: [],
      criteria: {
        faithfulness: 1,
        relevance: 1,
        referenceAccuracy: 1,
        completeness: 1,
        clarity: 1
      },
      averageScore: 1,
      comments: `エラー: ${error}`,
      timestamp: new Date().toISOString()
    };
  }
}

// すべての質問を評価
export async function runFullEvaluation(userId: string, limit?: number) {
  console.log('🚀 RAG評価テストを開始します...\n');
  
  const questionsToEvaluate = limit 
    ? evaluationQuestions.slice(0, limit)
    : evaluationQuestions;
  
  const results: EvaluationResult[] = [];
  
  for (const question of questionsToEvaluate) {
    const result = await evaluateSingleQuestion(question, userId);
    results.push(result);
    
    // レート制限を避けるため少し待機
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 結果の集計
  const totalScore = results.reduce((sum, r) => sum + r.averageScore, 0);
  const overallAverage = totalScore / results.length;
  const passingResults = results.filter(r => isPassingScore(r));
  
  console.log('\n📊 評価結果サマリー');
  console.log('='.repeat(50));
  console.log(`総質問数: ${results.length}`);
  console.log(`合格数: ${passingResults.length}`);
  console.log(`不合格数: ${results.length - passingResults.length}`);
  console.log(`全体平均スコア: ${overallAverage.toFixed(2)}/5.0`);
  console.log(`合格率: ${((passingResults.length / results.length) * 100).toFixed(1)}%`);
  
  // カテゴリ別の結果
  const categoryScores = new Map<string, number[]>();
  results.forEach(r => {
    const category = evaluationQuestions.find(q => q.id === r.questionId)?.category || '不明';
    if (!categoryScores.has(category)) {
      categoryScores.set(category, []);
    }
    categoryScores.get(category)!.push(r.averageScore);
  });
  
  console.log('\n📈 カテゴリ別平均スコア:');
  categoryScores.forEach((scores, category) => {
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    console.log(`  ${category}: ${avg.toFixed(2)}/5.0`);
  });
  
  // 評価基準別の平均
  console.log('\n📋 評価基準別平均スコア:');
  const criteriaAverages = {
    faithfulness: 0,
    relevance: 0,
    referenceAccuracy: 0,
    completeness: 0,
    clarity: 0
  };
  
  results.forEach(r => {
    Object.entries(r.criteria).forEach(([key, value]) => {
      criteriaAverages[key as keyof EvaluationCriteria] += value;
    });
  });
  
  Object.entries(criteriaAverages).forEach(([key, total]) => {
    const avg = total / results.length;
    console.log(`  ${key}: ${avg.toFixed(2)}/5.0`);
  });
  
  return {
    results,
    summary: {
      totalQuestions: results.length,
      passingCount: passingResults.length,
      failingCount: results.length - passingResults.length,
      overallAverage,
      passingRate: (passingResults.length / results.length) * 100,
      categoryScores: Object.fromEntries(categoryScores),
      criteriaAverages: Object.fromEntries(
        Object.entries(criteriaAverages).map(([k, v]) => [k, v / results.length])
      )
    }
  };
}

// テスト実行用のメイン関数
if (require.main === module) {
  // モックユーザーIDでテスト実行
  const mockUserId = 'test-user-123';
  
  // 最初の5つの質問だけでテスト
  runFullEvaluation(mockUserId, 5)
    .then(({ summary }) => {
      console.log('\n✅ 評価完了！');
      
      // 合格基準を満たしているかチェック
      if (summary.overallAverage >= 3.5) {
        console.log('🎉 全体的な品質基準を満たしています！');
      } else {
        console.log('⚠️  改善が必要です。RAGシステムの調整を検討してください。');
      }
    })
    .catch(error => {
      console.error('❌ 評価中にエラーが発生しました:', error);
    });
}
