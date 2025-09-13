// RAG評価基準

export interface EvaluationCriteria {
  faithfulness: number;      // 忠実性 (1-5): 回答がコンテキストに忠実か
  relevance: number;         // 関連性 (1-5): 質問に対して適切に答えているか
  referenceAccuracy: number; // 参照元の正確性 (1-5): 提示された参照元が正確か
  completeness: number;      // 完全性 (1-5): 回答が網羅的か
  clarity: number;          // 明確性 (1-5): 回答が分かりやすいか
}

export interface EvaluationResult {
  questionId: string;
  question: string;
  answer: string;
  sources: Array<{ title: string; url: string }>;
  criteria: EvaluationCriteria;
  averageScore: number;
  comments: string;
  timestamp: string;
}

// 評価スコアの説明
export const scoreDescriptions = {
  5: '非常に優れている（Excellent）',
  4: '良い（Good）',
  3: '許容範囲（Acceptable）',
  2: '改善が必要（Needs Improvement）',
  1: '不満足（Poor）'
};

// 評価基準の詳細説明
export const criteriaDescriptions = {
  faithfulness: {
    name: '忠実性',
    description: '回答が提供されたコンテキスト（参照元）の情報に忠実であるか',
    scoring: {
      5: 'コンテキストに完全に忠実で、情報の捏造や誤解釈がない',
      4: 'ほぼ忠実だが、些細な解釈の違いがある',
      3: '概ね忠実だが、一部不正確な情報が含まれる',
      2: 'コンテキストから逸脱した情報が多い',
      1: '大部分がコンテキストと無関係または誤った情報'
    }
  },
  relevance: {
    name: '関連性',
    description: '回答が質問の意図に直接関連しているか',
    scoring: {
      5: '質問に完璧に答えており、余計な情報がない',
      4: '質問に適切に答えているが、少し余分な情報がある',
      3: '質問には答えているが、関連性の低い情報も含む',
      2: '質問への答えが不十分で、関係ない情報が多い',
      1: '質問に答えていない、または全く関係ない回答'
    }
  },
  referenceAccuracy: {
    name: '参照元の正確性',
    description: '提示された参照元が実際にその情報を含んでいるか',
    scoring: {
      5: 'すべての参照元が正確で、情報源として適切',
      4: 'ほとんどの参照元が正確',
      3: '参照元の半分以上が正確',
      2: '参照元の正確性が低い',
      1: '参照元が不正確または提示されていない'
    }
  },
  completeness: {
    name: '完全性',
    description: '質問に対する回答が網羅的であるか',
    scoring: {
      5: '質問のすべての側面に包括的に答えている',
      4: 'ほとんどの重要な点をカバーしている',
      3: '基本的な点はカバーしているが、いくつか欠けている',
      2: '重要な情報が多く欠けている',
      1: '回答が不完全で、重要な情報がほとんどない'
    }
  },
  clarity: {
    name: '明確性',
    description: '回答が理解しやすく、構造化されているか',
    scoring: {
      5: '非常に明確で、完璧に構造化されている',
      4: '明確で理解しやすい',
      3: '概ね理解できるが、一部不明瞭',
      2: '理解が困難な部分が多い',
      1: '非常に不明瞭で理解困難'
    }
  }
};

// 評価の合格基準
export const passingCriteria = {
  minimumAverageScore: 3.5,  // 平均スコア3.5以上で合格
  minimumPerCriteria: 2.0,   // 各基準の最低スコア
  criticalCriteria: ['faithfulness', 'relevance']  // 特に重要な評価基準
};

// 評価結果の集計
export function calculateAverageScore(criteria: EvaluationCriteria): number {
  const scores = Object.values(criteria);
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

// 評価結果の合否判定
export function isPassingScore(result: EvaluationResult): boolean {
  const avgScore = result.averageScore;
  const criteria = result.criteria;
  
  // 平均スコアが基準を満たしているか
  if (avgScore < passingCriteria.minimumAverageScore) {
    return false;
  }
  
  // 各基準の最低スコアを満たしているか
  for (const [key, score] of Object.entries(criteria)) {
    if (score < passingCriteria.minimumPerCriteria) {
      return false;
    }
  }
  
  // 重要な基準で特に高いスコアを求める
  for (const criticalKey of passingCriteria.criticalCriteria) {
    if (criteria[criticalKey as keyof EvaluationCriteria] < 3.0) {
      return false;
    }
  }
  
  return true;
}
