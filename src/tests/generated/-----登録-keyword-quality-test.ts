/**
 * -----登録 キーワード抽出品質テスト
 * 自動生成されたテストケース
 */

async function test登録KeywordExtraction() {
  console.log('🚀 -----登録 キーワード抽出品質テスト開始');
  console.log('=' .repeat(60));

  const query = '企業管理の登録機能の詳細を教えて';
  console.log(`🔍 テストクエリ: "${query}"`);
  console.log('');

  try {
    // 動的インポートを使用
    const { extractKeywordsConfigured } = await import('../lib/keyword-extractor-wrapper');
    
    const result = await extractKeywordsConfigured(query);
    
    console.log('🔑 実際の抽出キーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    
    console.log('');
    console.log('📊 統計情報:');
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- キーワードソース: ${result.metadata.keywordSource}`);
    console.log(`- 処理時間: ${result.metadata.processingTime}ms`);
    
    // 理想のキーワード抽出結果
    const idealKeywords = [
      "企業管理",
      "登録",
      "企業管理登録",
      "企業管理機能",
      "登録機能",
      "機能",
      "詳細",
      "管理",
      "システム"
];
    
    console.log('');
    console.log('✅ 理想のキーワードとの比較:');
    console.log(`- 理想のキーワード: [${idealKeywords.join(', ')}]`);
    console.log(`- 実際のキーワード: [${result.keywords.join(', ')}]`);

    const matchedKeywords = idealKeywords.filter(ideal => 
      result.keywords.some(actual => actual.includes(ideal))
    );
    
    const missingKeywords = idealKeywords.filter(ideal => 
      !result.keywords.some(actual => actual.includes(ideal))
    );
    
    const irrelevantKeywords = result.keywords.filter(actual => 
      !idealKeywords.some(ideal => ideal.includes(actual)) &&
      !is登録Related(actual)
    );
    
    console.log(`- マッチしたキーワード: [${matchedKeywords.join(', ')}] (${matchedKeywords.length}/${idealKeywords.length})`);
    console.log(`- 不足しているキーワード: [${missingKeywords.join(', ')}]`);
    console.log(`- 無関係なキーワード: [${irrelevantKeywords.join(', ')}]`);
    console.log('');
    
    // 品質メトリクスの計算
    console.log('📈 品質メトリクスの計算:');
    
    // 検索精度（Precision）
    const relevantKeywords = result.keywords.filter(k => 
      !irrelevantKeywords.includes(k)
    );
    const precision = result.keywords.length > 0 ? relevantKeywords.length / result.keywords.length : 0;
    console.log(`- 検索精度（Precision）: ${precision.toFixed(3)} (目標: ${testCase.qualityMetrics.precision}以上) ${precision >= testCase.qualityMetrics.precision ? '✅' : '❌'}`);
    
    // 検索再現率（Recall）
    const recall = idealKeywords.length > 0 ? matchedKeywords.length / idealKeywords.length : 0;
    console.log(`- 検索再現率（Recall）: ${recall.toFixed(3)} (目標: ${testCase.qualityMetrics.recall}以上) ${recall >= testCase.qualityMetrics.recall ? '✅' : '❌'}`);
    
    // F1スコア
    const f1Score = precision > 0 && recall > 0 ? 
      2 * (precision * recall) / (precision + recall) : 0;
    console.log(`- F1スコア: ${f1Score.toFixed(3)} (目標: ${testCase.qualityMetrics.f1Score}以上) ${f1Score >= testCase.qualityMetrics.f1Score ? '✅' : '❌'}`);
    
    // 平均スコア
    const averageScore = relevantKeywords.length / result.keywords.length * 100;
    console.log(`- 平均スコア: ${averageScore.toFixed(1)} (目標: ${testCase.qualityMetrics.averageScore}以上) ${averageScore >= testCase.qualityMetrics.averageScore ? '✅' : '❌'}`);
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
    
    console.log(`- 合格基準: ${passedCriteria}/${totalCriteria} (${overallScore.toFixed(1)}%)`);
    
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
  console.log('✅ -----登録 キーワード抽出品質テスト完了');
}

function is登録Related(keyword: string): boolean {
  const -----登録Terms = [
      "企業管理",
      "登録",
      "企業管理登録",
      "企業管理機能",
      "登録機能",
      "機能",
      "詳細",
      "管理",
      "システム"
];
  
  return -----登録Terms.some(term => keyword.includes(term));
}

// テスト実行
test登録KeywordExtraction();
