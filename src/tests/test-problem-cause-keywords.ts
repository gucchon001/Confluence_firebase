/*
 * 問題原因特化型キーワード抽出のテスト
 */

import { KeywordListsLoader } from '../lib/keyword-lists-loader';

async function testProblemCauseKeywords() {
  console.log('=== 問題原因特化型キーワード抽出テスト ===');
  
  const keywordListsLoader = KeywordListsLoader.getInstance();
  await keywordListsLoader.loadKeywordLists();
  
  const testQuery = '教室削除ができないのは何が原因ですか';
  
  console.log(`\n--- クエリ: "${testQuery}" ---`);
  
  // キーワード抽出
  const extractedKeywords = keywordListsLoader.extractKeywords(testQuery);
  
  console.log('\n=== 抽出されたキーワード ===');
  console.log(`ドメイン名: [${extractedKeywords.domainNames.join(', ')}]`);
  console.log(`機能名: [${extractedKeywords.functionNames.join(', ')}]`);
  console.log(`操作名: [${extractedKeywords.operationNames.join(', ')}]`);
  console.log(`システム項目: [${extractedKeywords.systemFields.join(', ')}]`);
  console.log(`システム用語: [${extractedKeywords.systemTerms.join(', ')}]`);
  console.log(`関連キーワード: [${extractedKeywords.relatedKeywords.join(', ')}]`);
  console.log(`全キーワード: [${extractedKeywords.allKeywords.join(', ')}]`);
  
  // 問題原因特化型キーワードの確認
  const expectedCauseKeywords = [
    '求人掲載', '求人掲載状態', '求人掲載状態管理', '求人非掲載', '求人非掲載機能',
    '応募情報', '応募履歴', '応募履歴管理', '採用ステータス', '採用ステータス管理', '採用決定日', '採用決定日管理',
    '教室と求人の紐づけ', '教室と求人の紐づけ管理', '削除制限', '削除制限条件', '削除前チェック', '削除前チェック機能',
    '論理削除', '論理削除機能', '削除権限', '削除権限管理', '削除エラー', '削除エラーメッセージ',
    '削除制限通知', '削除制限通知機能', '削除可能性チェック', '削除可能性チェック機能'
  ];
  
  console.log('\n=== 問題原因特化型キーワードの確認 ===');
  const foundCauseKeywords = expectedCauseKeywords.filter(keyword => 
    extractedKeywords.allKeywords.includes(keyword)
  );
  
  console.log(`期待される問題原因キーワード: ${expectedCauseKeywords.length}個`);
  console.log(`実際に抽出された問題原因キーワード: ${foundCauseKeywords.length}個`);
  console.log(`抽出された問題原因キーワード: [${foundCauseKeywords.join(', ')}]`);
  
  const missingCauseKeywords = expectedCauseKeywords.filter(keyword => 
    !extractedKeywords.allKeywords.includes(keyword)
  );
  
  if (missingCauseKeywords.length > 0) {
    console.log(`\n❌ 抽出されなかった問題原因キーワード: [${missingCauseKeywords.join(', ')}]`);
  } else {
    console.log('\n✅ すべての問題原因キーワードが抽出されました！');
  }
  
  // キーワードの優先度確認
  console.log('\n=== 問題原因キーワードの優先度 ===');
  for (const keyword of foundCauseKeywords.slice(0, 10)) {
    const priority = keywordListsLoader.getKeywordPriority(keyword, testQuery);
    console.log(`  ${keyword}: ${priority}`);
  }
}

// テスト実行
testProblemCauseKeywords().catch(console.error);
