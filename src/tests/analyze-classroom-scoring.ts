/*
 * 教室管理検索スコア分析
 * スコアリングアルゴリズムの改善のための分析
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function analyzeClassroomScoring() {
  console.log('=== 教室管理検索スコア分析 ===');
  
  try {
    const searchResults = await searchLanceDB({
      query: '教室管理の詳細は',
      topK: 20,
      useLunrIndex: true
    });

    console.log('=== スコア分布分析 ===');
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}: ${result.score} (${result._sourceType})`);
    });

    console.log('');
    console.log('=== スコア統計 ===');
    const scores = searchResults.map(x => x.score);
    const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const maxScore = Math.max(...scores);
    const minScore = Math.min(...scores);
    
    console.log(`平均スコア: ${averageScore.toFixed(2)}`);
    console.log(`最高スコア: ${maxScore}`);
    console.log(`最低スコア: ${minScore}`);
    console.log(`60点以上: ${scores.filter(s => s >= 60).length}件`);
    console.log(`30点以上: ${scores.filter(s => s >= 30).length}件`);
    console.log(`20点以上: ${scores.filter(s => s >= 20).length}件`);

    console.log('');
    console.log('=== 関連ページ分析 ===');
    
    // 高優先度ページ
    const highPriorityPages = [
      '160_【FIX】教室管理機能',
      '161_【FIX】教室一覧閲覧機能',
      '162_【FIX】教室新規登録機能',
      '163_【FIX】教室情報編集機能',
      '168_【FIX】教室コピー機能',
      '169-1_【FIX】教室掲載フラグ切り替え機能',
      '169-2_【FIX】教室公開フラグ切り替え機能',
      '164_【FIX】教室削除機能'
    ];

    const foundHighPriority = searchResults.filter(result => 
      highPriorityPages.some(page => result.title.includes(page))
    );

    console.log('高優先度ページ:');
    foundHighPriority.forEach(result => {
      console.log(`  ${result.title}: ${result.score}`);
    });

    console.log('');
    console.log('=== スコアリング問題の特定 ===');
    
    // スコアが低い理由を分析
    const lowScoreResults = searchResults.filter(r => r.score < 30);
    console.log(`低スコア（30点未満）: ${lowScoreResults.length}件`);
    
    lowScoreResults.forEach(result => {
      console.log(`  ${result.title}: ${result.score} (${result._sourceType})`);
    });

    console.log('');
    console.log('=== 改善提案 ===');
    console.log('1. タイトルマッチングの重みを上げる');
    console.log('2. キーワードスコアの計算を改善する');
    console.log('3. 教室管理関連キーワードの優先度を上げる');
    console.log('4. スコア正規化の調整');

  } catch (error) {
    console.error('分析エラー:', error);
  }
}

// 分析実行
analyzeClassroomScoring();
