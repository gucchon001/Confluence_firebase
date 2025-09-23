/*
 * 動的優先順位システムのテスト
 */

import { DynamicPriorityManager } from '../lib/dynamic-priority-manager';
import { KeywordListsLoader } from '../lib/keyword-lists-loader';

async function testDynamicPriority() {
  console.log('=== 動的優先順位システムテスト ===');
  
  const dynamicPriorityManager = DynamicPriorityManager.getInstance();
  const keywordListsLoader = KeywordListsLoader.getInstance();
  await keywordListsLoader.loadKeywordLists();
  
  const testQueries = [
    '教室削除ができないのは何が原因ですか',
    '教室管理の詳細は',
    'オファー機能の種類は？',
    '会員ログインができない',
    '一般的な検索クエリ'
  ];
  
  for (const query of testQueries) {
    console.log(`\n--- クエリ: "${query}" ---`);
    
    // 動的優先順位の計算
    const dynamicPriority = dynamicPriorityManager.calculateDynamicPriority(query);
    console.log('動的優先順位:', dynamicPriority);
    
    // キーワードの優先度テスト
    const testKeywords = ['教室グループ', '教室削除機能', '教室管理', '削除', 'オファー機能'];
    
    console.log('キーワード優先度:');
    for (const keyword of testKeywords) {
      const staticPriority = keywordListsLoader.getKeywordPriority(keyword);
      const dynamicPriority_result = keywordListsLoader.getKeywordPriority(keyword, query);
      
      console.log(`  ${keyword}:`);
      console.log(`    静的優先度: ${staticPriority}`);
      console.log(`    動的優先度: ${dynamicPriority_result}`);
      
      if (staticPriority !== dynamicPriority_result) {
        console.log(`    ✅ 優先度が変更されました！`);
      }
    }
  }
  
  // 教室削除問題の詳細テスト
  console.log('\n=== 教室削除問題の詳細テスト ===');
  const classroomDeletionQuery = '教室削除ができないのは何が原因ですか';
  
  const extractedKeywords = keywordListsLoader.extractKeywords(classroomDeletionQuery);
  console.log('抽出されたキーワード:', extractedKeywords.allKeywords.slice(0, 10));
  
  // 上位キーワードの優先度確認
  const topKeywords = extractedKeywords.allKeywords.slice(0, 10);
  console.log('\n上位キーワードの優先度:');
  for (const keyword of topKeywords) {
    const priority = keywordListsLoader.getKeywordPriority(keyword, classroomDeletionQuery);
    console.log(`  ${keyword}: ${priority}`);
  }
}

// テスト実行
testDynamicPriority().catch(console.error);
