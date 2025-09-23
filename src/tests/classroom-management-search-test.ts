import { searchLanceDB } from '../lib/lancedb-search-client';
import { extractKeywordsHybrid } from '../lib/keyword-extractor';

interface TestResult {
  testName: string;
  passed: boolean;
  score: number;
  maxScore: number;
  details: string[];
  errors: string[];
}

interface QualityMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  averageScore: number;
}

class ClassroomManagementSearchQualityTest {
  private idealPages = {
    high: [
      '160_【FIX】教室管理機能',
      '161_【FIX】教室一覧閲覧機能',
      '162_【FIX】教室新規登録機能',
      '163_【FIX】教室情報編集機能',
      '168_【FIX】教室コピー機能',
      '169-1_【FIX】教室掲載フラグ切り替え機能',
      '169-2_【FIX】教室公開フラグ切り替え機能',
      '164_【FIX】教室削除機能'
    ],
    medium: [
      '511_【FIX】教室管理-求人一覧閲覧機能',
      '512_【FIX】教室管理-求人情報新規登録機能',
      '513_【FIX】教室管理-求人情報編集機能',
      '514_【レビュー中】教室管理-求人削除機能',
      '515_【作成中】教室管理-教室コピー機能',
      '516_【FIX】教室管理-一括更新機能'
    ],
    low: [
      '【FIX】教室：基本情報／所在地',
      '【FIX】教室：応募情報転送連絡先／応募後連絡先電話番号',
      '【FIX】教室：塾チャート',
      '【FIX】教室：ロゴ・スライド画像'
    ]
  };

  private excludedPages = [
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

  async runAllTests(): Promise<{ results: TestResult[], metrics: QualityMetrics, overallPassed: boolean }> {
    console.log('=== 教室管理検索品質テスト開始 ===\n');

    const results: TestResult[] = [];
    
    // テスト1: 基本検索テスト
    results.push(await this.testBasicSearch());
    
    // テスト2: キーワードマッチングテスト
    results.push(await this.testKeywordMatching());
    
    // テスト3: スコアリングテスト
    results.push(await this.testScoring());
    
    // テスト4: 除外ページテスト
    results.push(await this.testExcludedPages());

    // 品質メトリクス計算
    const metrics = await this.calculateQualityMetrics();
    
    // 全体の合格判定
    const overallPassed = results.every(r => r.passed) && 
                         metrics.precision >= 0.8 && 
                         metrics.recall >= 0.7 && 
                         metrics.f1Score >= 0.75 && 
                         metrics.averageScore >= 60;

    return { results, metrics, overallPassed };
  }

  private async testBasicSearch(): Promise<TestResult> {
    console.log('テスト1: 基本検索テスト');
    
    try {
      const searchResults = await searchLanceDB({ 
        query: '教室管理の詳細は', 
        topK: 20 
      });

      const details: string[] = [];
      const errors: string[] = [];
      let score = 0;
      const maxScore = 100;

      // 結果数の確認
      details.push(`検索結果数: ${searchResults.length}`);
      if (searchResults.length >= 8 && searchResults.length <= 12) {
        score += 20;
        details.push('✓ 結果数が適切 (8-12件)');
      } else {
        errors.push(`✗ 結果数が不適切: ${searchResults.length}件 (期待値: 8-12件)`);
      }

      // 主要な教室管理機能ページの確認
      const foundHighPriorityPages = this.idealPages.high.filter(idealPage => 
        searchResults.some(result => result.title.includes(idealPage))
      );
      
      details.push(`見つかった主要ページ: ${foundHighPriorityPages.length}/${this.idealPages.high.length}`);
      if (foundHighPriorityPages.length >= 5) {
        score += 40;
        details.push('✓ 主要ページが5件以上見つかった');
      } else {
        errors.push(`✗ 主要ページが不足: ${foundHighPriorityPages.length}件 (期待値: 5件以上)`);
      }

      // 上位3件のスコア確認
      const top3Scores = searchResults.slice(0, 3).map(r => r.score);
      const avgTop3Score = top3Scores.reduce((a, b) => a + b, 0) / top3Scores.length;
      
      details.push(`上位3件の平均スコア: ${avgTop3Score.toFixed(2)}`);
      if (avgTop3Score >= 60) {
        score += 20;
        details.push('✓ 上位3件のスコアが60以上');
      } else {
        errors.push(`✗ 上位3件のスコアが不足: ${avgTop3Score.toFixed(2)} (期待値: 60以上)`);
      }

      // 除外ページの確認
      const foundExcludedPages = this.excludedPages.filter(excludedPage => 
        searchResults.some(result => result.title.includes(excludedPage))
      );
      
      details.push(`除外されるべきページが含まれている数: ${foundExcludedPages.length}`);
      if (foundExcludedPages.length === 0) {
        score += 20;
        details.push('✓ 除外ページが含まれていない');
      } else {
        errors.push(`✗ 除外ページが含まれている: ${foundExcludedPages.join(', ')}`);
      }

      const passed = score >= 80;
      console.log(`  結果: ${passed ? 'PASS' : 'FAIL'} (${score}/${maxScore})`);
      if (errors.length > 0) {
        console.log(`  エラー: ${errors.join(', ')}`);
      }

      return {
        testName: '基本検索テスト',
        passed,
        score,
        maxScore,
        details,
        errors
      };

    } catch (error) {
      return {
        testName: '基本検索テスト',
        passed: false,
        score: 0,
        maxScore: 100,
        details: [],
        errors: [`テスト実行エラー: ${error}`]
      };
    }
  }

  private async testKeywordMatching(): Promise<TestResult> {
    console.log('テスト2: キーワードマッチングテスト');
    
    try {
      const keywordResult = await extractKeywordsHybrid('教室管理の詳細は');
      
      const details: string[] = [];
      const errors: string[] = [];
      let score = 0;
      const maxScore = 100;

      // キーワード抽出の確認
      details.push(`抽出キーワード: [${keywordResult.keywords.join(', ')}]`);
      details.push(`キーワード数: ${keywordResult.keywords.length}`);
      
      if (keywordResult.keywords.length > 0) {
        score += 30;
        details.push('✓ キーワードが抽出された');
      } else {
        errors.push('✗ キーワードが抽出されていない');
      }

      // 重要なキーワードの確認
      const importantKeywords = ['教室', '管理', '詳細', '仕様', '機能'];
      const foundKeywords = importantKeywords.filter(kw => 
        keywordResult.keywords.some(extracted => extracted.includes(kw))
      );
      
      details.push(`見つかった重要キーワード: [${foundKeywords.join(', ')}]`);
      if (foundKeywords.length >= 3) {
        score += 40;
        details.push('✓ 重要キーワードが3つ以上見つかった');
      } else {
        errors.push(`✗ 重要キーワードが不足: ${foundKeywords.length}個 (期待値: 3個以上)`);
      }

      // 分割キーワードの確認
      const hasSplitKeywords = keywordResult.keywords.some(kw => 
        kw.includes('教室管理') || kw.includes('詳細な仕様')
      );
      
      if (hasSplitKeywords) {
        score += 30;
        details.push('✓ 分割キーワードが正しく抽出された');
      } else {
        errors.push('✗ 分割キーワードが抽出されていない');
      }

      const passed = score >= 80;
      console.log(`  結果: ${passed ? 'PASS' : 'FAIL'} (${score}/${maxScore})`);
      if (errors.length > 0) {
        console.log(`  エラー: ${errors.join(', ')}`);
      }

      return {
        testName: 'キーワードマッチングテスト',
        passed,
        score,
        maxScore,
        details,
        errors
      };

    } catch (error) {
      return {
        testName: 'キーワードマッチングテスト',
        passed: false,
        score: 0,
        maxScore: 100,
        details: [],
        errors: [`テスト実行エラー: ${error}`]
      };
    }
  }

  private async testScoring(): Promise<TestResult> {
    console.log('テスト3: スコアリングテスト');
    
    try {
      const searchResults = await searchLanceDB({ 
        query: '教室管理の詳細は', 
        topK: 20 
      });

      const details: string[] = [];
      const errors: string[] = [];
      let score = 0;
      const maxScore = 100;

      // スコア分布の確認
      const highPriorityScores = searchResults
        .filter(result => this.idealPages.high.some(ideal => result.title.includes(ideal)))
        .map(result => result.score);
      
      const mediumPriorityScores = searchResults
        .filter(result => this.idealPages.medium.some(ideal => result.title.includes(ideal)))
        .map(result => result.score);
      
      const lowPriorityScores = searchResults
        .filter(result => this.idealPages.low.some(ideal => result.title.includes(ideal)))
        .map(result => result.score);

      details.push(`高優先度ページのスコア: ${highPriorityScores.map(s => s.toFixed(2)).join(', ')}`);
      details.push(`中優先度ページのスコア: ${mediumPriorityScores.map(s => s.toFixed(2)).join(', ')}`);
      details.push(`低優先度ページのスコア: ${lowPriorityScores.map(s => s.toFixed(2)).join(', ')}`);

      // 高優先度ページのスコア確認
      const avgHighScore = highPriorityScores.length > 0 ? 
        highPriorityScores.reduce((a, b) => a + b, 0) / highPriorityScores.length : 0;
      
      if (avgHighScore >= 70) {
        score += 40;
        details.push(`✓ 高優先度ページの平均スコア: ${avgHighScore.toFixed(2)} (期待値: 70以上)`);
      } else {
        errors.push(`✗ 高優先度ページの平均スコアが不足: ${avgHighScore.toFixed(2)} (期待値: 70以上)`);
      }

      // 中優先度ページのスコア確認
      const avgMediumScore = mediumPriorityScores.length > 0 ? 
        mediumPriorityScores.reduce((a, b) => a + b, 0) / mediumPriorityScores.length : 0;
      
      if (avgMediumScore >= 50) {
        score += 30;
        details.push(`✓ 中優先度ページの平均スコア: ${avgMediumScore.toFixed(2)} (期待値: 50以上)`);
      } else {
        errors.push(`✗ 中優先度ページの平均スコアが不足: ${avgMediumScore.toFixed(2)} (期待値: 50以上)`);
      }

      // 低優先度ページのスコア確認
      const avgLowScore = lowPriorityScores.length > 0 ? 
        lowPriorityScores.reduce((a, b) => a + b, 0) / lowPriorityScores.length : 0;
      
      if (avgLowScore >= 40) {
        score += 30;
        details.push(`✓ 低優先度ページの平均スコア: ${avgLowScore.toFixed(2)} (期待値: 40以上)`);
      } else {
        errors.push(`✗ 低優先度ページの平均スコアが不足: ${avgLowScore.toFixed(2)} (期待値: 40以上)`);
      }

      const passed = score >= 80;
      console.log(`  結果: ${passed ? 'PASS' : 'FAIL'} (${score}/${maxScore})`);
      if (errors.length > 0) {
        console.log(`  エラー: ${errors.join(', ')}`);
      }

      return {
        testName: 'スコアリングテスト',
        passed,
        score,
        maxScore,
        details,
        errors
      };

    } catch (error) {
      return {
        testName: 'スコアリングテスト',
        passed: false,
        score: 0,
        maxScore: 100,
        details: [],
        errors: [`テスト実行エラー: ${error}`]
      };
    }
  }

  private async testExcludedPages(): Promise<TestResult> {
    console.log('テスト4: 除外ページテスト');
    
    try {
      const searchResults = await searchLanceDB({ 
        query: '教室管理の詳細は', 
        topK: 20 
      });

      const details: string[] = [];
      const errors: string[] = [];
      let score = 0;
      const maxScore = 100;

      // 除外ページの確認
      const foundExcludedPages = this.excludedPages.filter(excludedPage => 
        searchResults.some(result => result.title.includes(excludedPage))
      );
      
      details.push(`除外されるべきページ: ${this.excludedPages.length}件`);
      details.push(`検索結果に含まれている除外ページ: ${foundExcludedPages.length}件`);
      
      if (foundExcludedPages.length === 0) {
        score += 100;
        details.push('✓ 除外ページが含まれていない');
      } else {
        errors.push(`✗ 除外ページが含まれている: ${foundExcludedPages.join(', ')}`);
        score += Math.max(0, 100 - foundExcludedPages.length * 20);
      }

      const passed = score >= 80;
      console.log(`  結果: ${passed ? 'PASS' : 'FAIL'} (${score}/${maxScore})`);
      if (errors.length > 0) {
        console.log(`  エラー: ${errors.join(', ')}`);
      }

      return {
        testName: '除外ページテスト',
        passed,
        score,
        maxScore,
        details,
        errors
      };

    } catch (error) {
      return {
        testName: '除外ページテスト',
        passed: false,
        score: 0,
        maxScore: 100,
        details: [],
        errors: [`テスト実行エラー: ${error}`]
      };
    }
  }

  private async calculateQualityMetrics(): Promise<QualityMetrics> {
    try {
      const searchResults = await searchLanceDB({ 
        query: '教室管理の詳細は', 
        topK: 20 
      });

      // 理想の関連ページ（すべての優先度を統合）
      const allIdealPages = [...this.idealPages.high, ...this.idealPages.medium, ...this.idealPages.low];
      
      // 検索結果に含まれる関連ページ
      const foundRelevantPages = searchResults.filter(result => 
        allIdealPages.some(ideal => result.title.includes(ideal))
      );

      // 除外されるべきページ
      const foundExcludedPages = searchResults.filter(result => 
        this.excludedPages.some(excluded => result.title.includes(excluded))
      );

      // 関連するページ（除外ページを除く）
      const relevantPages = foundRelevantPages.filter(result => 
        !this.excludedPages.some(excluded => result.title.includes(excluded))
      );

      // 精度（Precision）
      const precision = searchResults.length > 0 ? relevantPages.length / searchResults.length : 0;

      // 再現率（Recall）
      const recall = allIdealPages.length > 0 ? relevantPages.length / allIdealPages.length : 0;

      // F1スコア
      const f1Score = (precision + recall) > 0 ? 2 * (precision * recall) / (precision + recall) : 0;

      // 平均スコア
      const averageScore = searchResults.length > 0 ? 
        searchResults.reduce((sum, result) => sum + result.score, 0) / searchResults.length : 0;

      return {
        precision,
        recall,
        f1Score,
        averageScore
      };

    } catch (error) {
      console.error('品質メトリクス計算エラー:', error);
      return {
        precision: 0,
        recall: 0,
        f1Score: 0,
        averageScore: 0
      };
    }
  }

  printResults(results: TestResult[], metrics: QualityMetrics, overallPassed: boolean): void {
    console.log('\n=== テスト結果サマリー ===');
    
    results.forEach(result => {
      console.log(`\n${result.testName}:`);
      console.log(`  結果: ${result.passed ? 'PASS' : 'FAIL'} (${result.score}/${result.maxScore})`);
      if (result.details.length > 0) {
        console.log(`  詳細:`);
        result.details.forEach(detail => console.log(`    ${detail}`));
      }
      if (result.errors.length > 0) {
        console.log(`  エラー:`);
        result.errors.forEach(error => console.log(`    ${error}`));
      }
    });

    console.log('\n=== 品質メトリクス ===');
    console.log(`精度 (Precision): ${metrics.precision.toFixed(3)} (目標値: 0.8以上)`);
    console.log(`再現率 (Recall): ${metrics.recall.toFixed(3)} (目標値: 0.7以上)`);
    console.log(`F1スコア: ${metrics.f1Score.toFixed(3)} (目標値: 0.75以上)`);
    console.log(`平均スコア: ${metrics.averageScore.toFixed(2)} (目標値: 60以上)`);

    console.log('\n=== 全体判定 ===');
    console.log(`品質クリア: ${overallPassed ? 'YES' : 'NO'}`);
    
    if (overallPassed) {
      console.log('🎉 すべての品質基準をクリアしています！');
    } else {
      console.log('❌ 品質基準をクリアしていません。改善が必要です。');
    }
  }
}

// テスト実行
async function runQualityTest() {
  const tester = new ClassroomManagementSearchQualityTest();
  const { results, metrics, overallPassed } = await tester.runAllTests();
  tester.printResults(results, metrics, overallPassed);
  
  // テスト結果をファイルに保存
  const fs = require('fs');
  const testReport = {
    timestamp: new Date().toISOString(),
    overallPassed,
    results,
    metrics
  };
  
  fs.writeFileSync('test-results/classroom-management-quality-test.json', JSON.stringify(testReport, null, 2));
  console.log('\nテスト結果を test-results/classroom-management-quality-test.json に保存しました。');
}

if (require.main === module) {
  runQualityTest().catch(console.error);
}

export { ClassroomManagementSearchQualityTest };
