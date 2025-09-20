import { lunrInitializer, initializeLunrOnStartup } from '../src/lib/lunr-initializer';
import { lunrSearchClient } from '../src/lib/lunr-search-client';
import { tokenizeJapaneseText } from '../src/lib/japanese-tokenizer';

async function debugLunrSearch() {
  console.log('🔍 Lunr検索デバッグ開始...\n');

  // 1. Lunrインデックスを初期化
  console.log('1. Lunrインデックス初期化...');
  await initializeLunrOnStartup();
  
  if (!lunrInitializer.isReady()) {
    console.error('❌ Lunrインデックスが準備できていません');
    return;
  }
  
  console.log('✅ Lunrインデックス初期化完了\n');

  // 2. インデックス内のドキュメントを確認
  console.log('2. インデックス内のドキュメント確認...');
  const docCount = await lunrSearchClient.getDocumentCount();
  const avgTitleLength = await lunrSearchClient.getAverageTitleLength();
  console.log(`📊 ドキュメント数: ${docCount}`);
  console.log(`📊 平均タイトル長: ${avgTitleLength}文字\n`);

  // 3. 日本語キーワードの検索テスト
  const testQueries = [
    '教室管理',
    'ログイン',
    '急募',
    '要件',
    '設定',
    '管理',
    '機能',
    '詳細',
    '仕様'
  ];

  console.log('3. 日本語キーワード検索テスト...');
  for (const query of testQueries) {
    console.log(`\n🔍 検索クエリ: "${query}"`);
    
    // トークン化
    const tokenizedQuery = await tokenizeJapaneseText(query);
    console.log(`   トークン化後: "${tokenizedQuery}"`);
    
    // Lunr検索
    const results = await lunrSearchClient.searchCandidates(tokenizedQuery, 5);
    console.log(`   結果数: ${results.length}`);
    
    if (results.length > 0) {
      console.log('   📋 上位結果:');
      results.slice(0, 3).forEach((result, index) => {
        console.log(`      ${index + 1}. ${result.title} (スコア: ${result.score || 'N/A'})`);
      });
    } else {
      console.log('   ❌ ヒットなし');
    }
  }

  // 4. 英語キーワードの検索テスト
  console.log('\n4. 英語キーワード検索テスト...');
  const englishQueries = [
    'room',
    'management',
    'login',
    'function',
    'setting',
    'requirement'
  ];

  for (const query of englishQueries) {
    console.log(`\n🔍 検索クエリ: "${query}"`);
    
    const results = await lunrSearchClient.searchCandidates(query, 5);
    console.log(`   結果数: ${results.length}`);
    
    if (results.length > 0) {
      console.log('   📋 上位結果:');
      results.slice(0, 3).forEach((result, index) => {
        console.log(`      ${index + 1}. ${result.title} (スコア: ${result.score || 'N/A'})`);
      });
    } else {
      console.log('   ❌ ヒットなし');
    }
  }

  // 5. インデックス内のサンプルドキュメントを確認
  console.log('\n5. インデックス内のサンプルドキュメント確認...');
  const sampleResults = await lunrSearchClient.searchCandidates('', 10);
  console.log(`📋 サンプルドキュメント (${sampleResults.length}件):`);
  sampleResults.slice(0, 5).forEach((doc, index) => {
    console.log(`   ${index + 1}. タイトル: "${doc.title}"`);
    console.log(`      コンテンツ: "${doc.content.substring(0, 100)}..."`);
    console.log(`      ラベル: ${doc.labels.join(', ')}`);
    console.log('');
  });

  console.log('🔍 デバッグ完了');
}

debugLunrSearch().catch(console.error);
