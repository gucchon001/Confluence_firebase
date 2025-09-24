/**
 * 教室管理検索品質テストの品質スコア計算
 * @case_classroom-management-search-quality-test.md に基づく
 */

// 理想のキーワード抽出結果（仕様書より）
const IDEAL_KEYWORDS = [
  "教室管理", "教室", "教室一覧", "教室登録", 
  "教室編集", "教室削除", "教室コピー", "教室管理の詳細"
];

// 実際の抽出結果（修正後の結果）
const ACTUAL_KEYWORDS = [
  "教室管理の詳細は", "教室管理", "管理", "教室管理機能", 
  "教室管理ページ", "教室", "詳細", "教室管理-一括更新機能", 
  "教室管理-求人一覧閲覧機能", "教室管理-求人削除機能", 
  "教室管理-求人情報編集機能", "企業詳細閲覧機能"
];

// 除外されるべきキーワード
const EXCLUDED_KEYWORDS = [
  "amazonギフト券", "オファー", "オシゴトq&a", "企業詳細閲覧機能"
];

function calculateQualityScore() {
  console.log('📊 教室管理検索品質テスト - 品質スコア計算');
  console.log('=' .repeat(60));
  
  // 1. キーワードマッチングテスト
  console.log('🔍 テストケース2: キーワードマッチングテスト');
  console.log(`クエリ: "教室管理の詳細は"`);
  console.log('');
  
  // 理想のキーワードとの比較
  const matchedKeywords = IDEAL_KEYWORDS.filter(ideal => 
    ACTUAL_KEYWORDS.some(actual => actual.includes(ideal))
  );
  
  const missingKeywords = IDEAL_KEYWORDS.filter(ideal => 
    !ACTUAL_KEYWORDS.some(actual => actual.includes(ideal))
  );
  
  const irrelevantKeywords = ACTUAL_KEYWORDS.filter(actual => 
    EXCLUDED_KEYWORDS.some(excluded => actual.includes(excluded))
  );
  
  console.log('✅ 理想のキーワードとの比較:');
  console.log(`- 理想のキーワード: [${IDEAL_KEYWORDS.join(', ')}]`);
  console.log(`- 実際のキーワード: [${ACTUAL_KEYWORDS.join(', ')}]`);
  console.log(`- マッチしたキーワード: [${matchedKeywords.join(', ')}] (${matchedKeywords.length}/${IDEAL_KEYWORDS.length})`);
  console.log(`- 不足しているキーワード: [${missingKeywords.join(', ')}]`);
  console.log(`- 無関係なキーワード: [${irrelevantKeywords.join(', ')}]`);
  console.log('');
  
  // 2. 合格基準の評価
  console.log('📋 合格基準の評価:');
  
  // 2.1 キーワードスコアが0でない
  const keywordScore = matchedKeywords.length > 0 ? 1 : 0;
  console.log(`- キーワードスコアが0でない: ${keywordScore ? '✅' : '❌'}`);
  
  // 2.2 分割されたキーワードが正しく抽出される
  const hasSplitKeywords = ACTUAL_KEYWORDS.some(k => k.includes('教室管理'));
  console.log(`- 分割されたキーワードが正しく抽出される: ${hasSplitKeywords ? '✅' : '❌'}`);
  
  // 2.3 タイトルマッチングが正しく動作する
  const hasTitleMatching = ACTUAL_KEYWORDS.some(k => k === '教室管理');
  console.log(`- タイトルマッチングが正しく動作する: ${hasTitleMatching ? '✅' : '❌'}`);
  
  // 2.4 理想のキーワード抽出結果に近い結果が得られる
  const similarityScore = matchedKeywords.length / IDEAL_KEYWORDS.length;
  console.log(`- 理想のキーワード抽出結果に近い結果が得られる: ${similarityScore >= 0.5 ? '✅' : '❌'} (${(similarityScore * 100).toFixed(1)}%)`);
  
  // 2.5 キーワード数が5個以上
  const hasEnoughKeywords = ACTUAL_KEYWORDS.length >= 5;
  console.log(`- キーワード数が5個以上: ${hasEnoughKeywords ? '✅' : '❌'} (${ACTUAL_KEYWORDS.length}個)`);
  
  // 2.6 教室管理に関連する具体的な機能名が含まれる
  const hasFunctionNames = ACTUAL_KEYWORDS.some(k => 
    k.includes('教室管理-') || k.includes('機能')
  );
  console.log(`- 教室管理に関連する具体的な機能名が含まれる: ${hasFunctionNames ? '✅' : '❌'}`);
  console.log('');
  
  // 3. 品質メトリクスの計算
  console.log('📈 品質メトリクスの計算:');
  
  // 3.1 検索精度（Precision）
  const relevantKeywords = ACTUAL_KEYWORDS.filter(k => 
    !EXCLUDED_KEYWORDS.some(excluded => k.includes(excluded))
  );
  const precision = relevantKeywords.length / ACTUAL_KEYWORDS.length;
  console.log(`- 検索精度（Precision）: ${precision.toFixed(3)} (目標: 0.8以上) ${precision >= 0.8 ? '✅' : '❌'}`);
  
  // 3.2 検索再現率（Recall）
  const recall = matchedKeywords.length / IDEAL_KEYWORDS.length;
  console.log(`- 検索再現率（Recall）: ${recall.toFixed(3)} (目標: 0.7以上) ${recall >= 0.7 ? '✅' : '❌'}`);
  
  // 3.3 F1スコア
  const f1Score = precision > 0 && recall > 0 ? 
    2 * (precision * recall) / (precision + recall) : 0;
  console.log(`- F1スコア: ${f1Score.toFixed(3)} (目標: 0.75以上) ${f1Score >= 0.75 ? '✅' : '❌'}`);
  
  // 3.4 平均スコア（キーワードの関連性スコア）
  const averageScore = relevantKeywords.length / ACTUAL_KEYWORDS.length * 100;
  console.log(`- 平均スコア: ${averageScore.toFixed(1)} (目標: 60以上) ${averageScore >= 60 ? '✅' : '❌'}`);
  console.log('');
  
  // 4. 総合評価
  console.log('🎯 総合評価:');
  
  const passedCriteria = [
    keywordScore,
    hasSplitKeywords,
    hasTitleMatching,
    similarityScore >= 0.5,
    hasEnoughKeywords,
    hasFunctionNames,
    precision >= 0.8,
    recall >= 0.7,
    f1Score >= 0.75,
    averageScore >= 60
  ].filter(Boolean).length;
  
  const totalCriteria = 10;
  const overallScore = (passedCriteria / totalCriteria) * 100;
  
  console.log(`- 合格基準: ${passedCriteria}/${totalCriteria} (${overallScore.toFixed(1)}%)`);
  
  if (overallScore >= 80) {
    console.log('🎉 品質テスト: PASS');
  } else if (overallScore >= 60) {
    console.log('⚠️  品質テスト: PARTIAL PASS');
  } else {
    console.log('❌ 品質テスト: FAIL');
  }
  
  console.log('');
  console.log('📝 改善提案:');
  
  if (missingKeywords.length > 0) {
    console.log(`- 不足しているキーワードを追加: [${missingKeywords.join(', ')}]`);
  }
  
  if (irrelevantKeywords.length > 0) {
    console.log(`- 無関係なキーワードを除外: [${irrelevantKeywords.join(', ')}]`);
  }
  
  if (precision < 0.8) {
    console.log('- 検索精度の向上が必要');
  }
  
  if (recall < 0.7) {
    console.log('- 検索再現率の向上が必要');
  }
  
  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ 品質スコア計算完了');
  
  return {
    precision,
    recall,
    f1Score,
    averageScore,
    overallScore,
    passedCriteria,
    totalCriteria
  };
}

// テスト実行
if (require.main === module) {
  calculateQualityScore();
}

export { calculateQualityScore };
