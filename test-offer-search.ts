// オファー関連ページの検索テスト
import { searchLanceDB } from './src/lib/lancedb-search-client';

async function testOfferSearch() {
  try {
    console.log('=== オファー関連ページ検索テスト ===');
    
    // 直接searchLanceDBを呼び出し
    const results = await searchLanceDB({
      query: 'オファー',
      topK: 20,
      useLunrIndex: false,
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false
      }
    });
    
    console.log('検索結果数:', results.length);
    console.log('\nオファー関連のページ:');
    
    const offerPages = results.filter(result => 
      result.title.toLowerCase().includes('オファー') ||
      result.title.includes('■オファー') ||
      result.title.includes('offer')
    );
    
    console.log('オファー関連ページ数:', offerPages.length);
    offerPages.forEach((page, index) => {
      console.log(`${index + 1}. ${page.title}`);
      console.log(`   ラベル: ${JSON.stringify(page.labels)}`);
      console.log(`   スコア: ${page.scoreText}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testOfferSearch();
