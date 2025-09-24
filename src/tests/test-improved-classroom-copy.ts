/**
 * 改善された教室コピー機能キーワード抽出テスト
 */

async function testImprovedClassroomCopyExtraction() {
  console.log('🚀 改善された教室コピー機能キーワード抽出テスト開始');
  console.log('=' .repeat(60));

  const query = '教室コピー機能でコピー可能な項目は？';
  console.log(`🔍 テストクエリ: "${query}"`);
  console.log('');

  try {
    // 動的インポートを使用
    const { extractKeywordsConfigured } = await import('../lib/keyword-extractor-wrapper');
    
    const result = await extractKeywordsConfigured(query);
    
    console.log('🔑 改善後の抽出キーワード:');
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
      "教室コピー", "コピー機能", "コピー可能", "可能項目", 
      "教室", "コピー", "項目", "基本情報", "求人情報", 
      "応募情報", "塾チャート", "ロゴ", "スライド画像"
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
      !isClassroomCopyRelated(actual)
    );
    
    console.log(`- マッチしたキーワード: [${matchedKeywords.join(', ')}] (${matchedKeywords.length}/${idealKeywords.length})`);
    console.log(`- 不足しているキーワード: [${missingKeywords.join(', ')}]`);
    console.log(`- 無関係なキーワード: [${irrelevantKeywords.join(', ')}]`);
    console.log('');
    
    // 項目分類テスト
    console.log('🔧 項目分類テスト:');
    
    // 1. 教室情報項目
    const classroomInfoKeywords = result.keywords.filter(k => 
      k.includes('基本情報') || k.includes('応募情報') || k.includes('塾チャート') || 
      k.includes('ロゴ') || k.includes('スライド画像') || k.includes('教室名') ||
      k.includes('ホームページ') || k.includes('アクセス方法') || k.includes('管理メモ')
    );
    console.log(`- 教室情報項目キーワード: [${classroomInfoKeywords.join(', ')}] (${classroomInfoKeywords.length}個)`);
    
    // 2. 求人情報項目
    const jobInfoKeywords = result.keywords.filter(k => 
      k.includes('求人情報') || k.includes('勤務条件') || k.includes('指導科目') ||
      k.includes('応募条件') || k.includes('研修情報') || k.includes('PR情報')
    );
    console.log(`- 求人情報項目キーワード: [${jobInfoKeywords.join(', ')}] (${jobInfoKeywords.length}個)`);
    
    // 3. コピー制限・制約
    const copyLimitKeywords = result.keywords.filter(k => 
      k.includes('制限') || k.includes('制約') || k.includes('上限') || 
      k.includes('非同期') || k.includes('件数')
    );
    console.log(`- コピー制限・制約キーワード: [${copyLimitKeywords.join(', ')}] (${copyLimitKeywords.length}個)`);
    
    // 4. コピー処理挙動
    const copyProcessKeywords = result.keywords.filter(k => 
      k.includes('処理') || k.includes('挙動') || k.includes('上書き') || 
      k.includes('新規作成') || k.includes('プラン設定')
    );
    console.log(`- コピー処理挙動キーワード: [${copyProcessKeywords.join(', ')}] (${copyProcessKeywords.length}個)`);
    console.log('');
    
    // 詳細項目テスト
    console.log('📝 詳細項目テスト:');
    
    const detailItems = [
      '教室名', '教室名カナ', 'ホームページ', 'アクセス方法', '管理メモ1', '管理メモ2',
      '応募情報転送連絡先', '応募後連絡先電話番号', '塾チャート', 'ロゴ', 'スライド画像'
    ];
    
    const matchedDetailItems = detailItems.filter(item => 
      result.keywords.some(k => k.includes(item))
    );
    
    console.log(`- 詳細項目マッチ数: ${matchedDetailItems.length}/${detailItems.length}`);
    console.log(`- マッチした詳細項目: [${matchedDetailItems.join(', ')}]`);
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
    console.log(`- 平均スコア: ${averageScore.toFixed(1)} (目標: 80以上) ${averageScore >= 80 ? '✅' : '❌'}`);
    
    // 3.5 項目分類カバレッジ
    const itemCategories = [
      classroomInfoKeywords.length > 0 ? 1 : 0,
      jobInfoKeywords.length > 0 ? 1 : 0,
      copyLimitKeywords.length > 0 ? 1 : 0,
      copyProcessKeywords.length > 0 ? 1 : 0
    ].filter(Boolean).length;
    const itemCoverage = itemCategories / 4;
    console.log(`- 項目分類カバレッジ: ${itemCoverage.toFixed(3)} (目標: 0.8以上) ${itemCoverage >= 0.8 ? '✅' : '❌'}`);
    
    // 3.6 詳細項目カバレッジ
    const detailCoverage = matchedDetailItems.length / detailItems.length;
    console.log(`- 詳細項目カバレッジ: ${detailCoverage.toFixed(3)} (目標: 0.7以上) ${detailCoverage >= 0.7 ? '✅' : '❌'}`);
    console.log('');
    
    // 総合評価
    console.log('🎯 総合評価:');
    
    const passedCriteria = [
      matchedKeywords.length > 0,
      result.keywords.some(k => k.includes('教室コピー') || k.includes('コピー機能')),
      result.keywords.some(k => k === '教室' || k === 'コピー' || k === '機能' || k === '項目'),
      matchedKeywords.length / idealKeywords.length >= 0.5,
      result.keywords.length >= 10,
      result.keywords.some(k => k.includes('基本情報') || k.includes('求人情報') || k.includes('応募情報')),
      precision >= 0.8,
      recall >= 0.7,
      f1Score >= 0.75,
      averageScore >= 80,
      itemCoverage >= 0.8,
      detailCoverage >= 0.7
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
    
    console.log('');
    console.log('📝 改善効果の確認:');
    
    // 改善前との比較
    console.log('Before（改善前）:');
    console.log('- 詳細項目: 3/11個 (27.3%)');
    console.log('- コピー制限・制約: 0個');
    console.log('- コピー処理挙動: 0個');
    console.log('- 項目分類カバレッジ: 2/4分類 (50%)');
    console.log('- 品質スコア: 75/100 - PARTIAL PASS');
    
    console.log('');
    console.log('After（改善後）:');
    console.log(`- 詳細項目: ${matchedDetailItems.length}/11個 (${(matchedDetailItems.length/11*100).toFixed(1)}%)`);
    console.log(`- コピー制限・制約: ${copyLimitKeywords.length}個`);
    console.log(`- コピー処理挙動: ${copyProcessKeywords.length}個`);
    console.log(`- 項目分類カバレッジ: ${itemCategories}/4分類 (${(itemCategories/4*100).toFixed(1)}%)`);
    console.log(`- 品質スコア: ${overallScore.toFixed(1)}/100 - ${overallScore >= 80 ? 'PASS' : overallScore >= 60 ? 'PARTIAL PASS' : 'FAIL'}`);

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ 改善された教室コピー機能キーワード抽出テスト完了');
}

function isClassroomCopyRelated(keyword: string): boolean {
  const classroomCopyTerms = [
    '教室', 'コピー', '機能', '項目', '可能', '基本情報', '求人情報', '応募情報',
    '塾チャート', 'ロゴ', 'スライド画像', '教室名', 'ホームページ', 'アクセス方法',
    '管理メモ', '勤務条件', '指導科目', '応募条件', '研修情報', 'PR情報',
    '制限', '制約', '上限', '非同期', '件数', '処理', '挙動', '上書き',
    '新規作成', 'プラン設定', '編集', '削除', '復元'
  ];
  
  return classroomCopyTerms.some(term => keyword.includes(term));
}

// テスト実行
testImprovedClassroomCopyExtraction();
