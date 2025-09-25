/**
 * ラベルフィルタリングのデバッグテスト
 * 議事録・フォルダが正しく除外されているか確認
 */

import { searchLanceDB } from '../lib/lancedb-search-client';
import { labelManager } from '../lib/label-manager';
import { getLabelsAsArray } from '../lib/label-utils';

async function testLabelFilteringDebug() {
  console.log('🔍 ラベルフィルタリングデバッグテスト');
  console.log('=' .repeat(60));

  const testQuery = 'ログイン機能について';
  
  try {
    console.log(`\n📊 テストクエリ: "${testQuery}"`);

    // 1. ラベルフィルタリング有効での検索
    console.log('\n1️⃣ ラベルフィルタリング有効での検索');
    const resultsWithFilter = await searchLanceDB({
      query: testQuery,
      topK: 10,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });

    console.log(`📊 フィルタリング有効結果数: ${resultsWithFilter.length}件`);
    
    // 結果の詳細表示
    resultsWithFilter.forEach((result, index) => {
      console.log(`\n  ${index + 1}. ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`     ソース: ${result.source}`);
    });

    // 2. ラベルフィルタリング無効での検索（比較用）
    console.log('\n2️⃣ ラベルフィルタリング無効での検索（比較用）');
    const resultsWithoutFilter = await searchLanceDB({
      query: testQuery,
      topK: 10,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: true,
        includeArchived: true,
        includeFolders: true
      }
    });

    console.log(`📊 フィルタリング無効結果数: ${resultsWithoutFilter.length}件`);
    
    // 議事録・フォルダラベルを持つ結果を特定
    const meetingNotesResults = resultsWithoutFilter.filter(result => {
      const labels = getLabelsAsArray(result.labels);
      return labels.some(label => 
        String(label).toLowerCase().includes('議事録') || 
        String(label).toLowerCase().includes('meeting-notes') ||
        String(label).toLowerCase().includes('フォルダ')
      );
    });

    console.log(`\n🎯 議事録・フォルダラベルを持つ結果: ${meetingNotesResults.length}件`);
    meetingNotesResults.forEach((result, index) => {
      console.log(`\n  [議事録・フォルダ ${index + 1}] ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`     ソース: ${result.source}`);
    });

    // 3. ラベルフィルタリングの動作確認
    console.log('\n3️⃣ ラベルフィルタリングの動作確認');
    
    const filterOptions = labelManager.getDefaultFilterOptions();
    const excludeLabels = labelManager.buildExcludeLabels(filterOptions);
    
    console.log(`📋 フィルタオプション:`, filterOptions);
    console.log(`📋 除外ラベル:`, excludeLabels);
    
    // 各結果のラベルフィルタリング判定
    resultsWithoutFilter.forEach((result, index) => {
      const isExcluded = labelManager.isExcluded(result.labels, excludeLabels);
      const labels = getLabelsAsArray(result.labels);
      
      console.log(`\n  [結果 ${index + 1}] ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(labels)}`);
      console.log(`     除外判定: ${isExcluded ? '❌ 除外' : '✅ 含む'}`);
      
      if (isExcluded) {
        // どのラベルが除外原因かを特定
        labels.forEach(label => {
          const isExcludedLabel = excludeLabels.some(excludeLabel => 
            String(label).toLowerCase() === excludeLabel.toLowerCase()
          );
          if (isExcludedLabel) {
            console.log(`       除外原因ラベル: "${label}"`);
          }
        });
      }
    });

    // 4. 比較分析
    console.log(`\n📊 比較分析:`);
    console.log(`   フィルタリング有効: ${resultsWithFilter.length}件`);
    console.log(`   フィルタリング無効: ${resultsWithoutFilter.length}件`);
    console.log(`   除外された件数: ${resultsWithoutFilter.length - resultsWithFilter.length}件`);
    console.log(`   議事録・フォルダ件数: ${meetingNotesResults.length}件`);

    // 5. 問題の特定
    console.log(`\n🔍 問題の特定:`);
    const expectedExcluded = meetingNotesResults.length;
    const actualExcluded = resultsWithoutFilter.length - resultsWithFilter.length;
    
    if (actualExcluded >= expectedExcluded) {
      console.log('   ✅ ラベルフィルタリングは正常に動作している');
    } else {
      console.log('   ❌ ラベルフィルタリングに問題がある');
      console.log(`      期待される除外件数: ${expectedExcluded}件`);
      console.log(`      実際の除外件数: ${actualExcluded}件`);
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    throw error;
  }
}

// テスト実行
testLabelFilteringDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * ラベルフィルタリングのデバッグテスト
 * 議事録・フォルダが正しく除外されているか確認
 */

import { searchLanceDB } from '../lib/lancedb-search-client';
import { labelManager } from '../lib/label-manager';
import { getLabelsAsArray } from '../lib/label-utils';

async function testLabelFilteringDebug() {
  console.log('🔍 ラベルフィルタリングデバッグテスト');
  console.log('=' .repeat(60));

  const testQuery = 'ログイン機能について';
  
  try {
    console.log(`\n📊 テストクエリ: "${testQuery}"`);

    // 1. ラベルフィルタリング有効での検索
    console.log('\n1️⃣ ラベルフィルタリング有効での検索');
    const resultsWithFilter = await searchLanceDB({
      query: testQuery,
      topK: 10,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: false,
        includeArchived: false,
        includeFolders: false
      }
    });

    console.log(`📊 フィルタリング有効結果数: ${resultsWithFilter.length}件`);
    
    // 結果の詳細表示
    resultsWithFilter.forEach((result, index) => {
      console.log(`\n  ${index + 1}. ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`     ソース: ${result.source}`);
    });

    // 2. ラベルフィルタリング無効での検索（比較用）
    console.log('\n2️⃣ ラベルフィルタリング無効での検索（比較用）');
    const resultsWithoutFilter = await searchLanceDB({
      query: testQuery,
      topK: 10,
      tableName: 'confluence',
      labelFilters: {
        includeMeetingNotes: true,
        includeArchived: true,
        includeFolders: true
      }
    });

    console.log(`📊 フィルタリング無効結果数: ${resultsWithoutFilter.length}件`);
    
    // 議事録・フォルダラベルを持つ結果を特定
    const meetingNotesResults = resultsWithoutFilter.filter(result => {
      const labels = getLabelsAsArray(result.labels);
      return labels.some(label => 
        String(label).toLowerCase().includes('議事録') || 
        String(label).toLowerCase().includes('meeting-notes') ||
        String(label).toLowerCase().includes('フォルダ')
      );
    });

    console.log(`\n🎯 議事録・フォルダラベルを持つ結果: ${meetingNotesResults.length}件`);
    meetingNotesResults.forEach((result, index) => {
      console.log(`\n  [議事録・フォルダ ${index + 1}] ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`     ソース: ${result.source}`);
    });

    // 3. ラベルフィルタリングの動作確認
    console.log('\n3️⃣ ラベルフィルタリングの動作確認');
    
    const filterOptions = labelManager.getDefaultFilterOptions();
    const excludeLabels = labelManager.buildExcludeLabels(filterOptions);
    
    console.log(`📋 フィルタオプション:`, filterOptions);
    console.log(`📋 除外ラベル:`, excludeLabels);
    
    // 各結果のラベルフィルタリング判定
    resultsWithoutFilter.forEach((result, index) => {
      const isExcluded = labelManager.isExcluded(result.labels, excludeLabels);
      const labels = getLabelsAsArray(result.labels);
      
      console.log(`\n  [結果 ${index + 1}] ${result.title}`);
      console.log(`     ラベル: ${JSON.stringify(labels)}`);
      console.log(`     除外判定: ${isExcluded ? '❌ 除外' : '✅ 含む'}`);
      
      if (isExcluded) {
        // どのラベルが除外原因かを特定
        labels.forEach(label => {
          const isExcludedLabel = excludeLabels.some(excludeLabel => 
            String(label).toLowerCase() === excludeLabel.toLowerCase()
          );
          if (isExcludedLabel) {
            console.log(`       除外原因ラベル: "${label}"`);
          }
        });
      }
    });

    // 4. 比較分析
    console.log(`\n📊 比較分析:`);
    console.log(`   フィルタリング有効: ${resultsWithFilter.length}件`);
    console.log(`   フィルタリング無効: ${resultsWithoutFilter.length}件`);
    console.log(`   除外された件数: ${resultsWithoutFilter.length - resultsWithFilter.length}件`);
    console.log(`   議事録・フォルダ件数: ${meetingNotesResults.length}件`);

    // 5. 問題の特定
    console.log(`\n🔍 問題の特定:`);
    const expectedExcluded = meetingNotesResults.length;
    const actualExcluded = resultsWithoutFilter.length - resultsWithFilter.length;
    
    if (actualExcluded >= expectedExcluded) {
      console.log('   ✅ ラベルフィルタリングは正常に動作している');
    } else {
      console.log('   ❌ ラベルフィルタリングに問題がある');
      console.log(`      期待される除外件数: ${expectedExcluded}件`);
      console.log(`      実際の除外件数: ${actualExcluded}件`);
    }

  } catch (error) {
    console.error('❌ テスト実行エラー:', error);
    throw error;
  }
}

// テスト実行
testLabelFilteringDebug().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
