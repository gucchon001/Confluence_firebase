import { searchLanceDB } from './src/lib/lancedb-search-client';

// 理想の抽出ページ（優先度：高）
const HIGH_PRIORITY_PAGES = [
    '160_【FIX】教室管理機能',
    '161_【FIX】教室一覧閲覧機能',
    '162_【FIX】教室新規登録機能',
    '163_【FIX】教室情報編集機能',
    '168_【FIX】教室コピー機能',
    '169-1_【FIX】教室掲載フラグ切り替え機能',
    '169-2_【FIX】教室公開フラグ切り替え機能',
    '164_【FIX】教室削除機能'
];

// 関連する求人管理ページ（優先度：中）
const MEDIUM_PRIORITY_PAGES = [
    '511_【FIX】教室管理-求人一覧閲覧機能',
    '512_【FIX】教室管理-求人情報新規登録機能',
    '513_【FIX】教室管理-求人情報編集機能',
    '514_【レビュー中】教室管理-求人削除機能',
    '515_【作成中】教室管理-教室コピー機能',
    '516_【FIX】教室管理-一括更新機能'
];

// 関連する基本情報ページ（優先度：中）
const BASIC_INFO_PAGES = [
    '【FIX】教室：基本情報／所在地',
    '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号',
    '【FIX】教室：塾チャート',
    '【FIX】教室：ロゴ・スライド画像'
];

// 除外されるべきページ
const EXCLUDED_PAGES = [
  '500_■教室管理機能',
  '510_■教室管理-求人管理機能',
  '010_■求人・教室管理機能',
  '塾講師ステーションドキュメントスペース',
  '710_■教室・求人情報関連バッチ',
  '910_■企業・教室グループ・教室',
  'レコメンドデータ',
  '教室アクセスデータ',
  '【作成中】塾チャート'
];

function isExpectedPage(title: string): { priority: string; found: boolean } {
  if (HIGH_PRIORITY_PAGES.some(page => title.includes(page))) {
    return { priority: 'high', found: true };
  }
  if (MEDIUM_PRIORITY_PAGES.some(page => title.includes(page))) {
    return { priority: 'medium', found: true };
  }
  if (BASIC_INFO_PAGES.some(page => title.includes(page))) {
    return { priority: 'basic', found: true };
  }
  if (EXCLUDED_PAGES.some(page => title.includes(page))) {
    return { priority: 'excluded', found: true };
  }
  return { priority: 'other', found: false };
}

async function runQualityTest() {
  console.log('🚀 教室管理検索品質テスト開始');
  console.log('=' .repeat(50));
  
  try {
    console.log('🔍 テストケース1: 基本検索テスト');
    console.log('クエリ: 教室管理の詳細は');
    
    const results = await searchLanceDB({
      query: '教室管理の詳細は',
      topK: 20,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    
    console.log(`📊 検索結果: ${results.length}件`);
    
    // メトリクス計算
    const totalResults = results.length;
    let highPriorityFound = 0;
    let mediumPriorityFound = 0;
    let basicInfoFound = 0;
    let excludedFound = 0;
    
    const top3Scores = results.slice(0, 3).map(r => r.score);
    const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalResults;
    
    // 各ページの分類
    results.forEach(result => {
      const { priority } = isExpectedPage(result.title);
      switch (priority) {
        case 'high':
          highPriorityFound++;
          break;
        case 'medium':
          mediumPriorityFound++;
          break;
        case 'basic':
          basicInfoFound++;
          break;
        case 'excluded':
          excludedFound++;
          break;
      }
    });
    
    // 関連ページ数（除外ページを除く）
    const relevantPages = highPriorityFound + mediumPriorityFound + basicInfoFound;
    
    // Precision = 関連するページ数 / 検索結果総数
    const precision = relevantPages / totalResults;
    
    // Recall = 検索結果に含まれる関連ページ数 / 理想の関連ページ総数
    const totalExpectedPages = HIGH_PRIORITY_PAGES.length + MEDIUM_PRIORITY_PAGES.length + BASIC_INFO_PAGES.length;
    const recall = relevantPages / totalExpectedPages;
    
    // F1スコア
    const f1Score = precision + recall > 0 ? 2 * (precision * recall) / (precision + recall) : 0;
    
    // 結果表示
    console.log('\n📋 検索結果詳細:');
    results.forEach((result, index) => {
      const { priority } = isExpectedPage(result.title);
      const priorityIcon = priority === 'high' ? '🔥' : 
                         priority === 'medium' ? '⭐' : 
                         priority === 'basic' ? '📄' : 
                         priority === 'excluded' ? '❌' : '❓';
      
      console.log(`${index + 1}. ${priorityIcon} ${result.title}`);
      console.log(`   スコア: ${result.score}, ラベル: ${JSON.stringify(result.labels)}, ソース: ${result.source}`);
    });
    
    console.log('\n📊 品質評価結果:');
    
    // 合格基準のチェック
    const criteria = {
      precision: precision >= 0.8,
      recall: recall >= 0.7,
      f1Score: f1Score >= 0.75,
      averageScore: averageScore >= 60,
      highPriorityFound: highPriorityFound >= 5,
      noExcludedPages: excludedFound === 0,
      top3Scores: top3Scores.every(score => score >= 60)
    };
    
    console.log('合格基準チェック:');
    console.log(`✅ Precision (目標: 0.8+): ${precision.toFixed(3)} ${criteria.precision ? '✅' : '❌'}`);
    console.log(`✅ Recall (目標: 0.7+): ${recall.toFixed(3)} ${criteria.recall ? '✅' : '❌'}`);
    console.log(`✅ F1スコア (目標: 0.75+): ${f1Score.toFixed(3)} ${criteria.f1Score ? '✅' : '❌'}`);
    console.log(`✅ 平均スコア (目標: 60+): ${averageScore.toFixed(2)} ${criteria.averageScore ? '✅' : '❌'}`);
    console.log(`✅ 主要ページ検出 (目標: 5件+): ${highPriorityFound}件 ${criteria.highPriorityFound ? '✅' : '❌'}`);
    console.log(`✅ 除外ページ除外 (目標: 0件): ${excludedFound}件 ${criteria.noExcludedPages ? '✅' : '❌'}`);
    console.log(`✅ 上位3件スコア (目標: 60+): ${criteria.top3Scores ? '✅' : '❌'}`);
    
    const passedCriteria = Object.values(criteria).filter(Boolean).length;
    const totalCriteria = Object.keys(criteria).length;
    
    console.log(`\n🎯 総合評価: ${passedCriteria}/${totalCriteria} 基準をクリア`);
    
    if (passedCriteria === totalCriteria) {
      console.log('🎉 すべての品質基準をクリアしました！');
    } else {
      console.log('⚠️ 一部の品質基準をクリアできませんでした。改善が必要です。');
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ 教室管理検索品質テスト完了');

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    process.exit(1);
  }
}

runQualityTest();
