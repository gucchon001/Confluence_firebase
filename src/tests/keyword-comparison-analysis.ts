/**
 * キーワード抽出の比較分析スクリプト
 * 理想の抽出キーワードと現在の抽出キーワードを詳細比較
 */

import 'dotenv/config';
import { extractKeywordsHybrid } from '../lib/keyword-extractor';

async function analyzeKeywordComparison() {
  console.log('=== キーワード抽出の比較分析 ===');
  
  const query = '教室削除ができないのは何が原因ですか';
  console.log(`クエリ: "${query}"`);
  
  try {
    // 現在のキーワード抽出
    const result = await extractKeywordsHybrid(query);
    const currentKeywords = result.keywords;
    
    console.log('\n=== 現在の抽出キーワード ===');
    console.log(`キーワード数: ${currentKeywords.length}件`);
    currentKeywords.forEach((keyword, index) => {
      console.log(`${index + 1}. "${keyword}"`);
    });
    
    // 理想の抽出キーワード（教室削除問題の検索品質テストから）
    const idealKeywords = [
      // 基本キーワード
      '教室', '削除', 'でき', 'ない', '原因',
      
      // 機能関連キーワード
      '教室削除', '削除機能', '削除処理', '削除できない', '削除問題',
      
      // 制限・条件関連キーワード
      '削除制限', '削除条件', '削除制限条件', '削除前チェック',
      
      // 問題原因関連キーワード
      '求人掲載', '求人掲載状態', '応募情報', '採用ステータス', '採用決定日',
      
      // エラー・問題関連キーワード
      '削除エラー', '削除失敗', 'エラーメッセージ', 'エラー処理',
      
      // データ関連キーワード
      '教室データ', '求人データ', '応募データ', 'データ削除'
    ];
    
    console.log('\n=== 理想の抽出キーワード ===');
    console.log(`理想キーワード数: ${idealKeywords.length}件`);
    idealKeywords.forEach((keyword, index) => {
      console.log(`${index + 1}. "${keyword}"`);
    });
    
    // 比較分析
    console.log('\n=== 比較分析 ===');
    
    // 1. 一致するキーワード
    const matchingKeywords = currentKeywords.filter(current => 
      idealKeywords.some(ideal => ideal === current || ideal.includes(current) || current.includes(ideal))
    );
    
    console.log(`\n1. 一致するキーワード: ${matchingKeywords.length}件`);
    matchingKeywords.forEach(keyword => {
      const idealMatch = idealKeywords.find(ideal => 
        ideal === keyword || ideal.includes(keyword) || keyword.includes(ideal)
      );
      console.log(`   - "${keyword}" (理想: "${idealMatch}")`);
    });
    
    // 2. 不足しているキーワード
    const missingKeywords = idealKeywords.filter(ideal => 
      !currentKeywords.some(current => 
        ideal === current || ideal.includes(current) || current.includes(ideal)
      )
    );
    
    console.log(`\n2. 不足しているキーワード: ${missingKeywords.length}件`);
    missingKeywords.forEach(keyword => {
      console.log(`   - "${keyword}"`);
    });
    
    // 3. 余分なキーワード
    const extraKeywords = currentKeywords.filter(current => 
      !idealKeywords.some(ideal => 
        ideal === current || ideal.includes(current) || current.includes(ideal)
      )
    );
    
    console.log(`\n3. 余分なキーワード: ${extraKeywords.length}件`);
    extraKeywords.forEach(keyword => {
      console.log(`   - "${keyword}"`);
    });
    
    // 4. カテゴリ別分析
    console.log('\n=== カテゴリ別分析 ===');
    
    const categories = {
      '基本キーワード': ['教室', '削除', 'でき', 'ない', '原因'],
      '機能関連': ['教室削除', '削除機能', '削除処理', '削除できない', '削除問題'],
      '制限・条件': ['削除制限', '削除条件', '削除制限条件', '削除前チェック'],
      '問題原因': ['求人掲載', '求人掲載状態', '応募情報', '採用ステータス', '採用決定日'],
      'エラー・問題': ['削除エラー', '削除失敗', 'エラーメッセージ', 'エラー処理'],
      'データ関連': ['教室データ', '求人データ', '応募データ', 'データ削除']
    };
    
    Object.entries(categories).forEach(([category, keywords]) => {
      const foundInCurrent = keywords.filter(ideal => 
        currentKeywords.some(current => 
          ideal === current || ideal.includes(current) || current.includes(ideal)
        )
      );
      
      const foundInIdeal = keywords.filter(ideal => 
        idealKeywords.includes(ideal)
      );
      
      console.log(`\n${category}:`);
      console.log(`  理想: ${foundInIdeal.length}/${keywords.length}件`);
      console.log(`  現在: ${foundInCurrent.length}/${keywords.length}件`);
      console.log(`  見つかった: ${foundInCurrent.map(k => `"${k}"`).join(', ')}`);
      
      const missing = keywords.filter(ideal => 
        !currentKeywords.some(current => 
          ideal === current || ideal.includes(current) || current.includes(ideal)
        )
      );
      if (missing.length > 0) {
        console.log(`  不足: ${missing.map(k => `"${k}"`).join(', ')}`);
      }
    });
    
    // 5. 改善提案
    console.log('\n=== 改善提案 ===');
    
    const improvementSuggestions = [];
    
    // 基本キーワードの不足
    const missingBasic = ['教室', '削除', 'でき', 'ない', '原因'].filter(basic => 
      !currentKeywords.includes(basic)
    );
    if (missingBasic.length > 0) {
      improvementSuggestions.push({
        issue: '基本キーワードの不足',
        keywords: missingBasic,
        suggestion: '基本キーワード抽出ロジックの改善が必要'
      });
    }
    
    // 問題原因関連キーワードの不足
    const missingProblemCause = ['求人掲載', '応募情報', '採用ステータス'].filter(keyword => 
      !currentKeywords.some(current => current.includes(keyword))
    );
    if (missingProblemCause.length > 0) {
      improvementSuggestions.push({
        issue: '問題原因関連キーワードの不足',
        keywords: missingProblemCause,
        suggestion: 'LLM拡張で問題原因を特定するキーワードを追加'
      });
    }
    
    // 制限条件関連キーワードの不足
    const missingRestriction = ['削除制限', '削除条件', '削除前チェック'].filter(keyword => 
      !currentKeywords.some(current => current.includes(keyword))
    );
    if (missingRestriction.length > 0) {
      improvementSuggestions.push({
        issue: '制限条件関連キーワードの不足',
        keywords: missingRestriction,
        suggestion: '制限条件を表すキーワードの抽出を強化'
      });
    }
    
    improvementSuggestions.forEach((suggestion, index) => {
      console.log(`\n${index + 1}. ${suggestion.issue}`);
      console.log(`   不足キーワード: ${suggestion.keywords.map(k => `"${k}"`).join(', ')}`);
      console.log(`   改善提案: ${suggestion.suggestion}`);
    });
    
    // 6. キーワード抽出の品質スコア
    const totalIdealKeywords = idealKeywords.length;
    const foundKeywords = idealKeywords.filter(ideal => 
      currentKeywords.some(current => 
        ideal === current || ideal.includes(current) || current.includes(ideal)
      )
    ).length;
    
    const qualityScore = (foundKeywords / totalIdealKeywords) * 100;
    
    console.log('\n=== キーワード抽出品質スコア ===');
    console.log(`理想キーワード数: ${totalIdealKeywords}件`);
    console.log(`見つかったキーワード数: ${foundKeywords}件`);
    console.log(`品質スコア: ${qualityScore.toFixed(1)}%`);
    console.log(`評価: ${qualityScore >= 80 ? '✅ 良好' : qualityScore >= 60 ? '⚠️ 改善必要' : '❌ 大幅改善必要'}`);
    
  } catch (error) {
    console.error('キーワード比較分析エラー:', error);
  }
}

analyzeKeywordComparison().catch(console.error);
