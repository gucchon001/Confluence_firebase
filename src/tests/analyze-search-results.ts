/**
 * 検索結果の詳細分析スクリプト
 */

import 'dotenv/config';
import { searchLanceDB } from '../lib/lancedb-search-client';

async function analyzeSearchResults() {
  console.log('=== 検索結果詳細分析 ===');
  
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
    console.log('\n=== 検索結果詳細 ===');
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   - スコア: ${result.score}`);
      console.log(`   - ラベル: ${result.labels?.join(', ') || 'なし'}`);
      console.log(`   - ソース: ${result.source}`);
      console.log(`   - 距離: ${result.distance || 'N/A'}`);
      console.log(`   - コンテンツ: ${result.content?.substring(0, 100)}...`);
      console.log('');
    });
    
    // 理想のページとの比較
    console.log('=== 理想のページとの比較 ===');
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
    
    const foundIdealPages = results.filter(result => 
      idealPages.some(page => result.title.includes(page))
    );
    
    console.log(`理想のページ数: ${idealPages.length}件`);
    console.log(`見つかった理想のページ数: ${foundIdealPages.length}件`);
    console.log(`見つかった理想のページ:`);
    foundIdealPages.forEach(page => {
      console.log(`  - ${page.title}`);
    });
    
    // 除外されるべきページとの比較
    console.log('\n=== 除外されるべきページとの比較 ===');
    const excludedPages = [
      '■教室管理機能',
      '■削除機能',
      '■エラーハンドリング',
      '教室統計データ',
      '教室作成ログ',
      '【作成中】教室復元機能',
      '教室物理削除機能',
      'データ完全削除機能'
    ];
    
    const foundExcludedPages = results.filter(result => 
      excludedPages.some(page => result.title.includes(page))
    );
    
    console.log(`除外されるべきページ数: ${excludedPages.length}件`);
    console.log(`見つかった除外ページ数: ${foundExcludedPages.length}件`);
    if (foundExcludedPages.length > 0) {
      console.log(`見つかった除外ページ:`);
      foundExcludedPages.forEach(page => {
        console.log(`  - ${page.title}`);
      });
    }
    
  } catch (error) {
    console.error('分析エラー:', error);
  }
}

analyzeSearchResults().catch(console.error);
