/**
 * オファー機能キーワード抽出品質テスト
 * @case_offer-function-search-quality-test.md に基づく
 */

async function testOfferKeywordExtraction() {
  console.log('🚀 オファー機能キーワード抽出品質テスト開始');
  console.log('=' .repeat(60));

  const query = 'オファー機能の種類は？';
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
    
    // 理想のキーワード抽出結果（仕様書より）
    const idealKeywords = [
      "オファー機能", "オファー", "スカウト", "マッチ", 
      "パーソナルオファー", "自動オファー", "オファー一覧", 
      "オファー履歴", "オファー種類"
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
      !isOfferRelated(actual)
    );
    
    console.log(`- マッチしたキーワード: [${matchedKeywords.join(', ')}] (${matchedKeywords.length}/${idealKeywords.length})`);
    console.log(`- 不足しているキーワード: [${missingKeywords.join(', ')}]`);
    console.log(`- 無関係なキーワード: [${irrelevantKeywords.join(', ')}]`);
    console.log('');
    
    // 合格基準の評価
    console.log('📋 合格基準の評価:');
    
    // 2.1 キーワードスコアが0でない
    const keywordScore = matchedKeywords.length > 0 ? 1 : 0;
    console.log(`- キーワードスコアが0でない: ${keywordScore ? '✅' : '❌'}`);
    
    // 2.2 分割されたキーワードが正しく抽出される
    const hasSplitKeywords = result.keywords.some(k => k.includes('オファー機能'));
    console.log(`- 分割されたキーワードが正しく抽出される: ${hasSplitKeywords ? '✅' : '❌'}`);
    
    // 2.3 タイトルマッチングが正しく動作する
    const hasTitleMatching = result.keywords.some(k => k === 'オファー' || k === 'オファー機能');
    console.log(`- タイトルマッチングが正しく動作する: ${hasTitleMatching ? '✅' : '❌'}`);
    
    // 2.4 理想のキーワード抽出結果に近い結果が得られる
    const similarityScore = matchedKeywords.length / idealKeywords.length;
    console.log(`- 理想のキーワード抽出結果に近い結果が得られる: ${similarityScore >= 0.5 ? '✅' : '❌'} (${(similarityScore * 100).toFixed(1)}%)`);
    
    // 2.5 キーワード数が6個以上
    const hasEnoughKeywords = result.keywords.length >= 6;
    console.log(`- キーワード数が6個以上: ${hasEnoughKeywords ? '✅' : '❌'} (${result.keywords.length}個)`);
    
    // 2.6 オファー機能に関連する具体的な機能名が含まれる
    const hasFunctionNames = result.keywords.some(k => 
      k.includes('オファー') && (k.includes('機能') || k.includes('一覧') || k.includes('履歴'))
    );
    console.log(`- オファー機能に関連する具体的な機能名が含まれる: ${hasFunctionNames ? '✅' : '❌'}`);
    console.log('');
    
    // 機能分類テスト
    console.log('🔧 機能分類テスト:');
    
    // スカウト（パーソナルオファー）関連キーワード
    const scoutKeywords = result.keywords.filter(k => 
      k.includes('スカウト') || k.includes('パーソナルオファー')
    );
    console.log(`- スカウト関連キーワード: [${scoutKeywords.join(', ')}] (${scoutKeywords.length}個)`);
    
    // マッチ（自動オファー）関連キーワード
    const matchKeywords = result.keywords.filter(k => 
      k.includes('マッチ') || k.includes('自動オファー')
    );
    console.log(`- マッチ関連キーワード: [${matchKeywords.join(', ')}] (${matchKeywords.length}個)`);
    
    // 共通機能キーワード
    const commonKeywords = result.keywords.filter(k => 
      k.includes('オファー一覧') || k.includes('オファー履歴') || k.includes('オファー種類')
    );
    console.log(`- 共通機能キーワード: [${commonKeywords.join(', ')}] (${commonKeywords.length}個)`);
    console.log('');
    
    // 品質メトリクスの計算
    console.log('📈 品質メトリクスの計算:');
    
    // 3.1 検索精度（Precision）
    const relevantKeywords = result.keywords.filter(k => 
      !irrelevantKeywords.includes(k)
    );
    const precision = result.keywords.length > 0 ? relevantKeywords.length / result.keywords.length : 0;
    console.log(`- 検索精度（Precision）: ${precision.toFixed(3)} (目標: 0.8以上) ${precision >= 0.8 ? '✅' : '❌'}`);
    
    // 3.2 検索再現率（Recall）
    const recall = idealKeywords.length > 0 ? matchedKeywords.length / idealKeywords.length : 0;
    console.log(`- 検索再現率（Recall）: ${recall.toFixed(3)} (目標: 0.7以上) ${recall >= 0.7 ? '✅' : '❌'}`);
    
    // 3.3 F1スコア
    const f1Score = precision > 0 && recall > 0 ? 
      2 * (precision * recall) / (precision + recall) : 0;
    console.log(`- F1スコア: ${f1Score.toFixed(3)} (目標: 0.75以上) ${f1Score >= 0.75 ? '✅' : '❌'}`);
    
    // 3.4 平均スコア（キーワードの関連性スコア）
    const averageScore = relevantKeywords.length / result.keywords.length * 100;
    console.log(`- 平均スコア: ${averageScore.toFixed(1)} (目標: 70以上) ${averageScore >= 70 ? '✅' : '❌'}`);
    
    // 3.5 機能分類カバレッジ
    const functionCategories = [
      scoutKeywords.length > 0 ? 1 : 0,
      matchKeywords.length > 0 ? 1 : 0,
      commonKeywords.length > 0 ? 1 : 0
    ].filter(Boolean).length;
    const coverage = functionCategories / 3;
    console.log(`- 機能分類カバレッジ: ${coverage.toFixed(3)} (目標: 0.8以上) ${coverage >= 0.8 ? '✅' : '❌'}`);
    console.log('');
    
    // 総合評価
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
      averageScore >= 70,
      coverage >= 0.8
    ].filter(Boolean).length;
    
    const totalCriteria = 11;
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
    
    if (scoutKeywords.length === 0) {
      console.log('- スカウト関連キーワードの抽出が必要');
    }
    
    if (matchKeywords.length === 0) {
      console.log('- マッチ関連キーワードの抽出が必要');
    }
    
    if (precision < 0.8) {
      console.log('- 検索精度の向上が必要');
    }
    
    if (recall < 0.7) {
      console.log('- 検索再現率の向上が必要');
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ オファー機能キーワード抽出品質テスト完了');
}

function isOfferRelated(keyword: string): boolean {
  const offerTerms = [
    'オファー', 'スカウト', 'マッチ', 'パーソナル', '自動', '一覧', '履歴', '種類',
    '機能', '管理', '設定', '作成', '編集', '削除', '通知', 'テンプレート',
    '条件', '送信', '受信', 'バッチ', '統計', 'ログ', '分析'
  ];
  
  return offerTerms.some(term => keyword.includes(term));
}

// テスト実行
testOfferKeywordExtraction();
