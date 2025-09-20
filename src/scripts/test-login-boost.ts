import 'dotenv/config';
import { retrieveRelevantDocs } from '../ai/flows/retrieve-relevant-docs-lancedb';

async function testLoginBoost() {
  console.log('=== ログイン機能のタイトルマッチングブーストテスト ===');
  
  const testQueries = [
    'ログイン機能',
    'ログイン',
    '会員ログイン',
    'ログイン機能の詳細は',
    'authentication',
    'login'
  ];
  
  for (const query of testQueries) {
    console.log(`\n--- クエリ: "${query}" ---`);
    
    try {
      const results = await retrieveRelevantDocs({
        question: query,
        labelFilters: { includeMeetingNotes: false, includeArchived: false }
      });
      
      console.log(`結果数: ${results.length}`);
      
      // ターゲットページ（pageId=703889475）を探す
      const targetPage = results.find(r => r.pageId === 703889475);
      if (targetPage) {
        const rank = results.indexOf(targetPage) + 1;
        console.log(`🎯 ターゲットページ発見: ランク ${rank}位`);
        console.log(`   タイトル: ${targetPage.title}`);
        console.log(`   距離: ${targetPage.distance}`);
        console.log(`   ソース: ${targetPage.source}`);
      } else {
        console.log('❌ ターゲットページが見つかりませんでした');
      }
      
      // 上位5件を表示
      console.log('上位5件:');
      results.slice(0, 5).forEach((r, i) => {
        const isTarget = r.pageId === 703889475;
        console.log(`  ${i+1}. ${isTarget ? '🎯' : '  '} ${r.title} (pageId: ${r.pageId}, distance: ${r.distance?.toFixed(3)})`);
      });
      
    } catch (error: any) {
      console.error(`エラー: ${error.message}`);
    }
  }
}

testLoginBoost().catch(console.error);
