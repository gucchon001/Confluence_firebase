/**
 * スコアリングの詳細分析スクリプト
 */

import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function analyzeScoring() {
  console.log('=== スコアリングの詳細分析 ===');
  
  const query = '教室削除ができないのは何が原因ですか';
  console.log(`クエリ: "${query}"`);
  
  try {
    const results = await searchLanceDB({
      query,
      topK: 20,
      useLunrIndex: true,
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });
    
    console.log(`\n検索結果数: ${results.length}件`);
    
    // スコアリングの詳細分析
    console.log('\n=== スコアリング詳細分析 ===');
    
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   - スコア: ${result.score}`);
      console.log(`   - ソース: ${result.source}`);
      console.log(`   - 距離: ${result.distance || 'N/A'}`);
      console.log(`   - ラベル: ${result.labels?.join(', ') || 'なし'}`);
      
      // スコアの内訳分析
      if (result.score !== undefined) {
        console.log(`   - スコア分析:`);
        
        // 期待スコアとの比較
        const expectedScore = getExpectedScore(result.title);
        if (expectedScore > 0) {
          const difference = result.score - expectedScore;
          console.log(`     * 期待スコア: ${expectedScore}, 実際: ${result.score}, 差: ${difference}`);
        }
        
        // スコアの妥当性
        if (result.score < 50) {
          console.log(`     * 低スコア警告: ${result.score} < 50`);
        } else if (result.score >= 80) {
          console.log(`     * 高スコア: ${result.score} >= 80`);
        }
      }
    });
    
    // スコア分布の分析
    console.log('\n=== スコア分布分析 ===');
    const scores = results.map(r => r.score || 0);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    console.log(`最小スコア: ${minScore}`);
    console.log(`最大スコア: ${maxScore}`);
    console.log(`平均スコア: ${avgScore.toFixed(1)}`);
    console.log(`スコア範囲: ${maxScore - minScore}`);
    
    // スコアの分布
    const lowScores = scores.filter(s => s < 50).length;
    const mediumScores = scores.filter(s => s >= 50 && s < 80).length;
    const highScores = scores.filter(s => s >= 80).length;
    
    console.log(`\nスコア分布:`);
    console.log(`  - 低スコア (<50): ${lowScores}件`);
    console.log(`  - 中スコア (50-79): ${mediumScores}件`);
    console.log(`  - 高スコア (≥80): ${highScores}件`);
    
    // 理想のページのスコア分析
    console.log('\n=== 理想のページのスコア分析 ===');
    const idealPages = [
      '164_【FIX】教室削除機能',
      '教室削除の制限条件',
      '教室削除エラー処理',
      '求人掲載状態管理',
      '求人非掲載機能',
      '教室と求人の紐づけ管理',
      '【FIX】応募情報',
      '応募履歴管理',
      '採用ステータス管理',
      '採用決定日管理'
    ];
    
    const idealResults = results.filter(result => 
      idealPages.some(page => result.title.includes(page))
    );
    
    console.log(`理想のページ数: ${idealPages.length}件`);
    console.log(`見つかった理想のページ数: ${idealResults.length}件`);
    
    if (idealResults.length > 0) {
      console.log(`理想のページのスコア:`);
      idealResults.forEach(result => {
        const expectedScore = getExpectedScore(result.title);
        console.log(`  - ${result.title}: ${result.score} (期待: ${expectedScore})`);
      });
    }
    
    // スコアリングの問題点の特定
    console.log('\n=== スコアリング問題点の特定 ===');
    
    // 1. 低スコアの問題
    const lowScoreResults = results.filter(r => (r.score || 0) < 50);
    if (lowScoreResults.length > 0) {
      console.log(`低スコアの問題: ${lowScoreResults.length}件`);
      lowScoreResults.forEach(result => {
        console.log(`  - ${result.title}: ${result.score}`);
      });
    }
    
    // 2. 期待スコアとの乖離
    const scoreDeviations = results.map(result => {
      const expectedScore = getExpectedScore(result.title);
      if (expectedScore > 0) {
        const deviation = Math.abs((result.score || 0) - expectedScore);
        return { title: result.title, deviation, expected: expectedScore, actual: result.score };
      }
      return null;
    }).filter(Boolean);
    
    if (scoreDeviations.length > 0) {
      console.log(`\n期待スコアとの乖離:`);
      scoreDeviations.forEach(item => {
        console.log(`  - ${item.title}: 期待${item.expected} vs 実際${item.actual} (乖離: ${item.deviation})`);
      });
    }
    
    // 3. スコアの順序の問題
    console.log(`\nスコア順序の分析:`);
    const sortedByScore = [...results].sort((a, b) => (b.score || 0) - (a.score || 0));
    console.log(`上位3件のスコア順序:`);
    sortedByScore.slice(0, 3).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}: ${result.score}`);
    });
    
  } catch (error) {
    console.error('スコアリング分析エラー:', error);
  }
}

function getExpectedScore(title: string): number {
  // 理想のページの期待スコア
  if (title.includes('164_【FIX】教室削除機能')) return 90;
  if (title.includes('教室削除の制限条件')) return 85;
  if (title.includes('教室削除エラー処理')) return 80;
  if (title.includes('求人掲載状態管理')) return 80;
  if (title.includes('求人非掲載機能')) return 75;
  if (title.includes('教室と求人の紐づけ管理')) return 70;
  if (title.includes('【FIX】応募情報')) return 85;
  if (title.includes('応募履歴管理')) return 80;
  if (title.includes('採用ステータス管理')) return 75;
  if (title.includes('採用決定日管理')) return 70;
  
  // その他のページは期待スコアなし
  return 0;
}

analyzeScoring().catch(console.error);
