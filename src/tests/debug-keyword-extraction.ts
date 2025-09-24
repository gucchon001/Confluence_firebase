/**
 * キーワード抽出のデバッグテスト
 * 「教室管理の詳細は」クエリでのキーワード抽出を詳細に調査
 */

import { extractKeywordsConfigured } from '../lib/keyword-extractor-configured';
import { KeywordListsLoader } from '../lib/keyword-lists-loader';

async function debugKeywordExtraction() {
  console.log('🔍 キーワード抽出デバッグテスト開始');
  console.log('=' .repeat(60));
  
  const query = '教室管理の詳細は';
  console.log(`📝 テストクエリ: "${query}"`);
  console.log('');
  
  try {
    // Step 1: KeywordListsLoaderの状態確認
    console.log('📊 Step 1: KeywordListsLoaderの状態確認');
    const keywordListsLoader = KeywordListsLoader.getInstance();
    
    if (!keywordListsLoader.isLoaded()) {
      console.log('⚠️ キーワードリストが読み込まれていません。読み込み中...');
      await keywordListsLoader.loadKeywordLists();
    } else {
      console.log('✅ キーワードリストは既に読み込まれています');
    }
    
    // Step 2: キーワード抽出の実行
    console.log('\n📊 Step 2: キーワード抽出の実行');
    const result = await extractKeywordsConfigured(query);
    
    console.log('📋 抽出結果:');
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- キーワードソース: ${result.metadata.keywordSource}`);
    console.log(`- 処理時間: ${result.metadata.processingTime}ms`);
    console.log('');
    
    // Step 3: 抽出されたキーワードの詳細表示
    console.log('📋 Step 3: 抽出されたキーワードの詳細');
    console.log('🔑 抽出されたキーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    console.log('');
    
    // Step 4: 優先度別の分類
    console.log('📋 Step 4: 優先度別の分類');
    console.log(`🔥 Critical Priority (${result.criticalPriority.size}):`);
    Array.from(result.criticalPriority).forEach(keyword => {
      console.log(`  - "${keyword}"`);
    });
    
    console.log(`⭐ High Priority (${result.highPriority.size}):`);
    Array.from(result.highPriority).forEach(keyword => {
      console.log(`  - "${keyword}"`);
    });
    
    console.log(`📄 Medium Priority (${result.mediumPriority.size}):`);
    Array.from(result.mediumPriority).forEach(keyword => {
      console.log(`  - "${keyword}"`);
    });
    
    console.log(`📝 Low Priority (${result.lowPriority.size}):`);
    Array.from(result.lowPriority).forEach(keyword => {
      console.log(`  - "${keyword}"`);
    });
    console.log('');
    
    // Step 5: 統計情報
    console.log('📋 Step 5: 統計情報');
    console.log('📊 カテゴリ別統計:');
    const stats = result.metadata.statistics.byCategory;
    console.log(`  - ドメイン名: ${stats.domainNames}個`);
    console.log(`  - 機能名: ${stats.functionNames}個`);
    console.log(`  - 操作名: ${stats.operationNames}個`);
    console.log(`  - システム項目: ${stats.systemFields}個`);
    console.log(`  - システム用語: ${stats.systemTerms}個`);
    console.log(`  - 関連キーワード: ${stats.relatedKeywords}個`);
    console.log('');
    
    // Step 6: 問題の分析
    console.log('📋 Step 6: 問題の分析');
    console.log('🔍 期待されるキーワード: ["教室", "管理", "詳細"]');
    console.log('🔍 実際のキーワード:', JSON.stringify(result.keywords, null, 2));
    
    const expectedKeywords = ['教室', '管理', '詳細'];
    const foundExpected = expectedKeywords.filter(expected => 
      result.keywords.some(actual => actual.includes(expected))
    );
    
    console.log(`✅ 期待されるキーワードが見つかった: ${foundExpected.length}/${expectedKeywords.length}`);
    console.log(`  見つかったキーワード: [${foundExpected.join(', ')}]`);
    
    const missingExpected = expectedKeywords.filter(expected => 
      !result.keywords.some(actual => actual.includes(expected))
    );
    console.log(`❌ 見つからなかったキーワード: [${missingExpected.join(', ')}]`);
    
    // Step 7: 不適切なキーワードの特定
    console.log('\n📋 Step 7: 不適切なキーワードの特定');
    const inappropriateKeywords = result.keywords.filter(keyword => 
      !expectedKeywords.some(expected => keyword.includes(expected)) &&
      !keyword.includes('教室') && !keyword.includes('管理')
    );
    
    if (inappropriateKeywords.length > 0) {
      console.log('❌ 不適切なキーワード:');
      inappropriateKeywords.forEach(keyword => {
        console.log(`  - "${keyword}"`);
      });
    } else {
      console.log('✅ 不適切なキーワードは見つかりませんでした');
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ キーワード抽出デバッグテスト完了');
}

// テスト実行
if (require.main === module) {
  debugKeywordExtraction();
}

export { debugKeywordExtraction };
