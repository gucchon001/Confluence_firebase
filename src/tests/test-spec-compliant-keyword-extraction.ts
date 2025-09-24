/**
 * 仕様準拠キーワード抽出のテスト
 */

import { KeywordExtractor } from '../lib/keyword-extractor-spec-compliant';
import { extractKeywordsConfigured } from '../lib/keyword-extractor-wrapper';

async function testSpecCompliantKeywordExtraction() {
  console.log('🔧 仕様準拠キーワード抽出テスト開始');
  console.log('=' .repeat(60));
  
  const testQueries = [
    '教室管理の詳細は',
    '教室一覧閲覧機能',
    'ログイン機能について',
    '求人管理の仕様'
  ];
  
  for (const query of testQueries) {
    console.log(`\n📝 テストクエリ: "${query}"`);
    console.log('-'.repeat(40));
    
    try {
      // クラスベースの抽出をテスト
      console.log('🔧 クラスベース抽出:');
      const extractor = new KeywordExtractor();
      const classResult = await extractor.extract(query);
      
      console.log('📋 抽出結果:');
      console.log(`- 総キーワード数: ${classResult.keywords.length}`);
      console.log(`- キーワードソース: ${classResult.metadata.keywordSource}`);
      console.log(`- 処理時間: ${classResult.metadata.processingTime}ms`);
      console.log(`- 品質スコア: ${classResult.quality.score} (${classResult.quality.isValid ? '合格' : '不合格'})`);
      console.log('');
      
      console.log('🔑 抽出されたキーワード:');
      classResult.keywords.forEach((keyword, index) => {
        console.log(`  ${index + 1}. "${keyword}"`);
      });
      console.log('');
      
      console.log('⭐ Critical Priority:');
      Array.from(classResult.criticalPriority).forEach(keyword => {
        console.log(`  - "${keyword}"`);
      });
      
      console.log('⭐ High Priority:');
      Array.from(classResult.highPriority).forEach(keyword => {
        console.log(`  - "${keyword}"`);
      });
      
      console.log('📄 Medium Priority:');
      Array.from(classResult.mediumPriority).forEach(keyword => {
        console.log(`  - "${keyword}"`);
      });
      
      console.log('📝 Low Priority:');
      Array.from(classResult.lowPriority).forEach(keyword => {
        console.log(`  - "${keyword}"`);
      });
      
      console.log('\n📊 統計情報:');
      const stats = classResult.metadata.statistics.byCategory;
      console.log(`  - ドメイン名: ${stats.domainNames}個`);
      console.log(`  - 機能名: ${stats.functionNames}個`);
      console.log(`  - 操作名: ${stats.operationNames}個`);
      console.log(`  - システム項目: ${stats.systemFields}個`);
      console.log(`  - システム用語: ${stats.systemTerms}個`);
      console.log(`  - 関連キーワード: ${stats.relatedKeywords}個`);
      
      // ラッパー関数のテスト
      console.log('\n🔧 ラッパー関数抽出:');
      const wrapperResult = await extractKeywordsConfigured(query);
      
      console.log('📋 ラッパー結果:');
      console.log(`- 総キーワード数: ${wrapperResult.keywords.length}`);
      console.log(`- キーワードソース: ${wrapperResult.metadata.keywordSource}`);
      console.log(`- 処理時間: ${wrapperResult.metadata.processingTime}ms`);
      
      // 結果の比較
      const isConsistent = classResult.keywords.length === wrapperResult.keywords.length &&
                          classResult.metadata.keywordSource === (wrapperResult.metadata.keywordSource === 'keyword-lists' ? 'domain-knowledge' : 'fallback');
      
      console.log(`\n✅ 一貫性チェック: ${isConsistent ? 'OK' : 'NG'}`);
      
    } catch (error) {
      console.error('❌ エラーが発生しました:', error);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ 仕様準拠キーワード抽出テスト完了');
}

// テスト実行
if (require.main === module) {
  testSpecCompliantKeywordExtraction();
}

export { testSpecCompliantKeywordExtraction };
