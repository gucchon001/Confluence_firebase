/**
 * DynamicKeywordExtractorのデバッグテスト
 */

async function debugDynamicExtractor() {
  console.log('🔍 DynamicKeywordExtractorデバッグテスト開始');
  console.log('=' .repeat(60));

  const query = '教室コピー機能でコピー可能な項目は？';
  console.log(`🔍 テストクエリ: "${query}"`);
  console.log('');

  try {
    // DynamicKeywordExtractorを直接使用
    const { DynamicKeywordExtractor } = await import('../lib/dynamic-keyword-extractor');
    const extractor = new DynamicKeywordExtractor();
    
    console.log('📋 DynamicKeywordExtractorの詳細ログ:');
    const result = await extractor.extractDynamicKeywords(query);
    
    console.log('');
    console.log('🔑 最終的な抽出キーワード:');
    result.keywords.forEach((keyword, index) => {
      console.log(`  ${index + 1}. "${keyword}"`);
    });
    
    console.log('');
    console.log('📊 統計情報:');
    console.log(`- 総キーワード数: ${result.keywords.length}`);
    console.log(`- ドメインキーワード数: ${result.statistics.domainKeywords}`);
    console.log(`- パターンキーワード数: ${result.statistics.patternKeywords}`);
    console.log(`- フィルタ後キーワード数: ${result.statistics.filteredKeywords}`);
    console.log(`- 処理時間: ${result.processingTime}ms`);
    console.log(`- ドメイン: ${result.metadata.domain}`);
    console.log(`- パターン: [${result.metadata.patterns.join(', ')}]`);
    console.log(`- フィルタ: [${result.metadata.filters.join(', ')}]`);

  } catch (error) {
    console.error('❌ デバッグテスト実行エラー:', error);
  }

  console.log('');
  console.log('=' .repeat(60));
  console.log('✅ DynamicKeywordExtractorデバッグテスト完了');
}

// テスト実行
debugDynamicExtractor();
