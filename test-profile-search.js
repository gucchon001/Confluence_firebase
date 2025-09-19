const { defaultLanceDBSearchClient } = require('./dist/lib/lancedb-search-client');

async function testProfileSearch() {
  try {
    console.log('Searching for "プロフィール情報"...');
    const results = await defaultLanceDBSearchClient.search({
      query: 'プロフィール情報',
      topK: 10
    });
    
    console.log(`Found ${results.length} results:`);
    results.forEach((r, i) => {
      console.log(`${i+1}. ${r.title}`);
      console.log(`   Labels: ${JSON.stringify(r.labels)}`);
      console.log(`   URL: ${r.url}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testProfileSearch();
