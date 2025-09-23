const { extractKeywordsHybrid } = require('./src/lib/keyword-extractor');

async function testKeywordExtraction() {
  try {
    console.log('=== キーワード抽出テスト開始 ===');
    const result = await extractKeywordsHybrid('教室管理の詳細は');
    
    console.log('入力クエリ: 教室管理の詳細は');
    console.log('抽出キーワード:', result.keywords);
    console.log('highPriority:', Array.from(result.highPriority));
    console.log('lowPriority:', Array.from(result.lowPriority));
    
    console.log('=== 品質チェック ===');
    console.log('1. キーワード数:', result.keywords.length);
    console.log('2. 教室が含まれている:', result.keywords.includes('教室'));
    console.log('3. 管理が含まれている:', result.keywords.includes('管理'));
    console.log('4. 詳細が含まれている:', result.keywords.includes('詳細'));
    console.log('5. 仕様が含まれている:', result.keywords.includes('仕様'));
    console.log('6. 機能が含まれている:', result.keywords.includes('機能'));
    
  } catch (error) {
    console.error('エラー:', error);
  }
}

testKeywordExtraction();
