/**
 * キーワード抽出品質テスト（統合版）
 * 複数の機能に対するキーワード抽出品質をテストします
 */

// テスト用の環境変数を事前に読み込む（app-configのインポート前に）
import { loadTestEnv } from './test-helpers/env-loader';
loadTestEnv();

interface KeywordTestCase {
  name: string;
  query: string;
  idealKeywords: string[];
  minKeywords: number;
  minAverageScore: number;
  isRelated: (keyword: string) => boolean;
  customChecks?: (keywords: string[], result: any) => {
    name: string;
    passed: boolean;
    details?: string;
  }[];
}

// テストケース定義
const TEST_CASES: KeywordTestCase[] = [
  {
    name: '教室管理',
    query: '教室管理の詳細は',
    idealKeywords: [
      "教室管理", "教室", "教室一覧", "教室登録", 
      "教室編集", "教室削除", "教室コピー", "教室管理の詳細"
    ],
    minKeywords: 5,
    minAverageScore: 60,
    isRelated: (keyword: string) => {
      const terms = ['教室', '管理', '一覧', '登録', '編集', '削除', 'コピー', '詳細'];
      return terms.some(term => keyword.includes(term));
    }
  },
  {
    name: '教室削除問題',
    query: '教室削除ができないのは何が原因ですか',
    idealKeywords: [
      "教室削除", "削除できない", "削除問題", "削除制限", 
      "教室", "削除", "求人掲載", "応募情報", "採用ステータス", 
      "削除条件", "削除エラー", "削除制限条件"
    ],
    minKeywords: 8,
    minAverageScore: 80,
    isRelated: (keyword: string) => {
      const terms = ['教室', '削除', 'できない', '原因', '問題', '制限', '条件', 'エラー'];
      return terms.some(term => keyword.includes(term));
    },
    customChecks: (keywords: string[]) => {
      const jobPostingKeywords = keywords.filter(k => 
        k.includes('求人掲載') || k.includes('求人非掲載') || k.includes('掲載状態')
      );
      const applicationKeywords = keywords.filter(k => 
        k.includes('応募情報') || k.includes('応募履歴') || k.includes('採用ステータス')
      );
      const deletionLimitKeywords = keywords.filter(k => 
        k.includes('削除制限') || k.includes('削除条件') || k.includes('削除前チェック')
      );
      const errorHandlingKeywords = keywords.filter(k => 
        k.includes('削除エラー') || k.includes('エラーメッセージ') || k.includes('削除制限通知')
      );
      
      const problemCategories = [
        jobPostingKeywords.length > 0 ? 1 : 0,
        applicationKeywords.length > 0 ? 1 : 0,
        deletionLimitKeywords.length > 0 ? 1 : 0,
        errorHandlingKeywords.length > 0 ? 1 : 0
      ].filter(Boolean).length;
      const problemCoverage = problemCategories / 4;
      
      return [{
        name: '問題原因分類カバレッジ',
        passed: problemCoverage >= 0.8,
        details: `${problemCoverage.toFixed(3)} (目標: 0.8以上)`
      }];
    }
  },
  {
    name: 'オファー機能',
    query: 'オファー機能の種類は？',
    idealKeywords: [
      "オファー機能", "オファー", "スカウト", "マッチ", 
      "パーソナルオファー", "自動オファー", "オファー一覧", 
      "オファー履歴", "オファー種類"
    ],
    minKeywords: 6,
    minAverageScore: 70,
    isRelated: (keyword: string) => {
      const terms = ['オファー', 'スカウト', 'マッチ', 'パーソナル', '自動', '一覧', '履歴', '種類'];
      return terms.some(term => keyword.includes(term));
    },
    customChecks: (keywords: string[]) => {
      const scoutKeywords = keywords.filter(k => 
        k.includes('スカウト') || k.includes('パーソナルオファー')
      );
      const matchKeywords = keywords.filter(k => 
        k.includes('マッチ') || k.includes('自動オファー')
      );
      const commonKeywords = keywords.filter(k => 
        k.includes('オファー一覧') || k.includes('オファー履歴') || k.includes('オファー種類')
      );
      
      const functionCategories = [
        scoutKeywords.length > 0 ? 1 : 0,
        matchKeywords.length > 0 ? 1 : 0,
        commonKeywords.length > 0 ? 1 : 0
      ].filter(Boolean).length;
      const coverage = functionCategories / 3;
      
      return [{
        name: '機能分類カバレッジ',
        passed: coverage >= 0.8,
        details: `${coverage.toFixed(3)} (目標: 0.8以上)`
      }];
    }
  },
  {
    name: '会員ログイン機能',
    query: '会員のログイン機能の詳細を教えて',
    idealKeywords: [
      "会員ログイン", "ログイン機能", "会員", "ログイン", 
      "ログアウト", "パスワード", "認証", "セッション", 
      "アカウントロック", "ログイン詳細", "会員認証"
    ],
    minKeywords: 8,
    minAverageScore: 75,
    isRelated: (keyword: string) => {
      const terms = ['会員', 'ログイン', 'ログアウト', '機能', '詳細', '認証', 'セッション'];
      return terms.some(term => keyword.includes(term));
    },
    customChecks: (keywords: string[]) => {
      const loginLogoutKeywords = keywords.filter(k => 
        k.includes('ログイン') || k.includes('ログアウト') || k.includes('パスワード')
      );
      const securityKeywords = keywords.filter(k => 
        k.includes('アカウントロック') || k.includes('認証') || k.includes('セッション')
      );
      const authKeywords = keywords.filter(k => 
        k.includes('認証') || k.includes('認可') || k.includes('会員認証')
      );
      
      const functionCategories = [
        loginLogoutKeywords.length > 0 ? 1 : 0,
        securityKeywords.length > 0 ? 1 : 0,
        authKeywords.length > 0 ? 1 : 0
      ].filter(Boolean).length;
      const functionCoverage = functionCategories / 3;
      
      return [{
        name: '機能分類カバレッジ',
        passed: functionCoverage >= 0.8,
        details: `${functionCoverage.toFixed(3)} (目標: 0.8以上)`
      }];
    }
  },
  {
    name: '教室コピー機能',
    query: '教室コピー機能でコピー可能な項目は？',
    idealKeywords: [
      "教室コピー", "コピー機能", "コピー可能", "可能項目", 
      "教室", "コピー", "項目", "基本情報", "求人情報", 
      "応募情報", "塾チャート", "ロゴ", "スライド画像"
    ],
    minKeywords: 10,
    minAverageScore: 80,
    isRelated: (keyword: string) => {
      const terms = ['教室', 'コピー', '機能', '項目', '可能', '基本情報', '求人情報', '応募情報'];
      return terms.some(term => keyword.includes(term));
    },
    customChecks: (keywords: string[]) => {
      const classroomInfoKeywords = keywords.filter(k => 
        k.includes('基本情報') || k.includes('応募情報') || k.includes('塾チャート') || 
        k.includes('ロゴ') || k.includes('スライド画像')
      );
      const jobInfoKeywords = keywords.filter(k => 
        k.includes('求人情報') || k.includes('勤務条件') || k.includes('指導科目')
      );
      
      const itemCategories = [
        classroomInfoKeywords.length > 0 ? 1 : 0,
        jobInfoKeywords.length > 0 ? 1 : 0
      ].filter(Boolean).length;
      const itemCoverage = itemCategories / 2;
      
      return [{
        name: '項目分類カバレッジ',
        passed: itemCoverage >= 0.8,
        details: `${itemCoverage.toFixed(3)} (目標: 0.8以上)`
      }];
    }
  }
];

/**
 * 単一のテストケースを実行
 */
async function runTestCase(testCase: KeywordTestCase): Promise<boolean> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 ${testCase.name}キーワード抽出品質テスト開始`);
  console.log('='.repeat(60));
  console.log(`🔍 テストクエリ: "${testCase.query}"`);
  console.log('');

  try {
    // 動的インポートを使用（loadTestEnv()実行後にインポート）
    const { extractKeywordsConfigured } = await import('../lib/keyword-extractor-wrapper.js');
    
    const result = await extractKeywordsConfigured(testCase.query);
    
    console.log('🔑 実際の抽出キーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    
    console.log('');
    console.log('📊 統計情報:');
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- キーワードソース: ${result.metadata.keywordSource}`);
    console.log(`- 処理時間: ${result.metadata.processingTime}ms`);
    
    console.log('');
    console.log('✅ 理想のキーワードとの比較:');
    console.log(`- 理想のキーワード: [${testCase.idealKeywords.join(', ')}]`);
    console.log(`- 実際のキーワード: [${result.keywords.join(', ')}]`);

    const matchedKeywords = testCase.idealKeywords.filter(ideal => 
      result.keywords.some(actual => actual.includes(ideal))
    );
    
    const missingKeywords = testCase.idealKeywords.filter(ideal => 
      !result.keywords.some(actual => actual.includes(ideal))
    );
    
    const irrelevantKeywords = result.keywords.filter(actual => 
      !testCase.idealKeywords.some(ideal => ideal.includes(actual)) &&
      !testCase.isRelated(actual)
    );

    console.log(`- マッチしたキーワード: [${matchedKeywords.join(', ')}] (${matchedKeywords.length}/${testCase.idealKeywords.length})`);
    console.log(`- 不足しているキーワード: [${missingKeywords.join(', ')}]`);
    console.log(`- 無関係なキーワード: [${irrelevantKeywords.join(', ')}]`);
    console.log('');

    // 合格基準の評価
    console.log('📋 合格基準の評価:');
    
    const keywordScore = matchedKeywords.length > 0 ? 1 : 0;
    console.log(`- キーワードスコアが0でない: ${keywordScore ? '✅' : '❌'}`);
    
    const hasSplitKeywords = result.keywords.some(k => 
      testCase.idealKeywords.some(ideal => k.includes(ideal))
    );
    console.log(`- 分割されたキーワードが正しく抽出される: ${hasSplitKeywords ? '✅' : '❌'}`);
    
    const hasTitleMatching = result.keywords.some(k => 
      testCase.idealKeywords.some(ideal => k === ideal || k.includes(ideal))
    );
    console.log(`- タイトルマッチングが正しく動作する: ${hasTitleMatching ? '✅' : '❌'}`);
    
    const similarityScore = matchedKeywords.length / testCase.idealKeywords.length;
    console.log(`- 理想のキーワード抽出結果に近い結果が得られる: ${similarityScore >= 0.5 ? '✅' : '❌'} (${(similarityScore * 100).toFixed(1)}%)`);
    
    const hasEnoughKeywords = result.keywords.length >= testCase.minKeywords;
    console.log(`- キーワード数が${testCase.minKeywords}個以上: ${hasEnoughKeywords ? '✅' : '❌'} (${result.keywords.length}個)`);
    
    const hasFunctionNames = result.keywords.some(k => 
      testCase.idealKeywords.some(ideal => k.includes(ideal))
    );
    console.log(`- 機能に関連する具体的な名前が含まれる: ${hasFunctionNames ? '✅' : '❌'}`);
    console.log('');

    // カスタムチェック
    if (testCase.customChecks) {
      console.log('🔧 追加チェック:');
      const customResults = testCase.customChecks(result.keywords, result);
      customResults.forEach(check => {
        console.log(`- ${check.name}: ${check.passed ? '✅' : '❌'} ${check.details || ''}`);
      });
      console.log('');
    }

    // 品質メトリクスの計算
    console.log('📈 品質メトリクスの計算:');
    
    const relevantKeywords = result.keywords.filter(k => 
      !irrelevantKeywords.includes(k)
    );
    const precision = result.keywords.length > 0 ? relevantKeywords.length / result.keywords.length : 0;
    console.log(`- 検索精度（Precision）: ${precision.toFixed(3)} (目標: 0.8以上) ${precision >= 0.8 ? '✅' : '❌'}`);
    
    const recall = testCase.idealKeywords.length > 0 ? matchedKeywords.length / testCase.idealKeywords.length : 0;
    console.log(`- 検索再現率（Recall）: ${recall.toFixed(3)} (目標: 0.7以上) ${recall >= 0.7 ? '✅' : '❌'}`);
    
    const f1Score = precision > 0 && recall > 0 ? 
      2 * (precision * recall) / (precision + recall) : 0;
    console.log(`- F1スコア: ${f1Score.toFixed(3)} (目標: 0.75以上) ${f1Score >= 0.75 ? '✅' : '❌'}`);
    
    const averageScore = result.keywords.length > 0 ? relevantKeywords.length / result.keywords.length * 100 : 0;
    console.log(`- 平均スコア: ${averageScore.toFixed(1)} (目標: ${testCase.minAverageScore}以上) ${averageScore >= testCase.minAverageScore ? '✅' : '❌'}`);
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
      averageScore >= testCase.minAverageScore,
      ...(testCase.customChecks ? testCase.customChecks(result.keywords, result).map(c => c.passed) : [])
    ].filter(Boolean).length;
    
    const totalCriteria = 10 + (testCase.customChecks ? testCase.customChecks(result.keywords, result).length : 0);
    const overallScore = (passedCriteria / totalCriteria) * 100;
    
    console.log(`- 合格基準: ${passedCriteria}/${totalCriteria} (${overallScore.toFixed(1)}%)`);
    
    if (overallScore >= 80) {
      console.log('🎉 品質テスト: PASS');
      return true;
    } else if (overallScore >= 60) {
      console.log('⚠️  品質テスト: PARTIAL PASS');
      return true;
    } else {
      console.log('❌ 品質テスト: FAIL');
      return false;
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    return false;
  } finally {
    console.log('');
    console.log('='.repeat(60));
    console.log(`✅ ${testCase.name}キーワード抽出品質テスト完了`);
  }
}

/**
 * すべてのテストケースを実行
 */
async function runKeywordQualityTest(testCaseName?: string): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 キーワード抽出品質テスト開始（統合版）');
  console.log('='.repeat(60));
  console.log(`全${TEST_CASES.length}個のテストケースを実行します...\n`);

  const testCasesToRun = testCaseName 
    ? TEST_CASES.filter(tc => tc.name === testCaseName)
    : TEST_CASES;

  if (testCasesToRun.length === 0) {
    console.error(`❌ テストケース "${testCaseName}" が見つかりません`);
    process.exit(1);
  }

  const results: { name: string; passed: boolean }[] = [];

  for (const testCase of testCasesToRun) {
    const passed = await runTestCase(testCase);
    results.push({ name: testCase.name, passed });
  }

  // 全体サマリー
  console.log('\n' + '='.repeat(60));
  console.log('📊 全体サマリー');
  console.log('='.repeat(60));
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}: ${result.passed ? 'PASS' : 'FAIL'}`);
  });
  
  console.log(`\n合計: ${passedCount}/${totalCount} テストが成功`);
  
  if (passedCount === totalCount) {
    console.log('🎉 すべてのテストが成功しました');
    process.exit(0);
  } else {
    console.log('⚠️  一部のテストが失敗しました');
    process.exit(1);
  }
}

// テスト実行
if (require.main === module) {
  const testCaseName = process.argv[2];
  runKeywordQualityTest(testCaseName)
    .then(() => {
      // 正常終了時に明示的にexit(0)を呼ぶ
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 予期しないエラー:', error);
      process.exit(1);
    });
}

export { runKeywordQualityTest, TEST_CASES };
