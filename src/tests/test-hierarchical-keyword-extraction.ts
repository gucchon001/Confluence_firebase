/**
 * 階層的キーワード抽出のテストスクリプト
 */

import 'dotenv/config';
import { extractKeywordsHybrid } from '../lib/keyword-extractor';

async function testHierarchicalKeywordExtraction() {
  console.log('=== 階層的キーワード抽出テスト ===');
  
  const testQueries = [
    '教室管理の詳細は',
    '教室一覧の機能は',
    '教室登録の方法は',
    '教室編集の仕様は',
    '教室削除の制限は',
    '教室コピー機能は'
  ];
  
  for (const query of testQueries) {
    console.log(`\n--- テストクエリ: "${query}" ---`);
    
    try {
      const result = await extractKeywordsHybrid(query);
      
      console.log('抽出されたキーワード:', result.keywords);
      console.log('高優先度キーワード:', Array.from(result.highPriority));
      console.log('低優先度キーワード:', Array.from(result.lowPriority));
      
      // 品質評価
      const qualityScore = evaluateKeywordQuality(query, result.keywords);
      console.log('品質スコア:', qualityScore.score + '%');
      console.log('評価:', qualityScore.score >= 80 ? '✅ 良好' : qualityScore.score >= 60 ? '⚠️ 改善必要' : '❌ 大幅改善必要');
      
      if (qualityScore.issues.length > 0) {
        console.log('問題点:', qualityScore.issues);
      }
      
    } catch (error) {
      console.error('エラー:', error);
    }
  }
}

/**
 * キーワード品質評価
 */
function evaluateKeywordQuality(query: string, keywords: string[]): {
  score: number;
  issues: string[];
} {
  const issues: string[] = [];
  let score = 0;
  
  // 基本キーワードチェック
  const hasClassroom = keywords.some(kw => kw.includes('教室'));
  const hasManagement = keywords.some(kw => kw.includes('管理'));
  const hasDetail = keywords.some(kw => kw.includes('詳細'));
  
  if (hasClassroom) score += 25;
  else issues.push('教室キーワードが不足');
  
  if (hasManagement) score += 25;
  else issues.push('管理キーワードが不足');
  
  if (hasDetail) score += 25;
  else issues.push('詳細キーワードが不足');
  
  // 機能キーワードチェック
  const functionKeywords = ['教室一覧', '教室登録', '教室編集', '教室削除', '教室コピー'];
  const foundFunctions = functionKeywords.filter(fk => 
    keywords.some(kw => kw.includes(fk))
  );
  
  score += (foundFunctions.length / functionKeywords.length) * 25;
  
  if (foundFunctions.length < 3) {
    issues.push('機能キーワードが不足');
  }
  
  return { score, issues };
}

// テスト実行
testHierarchicalKeywordExtraction().catch(console.error);
