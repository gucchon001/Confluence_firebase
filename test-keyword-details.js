const { extractKeywordsHybrid } = require('./src/lib/keyword-extractor');

async function testKeywordDetails() {
  try {
    console.log('=== キーワード抽出詳細 ===');
    const result = await extractKeywordsHybrid('教室管理の詳細は');
    
    console.log('入力クエリ: 教室管理の詳細は');
    console.log('');
    console.log('抽出キーワード:', result.keywords);
    console.log('キーワード数:', result.keywords.length);
    console.log('');
    console.log('highPriority:', Array.from(result.highPriority));
    console.log('lowPriority:', Array.from(result.lowPriority));
    console.log('');
    console.log('=== キーワード分析 ===');
    result.keywords.forEach((kw, i) => {
      console.log(`${i+1}. "${kw}" (長さ: ${kw.length})`);
    });
    
    console.log('');
    console.log('=== 重要キーワードの確認 ===');
    const importantKeywords = ['教室', '管理', '詳細', '仕様', '機能'];
    importantKeywords.forEach(kw => {
      const found = result.keywords.some(extracted => extracted.includes(kw));
      console.log(`${kw}: ${found ? '✓ 見つかった' : '✗ 見つからない'}`);
    });
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testKeywordDetails();
