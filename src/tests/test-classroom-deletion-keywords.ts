/*
 * 教室削除機能キーワードのテスト
 */

import { KeywordListsLoader } from '../lib/keyword-lists-loader';

async function testClassroomDeletionKeywords() {
  const loader = KeywordListsLoader.getInstance();
  await loader.loadKeywordLists();
  
  const query = '教室削除ができないのは何が原因ですか';
  console.log('=== 教室削除機能キーワードテスト ===');
  console.log('クエリ:', query);
  console.log('');
  
  // 各カテゴリから教室削除関連キーワードを検索
  const domainNames = loader.searchByCategory('domainNames', query);
  const functionNames = loader.searchByCategory('functionNames', query);
  const operationNames = loader.searchByCategory('operationNames', query);
  const systemFields = loader.searchByCategory('systemFields', query);
  const systemTerms = loader.searchByCategory('systemTerms', query);
  const relatedKeywords = loader.searchByCategory('relatedKeywords', query);
  
  console.log('ドメイン名:', domainNames);
  console.log('機能名:', functionNames);
  console.log('操作名:', operationNames);
  console.log('システム項目:', systemFields);
  console.log('システム用語:', systemTerms);
  console.log('関連キーワード:', relatedKeywords);
  console.log('');
  
  // 教室削除機能の詳細情報
  const classroomDeletionInfo = loader.getKeywordInfo('教室削除機能');
  console.log('教室削除機能の詳細:', classroomDeletionInfo);
  
  // 全キーワード抽出
  const allExtracted = loader.extractKeywords(query);
  console.log('');
  console.log('=== 全キーワード抽出結果 ===');
  console.log('全キーワード:', allExtracted.allKeywords);
  console.log('機能名キーワード:', allExtracted.functionNames);
  
  // 教室削除関連キーワードの詳細分析
  console.log('');
  console.log('=== 教室削除関連キーワード分析 ===');
  const classroomDeletionKeywords = allExtracted.allKeywords.filter(kw => 
    kw.includes('教室') && kw.includes('削除')
  );
  console.log('教室削除関連キーワード:', classroomDeletionKeywords);
  
  // マッチングロジックのテスト
  console.log('');
  console.log('=== マッチングロジックテスト ===');
  console.log('クエリに"教室削除"が含まれているか:', query.includes('教室削除'));
  console.log('クエリに"削除"が含まれているか:', query.includes('削除'));
  console.log('クエリに"教室"が含まれているか:', query.includes('教室'));
}

// テスト実行
testClassroomDeletionKeywords().catch(console.error);
