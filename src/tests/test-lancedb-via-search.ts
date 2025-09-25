/**
 * 既存の検索機能を使ってLanceDBラベル構造を調査
 * 実際の検索結果からラベルの形式を分析
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function investigateLanceDBViaSearch() {
  console.log('🔍 既存の検索機能を使ってLanceDBラベル構造を調査');
  console.log('=' .repeat(60));

  try {
    // 複数のクエリで検索を実行
    const testQueries = [
      'ログイン機能について',
      '教室管理の詳細',
      'オファー管理の機能'
    ];

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n[${i + 1}/${testQueries.length}] テストクエリ: "${query}"`);

      try {
        const results = await searchLanceDB({
          query,
          topK: 10,
          tableName: 'confluence',
          labelFilters: {
            includeMeetingNotes: true,  // すべて含める
            includeArchived: true,
            includeFolders: true
          }
        });

        console.log(`📊 検索結果数: ${results.length}件`);

        // 各結果のラベルを詳細分析
        results.forEach((result, index) => {
          console.log(`\n  [結果 ${index + 1}] ${result.title}`);
          console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
          console.log(`     ラベル型: ${typeof result.labels}`);
          console.log(`     ソース: ${result.source}`);
          
          if (Array.isArray(result.labels)) {
            console.log(`     配列長: ${result.labels.length}`);
            result.labels.forEach((label, j) => {
              console.log(`       [${j}]: ${JSON.stringify(label)} (型: ${typeof label})`);
            });
          } else if (typeof result.labels === 'string') {
            console.log(`     文字列長: ${result.labels.length}`);
            console.log(`     文字列内容: "${result.labels}"`);
            
            // JSON解析を試行
            try {
              const parsed = JSON.parse(result.labels);
              console.log(`     JSON解析成功: ${JSON.stringify(parsed)}`);
              console.log(`     解析後型: ${typeof parsed}`);
            } catch (e) {
              console.log(`     JSON解析失敗: ${e.message}`);
            }
          }
        });

        // 議事録・フォルダ関連の結果を特定
        const meetingRelatedResults = results.filter(result => {
          const title = result.title || '';
          const labels = result.labels;
          
          const titleContainsMeeting = title.includes('議事録') || 
                                     title.includes('meeting') || 
                                     title.includes('ミーティング') ||
                                     title.includes('フォルダ');
          
          let labelsContainMeeting = false;
          if (labels && Array.isArray(labels)) {
            labelsContainMeeting = labels.some(label => 
              String(label).toLowerCase().includes('議事録') ||
              String(label).toLowerCase().includes('meeting') ||
              String(label).toLowerCase().includes('フォルダ')
            );
          }
          
          return titleContainsMeeting || labelsContainMeeting;
        });

        if (meetingRelatedResults.length > 0) {
          console.log(`\n🎯 議事録・フォルダ関連結果: ${meetingRelatedResults.length}件`);
          meetingRelatedResults.forEach((result, index) => {
            console.log(`\n  [議事録関連 ${index + 1}] ${result.title}`);
            console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
            console.log(`     ラベル型: ${typeof result.labels}`);
          });
        }

      } catch (error) {
        console.error(`❌ クエリ "${query}" でエラー:`, error.message);
      }
    }

    // ラベルの型分布を分析
    console.log('\n📊 全クエリのラベル型分布分析');
    console.log('=' .repeat(40));
    
    const allResults = [];
    for (const query of testQueries) {
      try {
        const results = await searchLanceDB({
          query,
          topK: 5,
          tableName: 'confluence',
          labelFilters: {
            includeMeetingNotes: true,
            includeArchived: true,
            includeFolders: true
          }
        });
        allResults.push(...results);
      } catch (error) {
        console.error(`❌ クエリ "${query}" でエラー:`, error.message);
      }
    }

    const typeDistribution = allResults.reduce((acc, result) => {
      const type = typeof result.labels;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}件`);
    });

    // 空のラベルを持つ結果
    const emptyLabelResults = allResults.filter(result => 
      !result.labels || 
      (Array.isArray(result.labels) && result.labels.length === 0) ||
      (typeof result.labels === 'string' && result.labels.trim() === '')
    );
    
    console.log(`\n📊 空のラベルを持つ結果: ${emptyLabelResults.length}件`);
    console.log(`📊 全結果数: ${allResults.length}件`);
    console.log(`📊 空ラベル率: ${((emptyLabelResults.length / allResults.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
investigateLanceDBViaSearch().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * 既存の検索機能を使ってLanceDBラベル構造を調査
 * 実際の検索結果からラベルの形式を分析
 */

import { searchLanceDB } from '../lib/lancedb-search-client';

async function investigateLanceDBViaSearch() {
  console.log('🔍 既存の検索機能を使ってLanceDBラベル構造を調査');
  console.log('=' .repeat(60));

  try {
    // 複数のクエリで検索を実行
    const testQueries = [
      'ログイン機能について',
      '教室管理の詳細',
      'オファー管理の機能'
    ];

    for (let i = 0; i < testQueries.length; i++) {
      const query = testQueries[i];
      console.log(`\n[${i + 1}/${testQueries.length}] テストクエリ: "${query}"`);

      try {
        const results = await searchLanceDB({
          query,
          topK: 10,
          tableName: 'confluence',
          labelFilters: {
            includeMeetingNotes: true,  // すべて含める
            includeArchived: true,
            includeFolders: true
          }
        });

        console.log(`📊 検索結果数: ${results.length}件`);

        // 各結果のラベルを詳細分析
        results.forEach((result, index) => {
          console.log(`\n  [結果 ${index + 1}] ${result.title}`);
          console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
          console.log(`     ラベル型: ${typeof result.labels}`);
          console.log(`     ソース: ${result.source}`);
          
          if (Array.isArray(result.labels)) {
            console.log(`     配列長: ${result.labels.length}`);
            result.labels.forEach((label, j) => {
              console.log(`       [${j}]: ${JSON.stringify(label)} (型: ${typeof label})`);
            });
          } else if (typeof result.labels === 'string') {
            console.log(`     文字列長: ${result.labels.length}`);
            console.log(`     文字列内容: "${result.labels}"`);
            
            // JSON解析を試行
            try {
              const parsed = JSON.parse(result.labels);
              console.log(`     JSON解析成功: ${JSON.stringify(parsed)}`);
              console.log(`     解析後型: ${typeof parsed}`);
            } catch (e) {
              console.log(`     JSON解析失敗: ${e.message}`);
            }
          }
        });

        // 議事録・フォルダ関連の結果を特定
        const meetingRelatedResults = results.filter(result => {
          const title = result.title || '';
          const labels = result.labels;
          
          const titleContainsMeeting = title.includes('議事録') || 
                                     title.includes('meeting') || 
                                     title.includes('ミーティング') ||
                                     title.includes('フォルダ');
          
          let labelsContainMeeting = false;
          if (labels && Array.isArray(labels)) {
            labelsContainMeeting = labels.some(label => 
              String(label).toLowerCase().includes('議事録') ||
              String(label).toLowerCase().includes('meeting') ||
              String(label).toLowerCase().includes('フォルダ')
            );
          }
          
          return titleContainsMeeting || labelsContainMeeting;
        });

        if (meetingRelatedResults.length > 0) {
          console.log(`\n🎯 議事録・フォルダ関連結果: ${meetingRelatedResults.length}件`);
          meetingRelatedResults.forEach((result, index) => {
            console.log(`\n  [議事録関連 ${index + 1}] ${result.title}`);
            console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
            console.log(`     ラベル型: ${typeof result.labels}`);
          });
        }

      } catch (error) {
        console.error(`❌ クエリ "${query}" でエラー:`, error.message);
      }
    }

    // ラベルの型分布を分析
    console.log('\n📊 全クエリのラベル型分布分析');
    console.log('=' .repeat(40));
    
    const allResults = [];
    for (const query of testQueries) {
      try {
        const results = await searchLanceDB({
          query,
          topK: 5,
          tableName: 'confluence',
          labelFilters: {
            includeMeetingNotes: true,
            includeArchived: true,
            includeFolders: true
          }
        });
        allResults.push(...results);
      } catch (error) {
        console.error(`❌ クエリ "${query}" でエラー:`, error.message);
      }
    }

    const typeDistribution = allResults.reduce((acc, result) => {
      const type = typeof result.labels;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}件`);
    });

    // 空のラベルを持つ結果
    const emptyLabelResults = allResults.filter(result => 
      !result.labels || 
      (Array.isArray(result.labels) && result.labels.length === 0) ||
      (typeof result.labels === 'string' && result.labels.trim() === '')
    );
    
    console.log(`\n📊 空のラベルを持つ結果: ${emptyLabelResults.length}件`);
    console.log(`📊 全結果数: ${allResults.length}件`);
    console.log(`📊 空ラベル率: ${((emptyLabelResults.length / allResults.length) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
investigateLanceDBViaSearch().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
