/**
 * 参照元URLの確認テスト
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function checkReferenceUrls(): Promise<void> {
  console.log('🔍 参照元URLの確認テスト開始\n');

  try {
    const searchResults = await searchLanceDB({
      query: '教室コピー機能のコピーできる項目は',
      topK: 5,
      tableName: 'confluence',
      useLunrIndex: true,
      labelFilters: {
        excludeMeetingNotes: true
      }
    });

    console.log('📋 検索結果のURL詳細:');
    searchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.title}`);
      console.log(`   - URL: ${result.url}`);
      console.log(`   - Space Key: ${result.space_key}`);
      console.log(`   - Page ID: ${result.pageId}`);
      console.log(`   - Source: ${result.source}`);
      console.log(`   - Score: ${result.score}`);
      
      // URLの形式をチェック
      if (result.url) {
        if (result.url.startsWith('http')) {
          console.log(`   ✅ 正常なURL形式`);
        } else if (result.url.startsWith('/')) {
          console.log(`   ⚠️  相対パス形式`);
        } else if (result.url === '#') {
          console.log(`   ❌ プレースホルダーURL`);
        } else {
          console.log(`   ❓ 不明なURL形式: ${result.url}`);
        }
      } else {
        console.log(`   ❌ URLが存在しない`);
      }
    });

    // URLの統計
    const urlStats = {
      validUrls: 0,
      relativePaths: 0,
      placeholderUrls: 0,
      missingUrls: 0,
      unknownUrls: 0
    };

    searchResults.forEach(result => {
      if (!result.url) {
        urlStats.missingUrls++;
      } else if (result.url.startsWith('http')) {
        urlStats.validUrls++;
      } else if (result.url.startsWith('/')) {
        urlStats.relativePaths++;
      } else if (result.url === '#') {
        urlStats.placeholderUrls++;
      } else {
        urlStats.unknownUrls++;
      }
    });

    console.log('\n📊 URL統計:');
    console.log(`- 正常なURL: ${urlStats.validUrls}件`);
    console.log(`- 相対パス: ${urlStats.relativePaths}件`);
    console.log(`- プレースホルダー: ${urlStats.placeholderUrls}件`);
    console.log(`- URLなし: ${urlStats.missingUrls}件`);
    console.log(`- 不明な形式: ${urlStats.unknownUrls}件`);

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

if (require.main === module) {
  checkReferenceUrls().catch(console.error);
}

export { checkReferenceUrls };
