const { searchLanceDB } = require('./src/lib/lancedb-search-client');

async function testSearchResults() {
  try {
    console.log('=== 改善後の検索結果テスト ===');
    const results = await searchLanceDB({ query: '教室管理の詳細は', topK: 10 });
    
    console.log('検索クエリ: 教室管理の詳細は');
    console.log('結果数:', results.length);
    console.log('上位5件:');
    results.slice(0, 5).forEach((item, i) => {
      console.log(`${i+1}. ${item.title} (スコア: ${item.score.toFixed(2)})`);
    });
    
    console.log('=== 理想のページの確認 ===');
    const idealPages = [
      '160_【FIX】教室管理機能',
      '161_【FIX】教室一覧閲覧機能', 
      '162_【FIX】教室新規登録機能',
      '163_【FIX】教室情報編集機能',
      '168_【FIX】教室コピー機能'
    ];
    
    idealPages.forEach(page => {
      const found = results.find(item => item.title.includes(page));
      console.log(`${page}: ${found ? '見つかった' : '見つからない'} ${found ? `(スコア: ${found.score.toFixed(2)})` : ''}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testSearchResults();
