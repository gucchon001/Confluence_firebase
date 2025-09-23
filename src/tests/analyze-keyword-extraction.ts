/**
 * キーワード抽出の詳細分析スクリプト
 */

import 'dotenv/config';
import { extractKeywordsHybrid } from '../lib/keyword-extractor';

async function analyzeKeywordExtraction() {
  console.log('=== キーワード抽出の詳細分析 ===');
  
  const query = '教室削除ができないのは何が原因ですか';
  console.log(`クエリ: "${query}"`);
  
  try {
    // キーワード抽出の実行
    const result = await extractKeywordsHybrid(query);
    const keywords = result.keywords;
    
    console.log('\n=== 抽出されたキーワード ===');
    console.log(`キーワード数: ${keywords.length}件`);
    keywords.forEach((keyword, index) => {
      console.log(`${index + 1}. "${keyword}"`);
    });
    
    // キーワードの分類分析
    console.log('\n=== キーワード分類分析 ===');
    
    // 基本キーワード
    const basicKeywords = keywords.filter(k => 
      ['教室', '削除', 'でき', 'ない', '原因'].includes(k)
    );
    console.log(`基本キーワード: ${basicKeywords.length}件`);
    basicKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // 機能キーワード
    const functionKeywords = keywords.filter(k => 
      k.includes('削除') || k.includes('機能') || k.includes('エラー')
    );
    console.log(`\n機能キーワード: ${functionKeywords.length}件`);
    functionKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // 問題関連キーワード
    const problemKeywords = keywords.filter(k => 
      k.includes('できない') || k.includes('エラー') || k.includes('失敗')
    );
    console.log(`\n問題関連キーワード: ${problemKeywords.length}件`);
    problemKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // 期待されるキーワードとの比較
    console.log('\n=== 期待されるキーワードとの比較 ===');
    const expectedKeywords = [
      '教室削除', '削除できない', '削除問題', '削除制限',
      '教室', '削除', '求人掲載', '応募情報', '採用ステータス',
      '削除条件', '削除エラー', '削除制限条件'
    ];
    
    const foundExpectedKeywords = keywords.filter(k => 
      expectedKeywords.some(expected => k.includes(expected))
    );
    
    console.log(`期待されるキーワード数: ${expectedKeywords.length}件`);
    console.log(`見つかった期待キーワード数: ${foundExpectedKeywords.length}件`);
    console.log(`見つかった期待キーワード:`);
    foundExpectedKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // 不足しているキーワード
    const missingKeywords = expectedKeywords.filter(expected => 
      !keywords.some(k => k.includes(expected))
    );
    console.log(`\n不足しているキーワード: ${missingKeywords.length}件`);
    missingKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // キーワードの長さ分析
    console.log('\n=== キーワード長さ分析 ===');
    const shortKeywords = keywords.filter(k => k.length <= 2);
    const mediumKeywords = keywords.filter(k => k.length >= 3 && k.length <= 6);
    const longKeywords = keywords.filter(k => k.length > 6);
    
    console.log(`短いキーワード (≤2文字): ${shortKeywords.length}件`);
    shortKeywords.forEach(k => console.log(`  - "${k}"`));
    
    console.log(`\n中程度のキーワード (3-6文字): ${mediumKeywords.length}件`);
    mediumKeywords.forEach(k => console.log(`  - "${k}"`));
    
    console.log(`\n長いキーワード (>6文字): ${longKeywords.length}件`);
    longKeywords.forEach(k => console.log(`  - "${k}"`));
    
  } catch (error) {
    console.error('キーワード抽出分析エラー:', error);
  }
}

analyzeKeywordExtraction().catch(console.error);
