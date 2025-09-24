/**
 * 理想のキーワード抽出器のテスト
 */

import { IdealKeywordExtractor } from '../lib/ideal-keyword-extractor';

async function testIdealKeywordExtraction() {
  console.log('🚀 理想のキーワード抽出テスト開始');
  console.log('=' .repeat(60));

  const extractor = new IdealKeywordExtractor();
  const query = '教室管理の詳細は';

  console.log(`🔍 テストクエリ: "${query}"`);
  console.log('');

  try {
    const result = await extractor.extractIdealKeywords(query);

    console.log('📊 抽出結果:');
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- キーワードソース: ${result.source}`);
    console.log(`- 処理時間: ${result.processingTime}ms`);
    console.log('');

    console.log('🔑 最終的なキーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    console.log('');

    console.log('📈 統計情報:');
    console.log(`- 教室管理関連: ${result.statistics.classroomRelated}個`);
    console.log(`- 無関係キーワード除外: ${result.statistics.irrelevantFiltered}個`);
    console.log('');

    // 理想のキーワードとの比較
    const expectedKeywords = [
      '教室管理', '教室', '管理', '詳細', '教室一覧', '教室登録', 
      '教室編集', '教室削除', '教室コピー', '一覧', '登録', '編集'
    ];

    console.log('✅ 理想のキーワードとの比較:');
    const missingKeywords = expectedKeywords.filter(expected => 
      !result.keywords.some(extracted => extracted.includes(expected))
    );
    
    const irrelevantKeywords = result.keywords.filter(keyword => 
      !expectedKeywords.some(expected => expected.includes(keyword)) &&
      !isClassroomRelated(keyword)
    );

    if (missingKeywords.length === 0) {
      console.log('  ✅ 重要なキーワードは全て含まれています');
    } else {
      console.log(`  ⚠️  不足しているキーワード: [${missingKeywords.join(', ')}]`);
    }

    if (irrelevantKeywords.length === 0) {
      console.log('  ✅ 無関係なキーワードは含まれていません');
    } else {
      console.log(`  ❌ 無関係なキーワード: [${irrelevantKeywords.join(', ')}]`);
    }

    // 品質評価
    const qualityScore = calculateQualityScore(result.keywords, expectedKeywords);
    console.log(`  📊 品質スコア: ${qualityScore.toFixed(2)}/100`);

    if (qualityScore >= 80) {
      console.log('  🎉 品質テスト: PASS');
    } else {
      console.log('  ❌ 品質テスト: FAIL');
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ 理想のキーワード抽出テスト完了');
}

function isClassroomRelated(keyword: string): boolean {
  const classroomTerms = [
    '教室', '管理', '一覧', '登録', '編集', '削除', 'コピー', '詳細',
    'スクール', '校舎', '事業所', 'マネジメント', '運用', 'オペレーション',
    '設定', '機能', '仕様', '要件', '画面', 'データ', '情報'
  ];
  
  return classroomTerms.some(term => keyword.includes(term));
}

function calculateQualityScore(extractedKeywords: string[], expectedKeywords: string[]): number {
  let score = 0;
  
  // 1. 期待されるキーワードが含まれているか（40点）
  const matchedKeywords = expectedKeywords.filter(expected => 
    extractedKeywords.some(extracted => extracted.includes(expected))
  );
  score += (matchedKeywords.length / expectedKeywords.length) * 40;
  
  // 2. 無関係なキーワードが含まれていないか（30点）
  const irrelevantKeywords = extractedKeywords.filter(keyword => 
    !expectedKeywords.some(expected => expected.includes(keyword)) &&
    !isClassroomRelated(keyword)
  );
  score += Math.max(0, 30 - (irrelevantKeywords.length * 5));
  
  // 3. キーワード数が適切か（20点）
  if (extractedKeywords.length >= 8 && extractedKeywords.length <= 12) {
    score += 20;
  } else {
    score += Math.max(0, 20 - Math.abs(extractedKeywords.length - 10) * 2);
  }
  
  // 4. 教室管理関連キーワードの割合（10点）
  const classroomRelatedCount = extractedKeywords.filter(isClassroomRelated).length;
  score += Math.min(10, (classroomRelatedCount / extractedKeywords.length) * 10);
  
  return Math.min(100, score);
}

// テスト実行
if (require.main === module) {
  testIdealKeywordExtraction();
}

export { testIdealKeywordExtraction };
