/**
 * シンプルなキーワード抽出テスト
 * 実際の抽出結果を確認
 */

async function testKeywordExtraction() {
  console.log('🔍 キーワード抽出テスト開始');
  console.log('クエリ: "教室管理の詳細は"');
  console.log('');

  try {
    // 動的インポートを使用
    const { extractKeywordsConfigured } = await import('../lib/keyword-extractor-wrapper');
    
    const result = await extractKeywordsConfigured('教室管理の詳細は');
    
    console.log('🔑 実際の抽出キーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    
    console.log('');
    console.log('📊 統計情報:');
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- キーワードソース: ${result.metadata.keywordSource}`);
    console.log(`- 処理時間: ${result.metadata.processingTime}ms`);
    
    // 理想のキーワードとの比較
    const idealKeywords = [
      "教室管理", "教室", "教室一覧", "教室登録", 
      "教室編集", "教室削除", "教室コピー", "教室管理の詳細"
    ];
    
    console.log('');
    console.log('✅ 理想のキーワードとの比較:');
    console.log(`- 理想のキーワード: [${idealKeywords.join(', ')}]`);
    
    const matchedKeywords = idealKeywords.filter(ideal => 
      result.keywords.some(actual => actual.includes(ideal))
    );
    
    const missingKeywords = idealKeywords.filter(ideal => 
      !result.keywords.some(actual => actual.includes(ideal))
    );
    
    const irrelevantKeywords = result.keywords.filter(actual => 
      !idealKeywords.some(ideal => ideal.includes(actual)) &&
      !isClassroomRelated(actual)
    );
    
    console.log(`- マッチしたキーワード: [${matchedKeywords.join(', ')}] (${matchedKeywords.length}/${idealKeywords.length})`);
    console.log(`- 不足しているキーワード: [${missingKeywords.join(', ')}]`);
    console.log(`- 無関係なキーワード: [${irrelevantKeywords.join(', ')}]`);
    
    // 品質スコア計算
    const precision = result.keywords.length > 0 ? 
      (result.keywords.length - irrelevantKeywords.length) / result.keywords.length : 0;
    const recall = idealKeywords.length > 0 ? 
      matchedKeywords.length / idealKeywords.length : 0;
    const f1Score = precision > 0 && recall > 0 ? 
      2 * (precision * recall) / (precision + recall) : 0;
    
    console.log('');
    console.log('📈 品質メトリクス:');
    console.log(`- 検索精度（Precision）: ${precision.toFixed(3)} (目標: 0.8以上)`);
    console.log(`- 検索再現率（Recall）: ${recall.toFixed(3)} (目標: 0.7以上)`);
    console.log(`- F1スコア: ${f1Score.toFixed(3)} (目標: 0.75以上)`);
    
    // 総合評価
    const overallScore = (precision + recall + f1Score) / 3 * 100;
    console.log(`- 総合スコア: ${overallScore.toFixed(1)}/100`);
    
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
}

function isClassroomRelated(keyword: string): boolean {
  const classroomTerms = [
    '教室', '管理', '一覧', '登録', '編集', '削除', 'コピー', '詳細',
    'スクール', '校舎', '事業所', 'マネジメント', '運用', 'オペレーション',
    '設定', '機能', '仕様', '要件', '画面', 'データ', '情報'
  ];
  
  return classroomTerms.some(term => keyword.includes(term));
}

// テスト実行
testKeywordExtraction();
