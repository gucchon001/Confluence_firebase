/**
 * 721の検索結果を簡易テスト
 */

import { searchLanceDB } from '../src/lib/lancedb-search-client';
import { config } from 'dotenv';

config();

// キャッシュを無効化
if (globalThis.__searchCache) {
  (globalThis as any).__searchCache = null;
}
if (globalThis.__embeddingCache) {
  (globalThis as any).__embeddingCache = null;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║       721検索テスト（キャッシュなし）                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  const query = '塾講師プロフィールの学年・職業を更新する方法を教えてください';
  const expectedPageTitle = '721_【作成中】学年自動更新バッチ';
  
  console.log(`クエリ: "${query}"`);
  console.log(`期待ページ: ${expectedPageTitle}\n`);

  try {
    const results = await searchLanceDB({
      query,
      topK: 50
    });
    
    console.log(`\n検索結果: ${results.length}件\n`);
    
    // 期待ページを探す
    const expectedIndex = results.findIndex((r: any) => r.title === expectedPageTitle);
    
    if (expectedIndex === -1) {
      console.log(`❌ 期待ページがTop 50に見つかりませんでした\n`);
    } else {
      console.log(`✅ 期待ページが #${expectedIndex + 1} で発見されました\n`);
      
      const expectedPage = results[expectedIndex];
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 期待ページの詳細:\n');
      console.log(`タイトル: ${expectedPage.title}`);
      console.log(`Composite: ${expectedPage._compositeScore?.toFixed(4) || 'undefined'}`);
      if (expectedPage._scoreBreakdown) {
        console.log('Breakdown:');
        console.log(`  V: ${expectedPage._scoreBreakdown.vectorContribution?.toFixed(4) || 'N/A'}`);
        console.log(`  B: ${expectedPage._scoreBreakdown.bm25Contribution?.toFixed(4) || 'N/A'}`);
        console.log(`  T: ${expectedPage._scoreBreakdown.titleContribution?.toFixed(4) || 'N/A'}`);
        console.log(`  L: ${expectedPage._scoreBreakdown.labelContribution?.toFixed(4) || 'N/A'}`);
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Top 5:\n');
    
    results.slice(0, 5).forEach((r: any, i: number) => {
      console.log(`${i + 1}. ${r.title}`);
      console.log(`   Composite: ${r._compositeScore?.toFixed(4) || 'N/A'}`);
    });

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error);
  }
}

main();



