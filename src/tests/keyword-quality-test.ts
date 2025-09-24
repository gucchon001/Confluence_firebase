/**
 * キーワード抽出品質テスト
 * 教室管理検索品質テスト仕様書に基づく
 */

import { extractKeywordsConfigured } from '../lib/keyword-extractor-wrapper';

async function runKeywordQualityTest() {
  console.log('🚀 キーワード抽出品質テスト開始');
  console.log('=' .repeat(60));

  const query = '教室管理の詳細は';
  console.log(`🔍 テストクエリ: "${query}"`);
  console.log('');

  try {
    const result = await extractKeywordsConfigured(query);

    console.log('📊 抽出結果:');
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- キーワードソース: ${result.metadata.keywordSource}`);
    console.log(`- 処理時間: ${result.metadata.processingTime}ms`);
    console.log('');

    console.log('🔑 最終的なキーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    console.log('');

    // 理想のキーワード抽出結果（仕様書より）
    const idealKeywords = [
      "教室管理", "教室", "教室一覧", "教室登録", 
      "教室編集", "教室削除", "教室コピー", "教室管理の詳細"
    ];

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
      !isClassroomRelated(actual)
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
    const hasSplitKeywords = result.keywords.some(k => k.includes('教室管理'));
    console.log(`- 分割されたキーワードが正しく抽出される: ${hasSplitKeywords ? '✅' : '❌'}`);
    
    // 2.3 タイトルマッチングが正しく動作する
    const hasTitleMatching = result.keywords.some(k => k === '教室管理');
    console.log(`- タイトルマッチングが正しく動作する: ${hasTitleMatching ? '✅' : '❌'}`);
    
    // 2.4 理想のキーワード抽出結果に近い結果が得られる
    const similarityScore = matchedKeywords.length / idealKeywords.length;
    console.log(`- 理想のキーワード抽出結果に近い結果が得られる: ${similarityScore >= 0.5 ? '✅' : '❌'} (${(similarityScore * 100).toFixed(1)}%)`);
    
    // 2.5 キーワード数が5個以上
    const hasEnoughKeywords = result.keywords.length >= 5;
    console.log(`- キーワード数が5個以上: ${hasEnoughKeywords ? '✅' : '❌'} (${result.keywords.length}個)`);
    
    // 2.6 教室管理に関連する具体的な機能名が含まれる
    const hasFunctionNames = result.keywords.some(k => 
      k.includes('教室管理-') || k.includes('機能')
    );
    console.log(`- 教室管理に関連する具体的な機能名が含まれる: ${hasFunctionNames ? '✅' : '❌'}`);
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
    console.log(`- 平均スコア: ${averageScore.toFixed(1)} (目標: 60以上) ${averageScore >= 60 ? '✅' : '❌'}`);
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

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ キーワード抽出品質テスト完了');
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
if (require.main === module) {
  runKeywordQualityTest();
}

export { runKeywordQualityTest };
