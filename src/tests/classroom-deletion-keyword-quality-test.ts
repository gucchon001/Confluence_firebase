/**
 * 教室削除問題キーワード抽出品質テスト
 * @case_classroom-deletion-issue-search-quality-test.md に基づく
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from './test-helpers/env-loader';
loadTestEnv();

async function testClassroomDeletionKeywordExtraction() {
  console.log('🚀 教室削除問題キーワード抽出品質テスト開始');
  console.log('=' .repeat(60));

  const query = '教室削除ができないのは何が原因ですか';
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
      "教室削除", "削除できない", "削除問題", "削除制限", 
      "教室", "削除", "求人掲載", "応募情報", "採用ステータス", 
      "削除条件", "削除エラー", "削除制限条件"
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
      !isClassroomDeletionRelated(actual)
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
      k.includes('教室削除') || k.includes('削除できない') || k.includes('削除問題')
    );
    console.log(`- 分割されたキーワードが正しく抽出される: ${hasSplitKeywords ? '✅' : '❌'}`);
    
    // 2.3 タイトルマッチングが正しく動作する
    const hasTitleMatching = result.keywords.some(k => 
      k === '教室' || k === '削除' || k === '原因'
    );
    console.log(`- タイトルマッチングが正しく動作する: ${hasTitleMatching ? '✅' : '❌'}`);
    
    // 2.4 理想のキーワード抽出結果に近い結果が得られる
    const similarityScore = matchedKeywords.length / idealKeywords.length;
    console.log(`- 理想のキーワード抽出結果に近い結果が得られる: ${similarityScore >= 0.5 ? '✅' : '❌'} (${(similarityScore * 100).toFixed(1)}%)`);
    
    // 2.5 キーワード数が8個以上
    const hasEnoughKeywords = result.keywords.length >= 8;
    console.log(`- キーワード数が8個以上: ${hasEnoughKeywords ? '✅' : '❌'} (${result.keywords.length}個)`);
    
    // 2.6 教室削除の問題に関連する具体的な機能名が含まれる
    const hasFunctionNames = result.keywords.some(k => 
      k.includes('削除') && (k.includes('機能') || k.includes('制限') || k.includes('条件'))
    );
    console.log(`- 教室削除の問題に関連する具体的な機能名が含まれる: ${hasFunctionNames ? '✅' : '❌'}`);
    console.log('');
    
    // 問題原因分類テスト
    console.log('🔧 問題原因分類テスト:');
    
    // 1. 求人掲載状態の問題
    const jobPostingKeywords = result.keywords.filter(k => 
      k.includes('求人掲載') || k.includes('求人非掲載') || k.includes('掲載状態') ||
      k.includes('求人管理') || k.includes('掲載管理')
    );
    console.log(`- 求人掲載状態の問題キーワード: [${jobPostingKeywords.join(', ')}] (${jobPostingKeywords.length}個)`);
    
    // 2. 応募情報の問題
    const applicationKeywords = result.keywords.filter(k => 
      k.includes('応募情報') || k.includes('応募履歴') || k.includes('採用ステータス') ||
      k.includes('採用決定日') || k.includes('応募管理')
    );
    console.log(`- 応募情報の問題キーワード: [${applicationKeywords.join(', ')}] (${applicationKeywords.length}個)`);
    
    // 3. 削除制限条件の問題
    const deletionLimitKeywords = result.keywords.filter(k => 
      k.includes('削除制限') || k.includes('削除条件') || k.includes('削除前チェック') ||
      k.includes('削除権限') || k.includes('論理削除')
    );
    console.log(`- 削除制限条件の問題キーワード: [${deletionLimitKeywords.join(', ')}] (${deletionLimitKeywords.length}個)`);
    
    // 4. エラーハンドリングの問題
    const errorHandlingKeywords = result.keywords.filter(k => 
      k.includes('削除エラー') || k.includes('エラーメッセージ') || k.includes('削除制限通知') ||
      k.includes('削除可能性チェック') || k.includes('エラーハンドリング')
    );
    console.log(`- エラーハンドリングの問題キーワード: [${errorHandlingKeywords.join(', ')}] (${errorHandlingKeywords.length}個)`);
    console.log('');
    
    // 制限条件テスト
    console.log('🚫 制限条件テスト:');
    
    const restrictionConditions = [
      '求人掲載状態の制限', '応募情報の制限', '採用ステータスの制限', 
      '採用決定日の制限', '削除前チェックの制限'
    ];
    
    const matchedRestrictions = restrictionConditions.filter(condition => 
      result.keywords.some(k => k.includes(condition.split('の')[0]))
    );
    
    console.log(`- 制限条件マッチ数: ${matchedRestrictions.length}/${restrictionConditions.length}`);
    console.log(`- マッチした制限条件: [${matchedRestrictions.join(', ')}]`);
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
    
    // 3.5 問題原因分類カバレッジ
    const problemCategories = [
      jobPostingKeywords.length > 0 ? 1 : 0,
      applicationKeywords.length > 0 ? 1 : 0,
      deletionLimitKeywords.length > 0 ? 1 : 0,
      errorHandlingKeywords.length > 0 ? 1 : 0
    ].filter(Boolean).length;
    const problemCoverage = problemCategories / 4;
    console.log(`- 問題原因分類カバレッジ: ${problemCoverage.toFixed(3)} (目標: 0.8以上) ${problemCoverage >= 0.8 ? '✅' : '❌'}`);
    
    // 3.6 制限条件カバレッジ
    const restrictionCoverage = matchedRestrictions.length / restrictionConditions.length;
    console.log(`- 制限条件カバレッジ: ${restrictionCoverage.toFixed(3)} (目標: 0.8以上) ${restrictionCoverage >= 0.8 ? '✅' : '❌'}`);
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
      averageScore >= 80,
      problemCoverage >= 0.8,
      restrictionCoverage >= 0.8
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
  console.log('✅ 教室削除問題キーワード抽出品質テスト完了');
}

function isClassroomDeletionRelated(keyword: string): boolean {
  const classroomDeletionTerms = [
    '教室', '削除', 'できない', '原因', '問題', '制限', '条件', 'エラー',
    '求人掲載', '応募情報', '採用ステータス', '採用決定日', '削除前チェック',
    '削除権限', '論理削除', 'エラーメッセージ', '削除制限通知', '削除可能性チェック',
    'エラーハンドリング', '応募履歴', '応募管理', '求人管理', '掲載管理',
    '物理削除', 'データ完全削除', '削除制限条件'
  ];
  
  return classroomDeletionTerms.some(term => keyword.includes(term));
}

// テスト実行
if (require.main === module) {
  testClassroomDeletionKeywordExtraction()
    .then(() => {
      // 正常終了時に明示的にexit(0)を呼ぶ
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

