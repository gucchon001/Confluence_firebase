/**
 * 既存の検索機能を使って特定ページのラベルを分析
 * ページID 703561854 のラベル格納形式を調査
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function analyzeSpecificPageViaSearch() {
  console.log('🔍 既存の検索機能を使って特定ページのラベル分析');
  console.log('=' .repeat(60));

  const targetPageId = 703561854;

  try {
    // 複数のクエリで検索を実行して、対象ページを見つける
    const testQueries = [
      'ミーティング議事録',
      '2023-09-01',
      '2025-09-10',
      '議事録',
      'meeting'
    ];

    let foundTargetPage = false;

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n[${i + 1}/${testQueries.length}] テストクエリ: "${query}"`);

      try {
        const results = await searchLanceDB({
          query,
          topK: 20,
          tableName: 'confluence',
          labelFilters: {
            includeMeetingNotes: true,  // すべて含める
            includeArchived: true,
            includeFolders: true
          }
        });

        console.log(`📊 検索結果数: ${results.length}件`);

        // 対象ページIDを含む結果を探す
        const targetResults = results.filter(result => 
          result.pageId === targetPageId
        );

        if (targetResults.length > 0) {
          console.log(`\n🎯 対象ページID ${targetPageId} が見つかりました！`);
          foundTargetPage = true;
          
          targetResults.forEach((result, index) => {
            console.log(`\n[対象ページ ${index + 1}] ページID: ${result.pageId}`);
            console.log(`  タイトル: ${result.title}`);
            console.log(`  チャンクインデックス: ${result.chunkIndex}`);
            console.log(`  ラベル生データ: ${JSON.stringify(result.labels)}`);
            console.log(`  ラベル型: ${typeof result.labels}`);
            console.log(`  ラベルconstructor: ${result.labels?.constructor?.name}`);
            console.log(`  ソース: ${result.source}`);
            
            if (result.labels !== null && result.labels !== undefined) {
              if (Array.isArray(result.labels)) {
                console.log(`  配列長: ${result.labels.length}`);
                result.labels.forEach((label, j) => {
                  console.log(`    [${j}]: ${JSON.stringify(label)} (型: ${typeof label})`);
                  if (typeof label === 'object' && label !== null) {
                    console.log(`      object keys: ${Object.keys(label)}`);
                    console.log(`      object values: ${Object.values(label)}`);
                  }
                });
              } else if (typeof result.labels === 'string') {
                console.log(`  文字列長: ${result.labels.length}`);
                console.log(`  文字列内容: "${result.labels}"`);
                
                // JSON解析を試行
                try {
                  const parsed = JSON.parse(result.labels);
                  console.log(`  JSON解析成功: ${JSON.stringify(parsed)}`);
                  console.log(`  解析後型: ${typeof parsed}`);
                  if (Array.isArray(parsed)) {
                    console.log(`  解析後配列長: ${parsed.length}`);
                    parsed.forEach((item, j) => {
                      console.log(`    [${j}]: ${JSON.stringify(item)} (型: ${typeof item})`);
                    });
                  }
                } catch (e) {
                  console.log(`  JSON解析失敗: ${e.message}`);
                }
              } else if (typeof result.labels === 'object' && result.labels !== null) {
                console.log(`  オブジェクト型: ${typeof result.labels}`);
                console.log(`  オブジェクトkeys: ${Object.keys(result.labels)}`);
                console.log(`  オブジェクトvalues: ${Object.values(result.labels)}`);
                
                // オブジェクトの各プロパティを詳細表示
                Object.entries(result.labels).forEach(([key, value]) => {
                  console.log(`    ${key}: ${JSON.stringify(value)} (型: ${typeof value})`);
                });
              }
            } else {
              console.log(`  ラベル: null/undefined`);
            }
            
            // その他のフィールドも確認
            console.log(`  スペースキー: ${result.space_key}`);
            console.log(`  URL: ${result.url}`);
            console.log(`  最終更新日時: ${result.lastUpdated}`);
            console.log(`  コンテンツ長: ${result.content?.length || 0}文字`);
          });
        }

        // 議事録関連の結果も表示
        const meetingResults = results.filter(result => 
          result.title.includes('議事録') || 
          result.title.includes('meeting') || 
          result.title.includes('ミーティング')
        );

        if (meetingResults.length > 0) {
          console.log(`\n📊 議事録関連結果: ${meetingResults.length}件`);
          meetingResults.slice(0, 3).forEach((result, index) => {
            console.log(`\n[議事録 ${index + 1}] ページID: ${result.pageId}`);
            console.log(`  タイトル: ${result.title}`);
            console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
            console.log(`  ラベル型: ${typeof result.labels}`);
          });
        }

      } catch (error) {
        console.error(`❌ クエリ "${query}" でエラー:`, error.message);
      }
    }

    if (!foundTargetPage) {
      console.log(`\n❌ 対象ページID ${targetPageId} が見つかりませんでした`);
      console.log('📊 全検索結果からページIDを確認中...');
      
      // 全検索結果からページIDを抽出
      const allPageIds = new Set();
      for (const query of testQueries) {
        try {
          const results = await searchLanceDB({
            query,
            topK: 10,
            tableName: 'confluence',
            labelFilters: {
              includeMeetingNotes: true,
              includeArchived: true,
              includeFolders: true
            }
          });
          
          results.forEach(result => {
            if (result.pageId) {
              allPageIds.add(result.pageId);
            }
          });
        } catch (error) {
          // エラーは無視
        }
      }
      
      console.log(`📊 検索で見つかったページID数: ${allPageIds.size}件`);
      const sortedPageIds = Array.from(allPageIds).sort((a, b) => a - b);
      console.log(`📊 ページID範囲: ${sortedPageIds[0]} - ${sortedPageIds[sortedPageIds.length - 1]}`);
      
      // 対象ページIDに近いページIDを表示
      const nearbyPageIds = sortedPageIds.filter(id => 
        Math.abs(id - targetPageId) <= 1000
      );
      console.log(`📊 対象ページID ${targetPageId} に近いページID: ${nearbyPageIds.slice(0, 10).join(', ')}`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
analyzeSpecificPageViaSearch().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * 既存の検索機能を使って特定ページのラベルを分析
 * ページID 703561854 のラベル格納形式を調査
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function analyzeSpecificPageViaSearch() {
  console.log('🔍 既存の検索機能を使って特定ページのラベル分析');
  console.log('=' .repeat(60));

  const targetPageId = 703561854;

  try {
    // 複数のクエリで検索を実行して、対象ページを見つける
    const testQueries = [
      'ミーティング議事録',
      '2023-09-01',
      '2025-09-10',
      '議事録',
      'meeting'
    ];

    let foundTargetPage = false;

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n[${i + 1}/${testQueries.length}] テストクエリ: "${query}"`);

      try {
        const results = await searchLanceDB({
          query,
          topK: 20,
          tableName: 'confluence',
          labelFilters: {
            includeMeetingNotes: true,  // すべて含める
            includeArchived: true,
            includeFolders: true
          }
        });

        console.log(`📊 検索結果数: ${results.length}件`);

        // 対象ページIDを含む結果を探す
        const targetResults = results.filter(result => 
          result.pageId === targetPageId
        );

        if (targetResults.length > 0) {
          console.log(`\n🎯 対象ページID ${targetPageId} が見つかりました！`);
          foundTargetPage = true;
          
          targetResults.forEach((result, index) => {
            console.log(`\n[対象ページ ${index + 1}] ページID: ${result.pageId}`);
            console.log(`  タイトル: ${result.title}`);
            console.log(`  チャンクインデックス: ${result.chunkIndex}`);
            console.log(`  ラベル生データ: ${JSON.stringify(result.labels)}`);
            console.log(`  ラベル型: ${typeof result.labels}`);
            console.log(`  ラベルconstructor: ${result.labels?.constructor?.name}`);
            console.log(`  ソース: ${result.source}`);
            
            if (result.labels !== null && result.labels !== undefined) {
              if (Array.isArray(result.labels)) {
                console.log(`  配列長: ${result.labels.length}`);
                result.labels.forEach((label, j) => {
                  console.log(`    [${j}]: ${JSON.stringify(label)} (型: ${typeof label})`);
                  if (typeof label === 'object' && label !== null) {
                    console.log(`      object keys: ${Object.keys(label)}`);
                    console.log(`      object values: ${Object.values(label)}`);
                  }
                });
              } else if (typeof result.labels === 'string') {
                console.log(`  文字列長: ${result.labels.length}`);
                console.log(`  文字列内容: "${result.labels}"`);
                
                // JSON解析を試行
                try {
                  const parsed = JSON.parse(result.labels);
                  console.log(`  JSON解析成功: ${JSON.stringify(parsed)}`);
                  console.log(`  解析後型: ${typeof parsed}`);
                  if (Array.isArray(parsed)) {
                    console.log(`  解析後配列長: ${parsed.length}`);
                    parsed.forEach((item, j) => {
                      console.log(`    [${j}]: ${JSON.stringify(item)} (型: ${typeof item})`);
                    });
                  }
                } catch (e) {
                  console.log(`  JSON解析失敗: ${e.message}`);
                }
              } else if (typeof result.labels === 'object' && result.labels !== null) {
                console.log(`  オブジェクト型: ${typeof result.labels}`);
                console.log(`  オブジェクトkeys: ${Object.keys(result.labels)}`);
                console.log(`  オブジェクトvalues: ${Object.values(result.labels)}`);
                
                // オブジェクトの各プロパティを詳細表示
                Object.entries(result.labels).forEach(([key, value]) => {
                  console.log(`    ${key}: ${JSON.stringify(value)} (型: ${typeof value})`);
                });
              }
            } else {
              console.log(`  ラベル: null/undefined`);
            }
            
            // その他のフィールドも確認
            console.log(`  スペースキー: ${result.space_key}`);
            console.log(`  URL: ${result.url}`);
            console.log(`  最終更新日時: ${result.lastUpdated}`);
            console.log(`  コンテンツ長: ${result.content?.length || 0}文字`);
          });
        }

        // 議事録関連の結果も表示
        const meetingResults = results.filter(result => 
          result.title.includes('議事録') || 
          result.title.includes('meeting') || 
          result.title.includes('ミーティング')
        );

        if (meetingResults.length > 0) {
          console.log(`\n📊 議事録関連結果: ${meetingResults.length}件`);
          meetingResults.slice(0, 3).forEach((result, index) => {
            console.log(`\n[議事録 ${index + 1}] ページID: ${result.pageId}`);
            console.log(`  タイトル: ${result.title}`);
            console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
            console.log(`  ラベル型: ${typeof result.labels}`);
          });
        }

      } catch (error) {
        console.error(`❌ クエリ "${query}" でエラー:`, error.message);
      }
    }

    if (!foundTargetPage) {
      console.log(`\n❌ 対象ページID ${targetPageId} が見つかりませんでした`);
      console.log('📊 全検索結果からページIDを確認中...');
      
      // 全検索結果からページIDを抽出
      const allPageIds = new Set();
      for (const query of testQueries) {
        try {
          const results = await searchLanceDB({
            query,
            topK: 10,
            tableName: 'confluence',
            labelFilters: {
              includeMeetingNotes: true,
              includeArchived: true,
              includeFolders: true
            }
          });
          
          results.forEach(result => {
            if (result.pageId) {
              allPageIds.add(result.pageId);
            }
          });
        } catch (error) {
          // エラーは無視
        }
      }
      
      console.log(`📊 検索で見つかったページID数: ${allPageIds.size}件`);
      const sortedPageIds = Array.from(allPageIds).sort((a, b) => a - b);
      console.log(`📊 ページID範囲: ${sortedPageIds[0]} - ${sortedPageIds[sortedPageIds.length - 1]}`);
      
      // 対象ページIDに近いページIDを表示
      const nearbyPageIds = sortedPageIds.filter(id => 
        Math.abs(id - targetPageId) <= 1000
      );
      console.log(`📊 対象ページID ${targetPageId} に近いページID: ${nearbyPageIds.slice(0, 10).join(', ')}`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
analyzeSpecificPageViaSearch().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
