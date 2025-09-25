/**
 * 検索機能でのラベルフィルタリングテスト
 * 実際の検索APIでラベル機能が動作するか確認
 */

import 'dotenv/config';
import { searchLanceDB } from '../../lib/lancedb-search-client';

async function testSearchWithLabels() {
  console.log('🔍 検索機能でのラベルフィルタリングテスト');
  console.log('=' .repeat(50));

  try {
    // テストクエリ
    const testQueries = [
      '要件定義',
      'ワークフロー',
      '機能要件',
      '権限',
      '帳票'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 クエリ: "${query}"`);
      console.log('-'.repeat(30));

      try {
        const results = await searchLanceDB({
          query: query,
          limit: 10,
          labelFilters: {
            excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
          }
        });

        console.log(`📊 検索結果: ${results.length}件`);
        
        results.forEach((result, index) => {
          const labels = result.labels && Array.isArray(result.labels) ? result.labels.join(', ') : 'なし';
          console.log(`  [${index + 1}] ${result.title}`);
          console.log(`     ラベル: [${labels}]`);
          console.log(`     スコア: ${result.score?.toFixed(3) || 'N/A'}`);
        });

        // フォルダラベルが含まれているかチェック
        const hasFolderLabel = results.some(result => 
          result.labels && Array.isArray(result.labels) && 
          result.labels.some(label => label.includes('フォルダ'))
        );

        if (hasFolderLabel) {
          console.log('⚠️ 警告: フォルダラベルが含まれているページが検索結果に含まれています');
        } else {
          console.log('✅ フォルダラベルは正しく除外されています');
        }

      } catch (error) {
        console.error(`❌ クエリ "${query}" の検索エラー:`, error);
      }
    }

    // 議事録関連のクエリをテスト
    console.log('\n🔍 議事録関連クエリのテスト');
    console.log('-'.repeat(30));

    const meetingQueries = ['議事録', 'ミーティング', 'meeting'];
    
    for (const query of meetingQueries) {
      console.log(`\n🔍 クエリ: "${query}"`);
      
      try {
        const results = await searchLanceDB({
          query: query,
          limit: 5,
          labelFilters: {
            excludeLabels: ['フォルダ', '議事録', 'meeting-notes', 'アーカイブ', 'archive']
          }
        });

        console.log(`📊 検索結果: ${results.length}件`);
        
        if (results.length > 0) {
          console.log('⚠️ 警告: 議事録関連のページが検索結果に含まれています');
          results.forEach((result, index) => {
            const labels = result.labels && Array.isArray(result.labels) ? result.labels.join(', ') : 'なし';
            console.log(`  [${index + 1}] ${result.title} - ラベル: [${labels}]`);
          });
        } else {
          console.log('✅ 議事録関連のページは正しく除外されています');
        }

      } catch (error) {
        console.error(`❌ クエリ "${query}" の検索エラー:`, error);
      }
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
  }
}

testSearchWithLabels().catch(console.error);
