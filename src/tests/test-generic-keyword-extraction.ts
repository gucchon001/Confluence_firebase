/**
 * 汎用的なキーワード抽出のテストスクリプト（4つのケース対応）
 */

import 'dotenv/config';
import { extractKeywordsHybrid } from '../lib/keyword-extractor';

async function testGenericKeywordExtraction() {
  console.log('=== 汎用的なキーワード抽出テスト（4つのケース対応） ===');
  
  const testCases = [
    {
      name: '教室管理',
      query: '教室管理の詳細は'
    },
    {
      name: '教室削除問題',
      query: '教室削除ができないのは何が原因ですか'
    },
    {
      name: '会員ログイン',
      query: '会員のログイン機能の詳細を教えて'
    },
    {
      name: 'オファー機能',
      query: 'オファー機能の種類は？'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- テストケース: ${testCase.name} ---`);
    console.log(`クエリ: "${testCase.query}"`);
    
    try {
      const result = await extractKeywordsHybrid(testCase.query);
      
      console.log('抽出されたキーワード:', result.keywords);
      console.log('高優先度キーワード:', Array.from(result.highPriority));
      console.log('低優先度キーワード:', Array.from(result.lowPriority));
      
      // 品質評価
      const qualityScore = evaluateGenericQuality(result.keywords);
      console.log(`品質スコア: ${qualityScore.score}%`);
      console.log(`評価: ${qualityScore.score >= 70 ? '✅ 良好' : qualityScore.score >= 50 ? '⚠️ 改善必要' : '❌ 大幅改善必要'}`);
      
      if (qualityScore.issues.length > 0) {
        console.log('問題点:', qualityScore.issues);
      }
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

/**
 * 汎用的な品質評価
 */
function evaluateGenericQuality(keywords: string[]): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // キーワード数のチェック
  if (keywords.length >= 3) score += 25;
  else issues.push('キーワード数が不足');
  
  // エンティティキーワードのチェック
  const hasEntityKeywords = keywords.some(kw => 
    kw.length >= 2 && kw.length <= 4 && /[\p{Script=Han}]{2,4}/u.test(kw)
  );
  
  if (hasEntityKeywords) score += 25;
  else issues.push('エンティティキーワードが不足');
  
  // 機能キーワードのチェック（汎用的なパターン）
  const hasFunctionKeywords = keywords.some(kw => 
    kw.length >= 2 && kw.length <= 6 && 
    (/[一覧閲覧登録編集削除コピー機能管理詳細仕様情報データ制限条件方法手順問題原因エラー]/u.test(kw))
  );
  
  if (hasFunctionKeywords) score += 25;
  else issues.push('機能キーワードが不足');
  
  // キーワードの多様性チェック
  const uniqueKeywords = [...new Set(keywords)];
  const diversityScore = (uniqueKeywords.length / keywords.length) * 25;
  score += diversityScore;
  
  return { score, issues };
}

// テスト実行
testGenericKeywordExtraction().catch(console.error);
