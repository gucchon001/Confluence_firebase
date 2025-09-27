/**
 * 検索結果のフォーマット処理確認テスト
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function checkSearchResultFormatting(): Promise<void> {
  console.log('🔍 検索結果フォーマット処理確認テスト開始\n');

  try {
    console.log('📊 1. 生の検索結果を確認...');
    const searchResults = await searchLanceDB({
      query: '教室コピー機能のコピーできる項目は',
      topK: 3,
      tableName: 'confluence',
      useLunrIndex: true,
      labelFilters: {
        excludeMeetingNotes: true
      }
    });

    console.log('\n📋 検索結果の詳細分析:');
    searchResults.forEach((result, index) => {
      console.log(`\n${index + 1}. 検索結果: ${result.title}`);
      console.log('   全フィールド:');
      Object.keys(result).forEach(key => {
        const value = result[key];
        const type = typeof value;
        const preview = type === 'string' ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : value;
        console.log(`   - ${key}: ${type} = ${preview}`);
      });
      
      // URLフィールドの詳細確認
      console.log('\n   🔗 URLフィールド詳細:');
      console.log(`   - url: "${result.url}"`);
      console.log(`   - url type: ${typeof result.url}`);
      console.log(`   - url length: ${result.url?.length || 0}`);
      console.log(`   - url empty: ${!result.url || result.url.trim() === ''}`);
      
      // Space Keyフィールドの詳細確認
      console.log('\n   🏢 Space Keyフィールド詳細:');
      console.log(`   - space_key: "${result.space_key}"`);
      console.log(`   - space_key type: ${typeof result.space_key}`);
      console.log(`   - space_key empty: ${!result.space_key || result.space_key.trim() === ''}`);
    });

    // 統計情報
    console.log('\n📈 フィールド統計:');
    const urlStats = {
      present: 0,
      empty: 0,
      missing: 0
    };
    
    const spaceKeyStats = {
      present: 0,
      empty: 0,
      missing: 0
    };

    searchResults.forEach(result => {
      // URL統計
      if (!result.url) {
        urlStats.missing++;
      } else if (result.url.trim() === '') {
        urlStats.empty++;
      } else {
        urlStats.present++;
      }
      
      // Space Key統計
      if (!result.space_key) {
        spaceKeyStats.missing++;
      } else if (result.space_key.trim() === '') {
        spaceKeyStats.empty++;
      } else {
        spaceKeyStats.present++;
      }
    });

    console.log('URLフィールド統計:');
    console.log(`- 存在: ${urlStats.present}件`);
    console.log(`- 空: ${urlStats.empty}件`);
    console.log(`- 欠落: ${urlStats.missing}件`);

    console.log('\nSpace Keyフィールド統計:');
    console.log(`- 存在: ${spaceKeyStats.present}件`);
    console.log(`- 空: ${spaceKeyStats.empty}件`);
    console.log(`- 欠落: ${spaceKeyStats.missing}件`);

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

if (require.main === module) {
  checkSearchResultFormatting().catch(console.error);
}

export { checkSearchResultFormatting };
