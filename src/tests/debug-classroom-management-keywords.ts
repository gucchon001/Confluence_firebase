/**
 * 教室管理クエリのキーワード抽出デバッグスクリプト
 */

import 'dotenv/config';
import { extractKeywordsHybrid } from '../lib/keyword-extractor';

async function debugClassroomManagementKeywords() {
  console.log('=== 教室管理クエリのキーワード抽出デバッグ ===');
  
  const query = '教室管理の詳細は';
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
    
    // 理想のキーワードとの比較
    console.log('\n=== 理想のキーワードとの比較 ===');
    const idealKeywords = [
      // 基本キーワード
      '教室', '管理', '詳細',
      
      // 機能関連キーワード
      '教室管理', '教室一覧', '教室登録', '教室編集', '教室削除', '教室コピー',
      
      // 管理関連キーワード
      '管理機能', '管理詳細', '管理仕様', '管理情報',
      
      // 詳細関連キーワード
      '詳細仕様', '詳細情報', '詳細機能', '詳細管理'
    ];
    
    const foundIdealKeywords = keywords.filter(k => 
      idealKeywords.some(ideal => k.includes(ideal) || ideal.includes(k))
    );
    
    console.log(`理想のキーワード数: ${idealKeywords.length}件`);
    console.log(`見つかった理想キーワード数: ${foundIdealKeywords.length}件`);
    console.log(`見つかった理想キーワード:`);
    foundIdealKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // 不足しているキーワード
    const missingKeywords = idealKeywords.filter(ideal => 
      !keywords.some(k => k.includes(ideal) || ideal.includes(k))
    );
    console.log(`\n不足しているキーワード: ${missingKeywords.length}件`);
    missingKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // キーワードの分類分析
    console.log('\n=== キーワード分類分析 ===');
    
    // 基本キーワード
    const basicKeywords = keywords.filter(k => 
      ['教室', '管理', '詳細'].includes(k)
    );
    console.log(`基本キーワード: ${basicKeywords.length}件`);
    basicKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // 機能キーワード
    const functionKeywords = keywords.filter(k => 
      k.includes('教室') || k.includes('管理') || k.includes('機能')
    );
    console.log(`\n機能キーワード: ${functionKeywords.length}件`);
    functionKeywords.forEach(k => console.log(`  - "${k}"`));
    
    // 詳細関連キーワード
    const detailKeywords = keywords.filter(k => 
      k.includes('詳細') || k.includes('仕様') || k.includes('情報')
    );
    console.log(`\n詳細関連キーワード: ${detailKeywords.length}件`);
    detailKeywords.forEach(k => console.log(`  - "${k}"`));
    
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
    
    // キーワード抽出の品質評価
    console.log('\n=== キーワード抽出品質評価 ===');
    const qualityScore = (foundIdealKeywords.length / idealKeywords.length) * 100;
    console.log(`品質スコア: ${qualityScore.toFixed(1)}%`);
    console.log(`評価: ${qualityScore >= 80 ? '✅ 良好' : qualityScore >= 60 ? '⚠️ 改善必要' : '❌ 大幅改善必要'}`);
    
    // 改善提案
    console.log('\n=== 改善提案 ===');
    if (basicKeywords.length < 3) {
      console.log('❌ 基本キーワードの不足: 教室、管理、詳細が適切に抽出されていない');
    }
    if (functionKeywords.length < 3) {
      console.log('❌ 機能キーワードの不足: 教室管理に関連する機能名が不足');
    }
    if (detailKeywords.length < 2) {
      console.log('❌ 詳細関連キーワードの不足: 詳細仕様に関連するキーワードが不足');
    }
    if (qualityScore < 60) {
      console.log('❌ 全体的な品質の不足: キーワード抽出アルゴリズムの根本的な改善が必要');
    }
    
  } catch (error) {
    console.error('キーワード抽出デバッグエラー:', error);
  }
}

debugClassroomManagementKeywords().catch(console.error);
