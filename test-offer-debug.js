// オファー機能検索のデバッグ
const fs = require('fs');

async function testOfferSearch() {
  try {
    console.log('=== オファー機能検索デバッグ開始 ===');
    
    // 直接LanceDBに接続してテスト
    const { connect } = require('vectordb');
    const db = await connect('./.lancedb');
    const tbl = await db.openTable('confluence');
    
    console.log('LanceDBに接続成功');
    
    // オファー関連のページを検索
    const results = await tbl.search([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
      .limit(50)
      .toArray();
    
    console.log(`取得した結果数: ${results.length}`);
    
    // オファー関連のページをフィルタ
    const offerPages = results.filter(result => 
      result.title && (
        result.title.includes('オファー') || 
        result.title.includes('offer') ||
        (result.labels && Array.isArray(result.labels) && result.labels.some(label => 
          label.includes('オファー') || label.includes('offer')
        ))
      )
    );
    
    console.log(`オファー関連ページ数: ${offerPages.length}`);
    
    offerPages.forEach((page, index) => {
      console.log(`\n--- オファーページ ${index + 1} ---`);
      console.log(`タイトル: ${page.title}`);
      console.log(`ラベル: ${JSON.stringify(page.labels)}`);
    });
    
    // 結果をファイルに保存
    const debugInfo = {
      totalResults: results.length,
      offerPages: offerPages.length,
      offerPageDetails: offerPages.map(page => ({
        title: page.title,
        labels: page.labels
      }))
    };
    
    fs.writeFileSync('offer-debug-results.json', JSON.stringify(debugInfo, null, 2));
    console.log('\nデバッグ結果を offer-debug-results.json に保存しました');
    
  } catch (error) {
    console.error('エラー:', error);
    fs.writeFileSync('offer-debug-error.txt', error.message + '\n' + error.stack);
  }
}

testOfferSearch();
