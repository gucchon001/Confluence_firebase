const { defaultLanceDBSearchClient } = require('./dist/lib/lancedb-search-client');

async function checkLabels() {
  try {
    console.log('=== ラベル確認テスト ===\n');
    
    // 1. アーカイブラベルが付いているファイルを検索
    console.log('1. アーカイブラベルが付いているファイル:');
    const archiveResults = await defaultLanceDBSearchClient.search({
      query: 'アカウント契約情報',
      topK: 5
    });
    
    archiveResults.forEach((r, i) => {
      console.log(`${i+1}. ${r.title}`);
      console.log(`   Labels: ${JSON.stringify(r.labels)}`);
      console.log(`   URL: ${r.url}`);
      console.log('');
    });
    
    // 2. フォルダラベルが付いているファイルを検索
    console.log('2. フォルダラベルが付いているファイル:');
    const folderResults = await defaultLanceDBSearchClient.search({
      query: 'クライアント企業向け管理画面',
      topK: 5
    });
    
    folderResults.forEach((r, i) => {
      console.log(`${i+1}. ${r.title}`);
      console.log(`   Labels: ${JSON.stringify(r.labels)}`);
      console.log(`   URL: ${r.url}`);
      console.log('');
    });
    
    // 3. 全ラベルの統計
    console.log('3. 全ラベルの統計:');
    const allResults = await defaultLanceDBSearchClient.search({
      query: 'test',
      topK: 1000
    });
    
    const labelCount = {};
    allResults.forEach(r => {
      if (r.labels && Array.isArray(r.labels)) {
        r.labels.forEach(label => {
          labelCount[label] = (labelCount[label] || 0) + 1;
        });
      }
    });
    
    const sortedLabels = Object.entries(labelCount).sort((a, b) => b[1] - a[1]);
    console.log('ラベル統計:');
    sortedLabels.forEach(([label, count]) => {
      console.log(`  ${label}: ${count}件`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkLabels();
