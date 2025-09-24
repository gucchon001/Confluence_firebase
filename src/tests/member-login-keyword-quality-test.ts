/**
 * 会員ログイン機能キーワード抽出品質テスト
 * @case_member-login-function-search-quality-test.md に基づく
 */

async function testMemberLoginKeywordExtraction() {
  console.log('🚀 会員ログイン機能キーワード抽出品質テスト開始');
  console.log('=' .repeat(60));

  const query = '会員のログイン機能の詳細を教えて';
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
      "会員ログイン", "ログイン機能", "会員", "ログイン", 
      "ログアウト", "パスワード", "認証", "セッション", 
      "アカウントロック", "ログイン詳細", "会員認証"
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
      !isMemberLoginRelated(actual)
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
    const hasSplitKeywords = result.keywords.some(k => 
      k.includes('会員ログイン') || k.includes('ログイン機能') || k.includes('会員のログイン')
    );
    console.log(`- 分割されたキーワードが正しく抽出される: ${hasSplitKeywords ? '✅' : '❌'}`);
    
    // 2.3 タイトルマッチングが正しく動作する
    const hasTitleMatching = result.keywords.some(k => 
      k === '会員' || k === 'ログイン' || k === '機能' || k === '詳細'
    );
    console.log(`- タイトルマッチングが正しく動作する: ${hasTitleMatching ? '✅' : '❌'}`);
    
    // 2.4 理想のキーワード抽出結果に近い結果が得られる
    const similarityScore = matchedKeywords.length / idealKeywords.length;
    console.log(`- 理想のキーワード抽出結果に近い結果が得られる: ${similarityScore >= 0.5 ? '✅' : '❌'} (${(similarityScore * 100).toFixed(1)}%)`);
    
    // 2.5 キーワード数が8個以上
    const hasEnoughKeywords = result.keywords.length >= 8;
    console.log(`- キーワード数が8個以上: ${hasEnoughKeywords ? '✅' : '❌'} (${result.keywords.length}個)`);
    
    // 2.6 ログイン機能に関連する具体的な機能名が含まれる
    const hasFunctionNames = result.keywords.some(k => 
      k.includes('ログイン') && (k.includes('機能') || k.includes('認証') || k.includes('セッション'))
    );
    console.log(`- ログイン機能に関連する具体的な機能名が含まれる: ${hasFunctionNames ? '✅' : '❌'}`);
    console.log('');
    
    // 機能分類テスト
    console.log('🔧 機能分類テスト:');
    
    // 1. ログイン・ログアウト機能
    const loginLogoutKeywords = result.keywords.filter(k => 
      k.includes('ログイン') || k.includes('ログアウト') || k.includes('パスワード')
    );
    console.log(`- ログイン・ログアウト機能キーワード: [${loginLogoutKeywords.join(', ')}] (${loginLogoutKeywords.length}個)`);
    
    // 2. セキュリティ機能
    const securityKeywords = result.keywords.filter(k => 
      k.includes('アカウントロック') || k.includes('認証') || k.includes('セッション') ||
      k.includes('セキュリティ') || k.includes('ログイン失敗')
    );
    console.log(`- セキュリティ機能キーワード: [${securityKeywords.join(', ')}] (${securityKeywords.length}個)`);
    
    // 3. 認証・認可機能
    const authKeywords = result.keywords.filter(k => 
      k.includes('認証') || k.includes('認可') || k.includes('会員認証') ||
      k.includes('ログイン状態') || k.includes('認証機能')
    );
    console.log(`- 認証・認可機能キーワード: [${authKeywords.join(', ')}] (${authKeywords.length}個)`);
    
    // 4. 関連機能
    const relatedKeywords = result.keywords.filter(k => 
      k.includes('プロフィール') || k.includes('設定') || k.includes('会員限定') ||
      k.includes('会員登録') || k.includes('メール認証')
    );
    console.log(`- 関連機能キーワード: [${relatedKeywords.join(', ')}] (${relatedKeywords.length}個)`);
    console.log('');
    
    // セキュリティ機能テスト
    console.log('🔒 セキュリティ機能テスト:');
    
    const securityFeatures = [
      'アカウントロック', 'ログイン失敗ログ', 'セッション管理', 'パスワード再設定', 'エラーメッセージ制限'
    ];
    
    const matchedSecurityFeatures = securityFeatures.filter(feature => 
      result.keywords.some(k => k.includes(feature))
    );
    
    console.log(`- セキュリティ機能マッチ数: ${matchedSecurityFeatures.length}/${securityFeatures.length}`);
    console.log(`- マッチしたセキュリティ機能: [${matchedSecurityFeatures.join(', ')}]`);
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
    console.log(`- 平均スコア: ${averageScore.toFixed(1)} (目標: 75以上) ${averageScore >= 75 ? '✅' : '❌'}`);
    
    // 3.5 機能分類カバレッジ
    const functionCategories = [
      loginLogoutKeywords.length > 0 ? 1 : 0,
      securityKeywords.length > 0 ? 1 : 0,
      authKeywords.length > 0 ? 1 : 0,
      relatedKeywords.length > 0 ? 1 : 0
    ].filter(Boolean).length;
    const functionCoverage = functionCategories / 4;
    console.log(`- 機能分類カバレッジ: ${functionCoverage.toFixed(3)} (目標: 0.8以上) ${functionCoverage >= 0.8 ? '✅' : '❌'}`);
    
    // 3.6 セキュリティ機能カバレッジ
    const securityCoverage = matchedSecurityFeatures.length / securityFeatures.length;
    console.log(`- セキュリティ機能カバレッジ: ${securityCoverage.toFixed(3)} (目標: 0.6以上) ${securityCoverage >= 0.6 ? '✅' : '❌'}`);
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
      averageScore >= 75,
      functionCoverage >= 0.8,
      securityCoverage >= 0.6
    ].filter(Boolean).length;
    
    const totalCriteria = 12;
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
  console.log('✅ 会員ログイン機能キーワード抽出品質テスト完了');
}

function isMemberLoginRelated(keyword: string): boolean {
  const memberLoginTerms = [
    '会員', 'ログイン', 'ログアウト', '機能', '詳細', '認証', 'セッション',
    'パスワード', 'アカウントロック', '会員認証', 'プロフィール', '設定',
    '会員登録', 'メール認証', 'セキュリティ', 'ログイン失敗', '認可',
    'ログイン状態', '認証機能', '会員限定', '二段階認証', 'SSO'
  ];
  
  return memberLoginTerms.some(term => keyword.includes(term));
}

// テスト実行
testMemberLoginKeywordExtraction();