/*
 * キーワード存在確認テスト
 */

import { KeywordListsLoader } from '../lib/keyword-lists-loader';

async function checkKeywordExistence() {
  const loader = KeywordListsLoader.getInstance();
  await loader.loadKeywordLists();
  
  const testKeywords = [
    '求人掲載', '求人掲載状態', '求人掲載状態管理',
    '応募情報', '応募履歴', '応募履歴管理',
    '採用ステータス', '採用ステータス管理',
    '削除制限', '削除制限条件', '削除前チェック'
  ];
  
  console.log('=== キーワード存在確認 ===');
  for (const keyword of testKeywords) {
    const info = loader.getKeywordInfo(keyword);
    console.log(`${keyword}: ${info.exists ? '存在' : '不存在'} (${info.category})`);
  }
  
  // 関連キーワードリストから実際に存在するキーワードを検索
  console.log('\n=== 関連キーワードリストから検索 ===');
  const relatedKeywords = loader.getKeywordCategories()?.relatedKeywords || [];
  
  const foundKeywords = testKeywords.filter(keyword => 
    relatedKeywords.includes(keyword)
  );
  
  console.log(`見つかったキーワード: [${foundKeywords.join(', ')}]`);
  console.log(`見つからなかったキーワード: [${testKeywords.filter(k => !foundKeywords.includes(k)).join(', ')}]`);
  
  // 部分一致で検索
  console.log('\n=== 部分一致で検索 ===');
  for (const keyword of testKeywords) {
    const partialMatches = relatedKeywords.filter(related => 
      related.includes(keyword) || keyword.includes(related)
    );
    if (partialMatches.length > 0) {
      console.log(`${keyword}: [${partialMatches.join(', ')}]`);
    }
  }
}

checkKeywordExistence().catch(console.error);
