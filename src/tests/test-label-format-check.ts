/**
 * ラベル格納形式の確認テスト
 * LanceDBに格納されているラベルの形式を詳細調査
 */

import { lancedbClient } from '../lib/lancedb-client';

async function checkLabelFormat() {
  console.log('🔍 LanceDBラベル格納形式の確認');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    const results = await table.search().limit(10).toArray();
    
    console.log(`📊 取得した結果数: ${results.length}件`);
    
    results.forEach((result, index) => {
      console.log(`\n[結果 ${index + 1}] ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`  ラベル型: ${typeof result.labels}`);
      
      if (Array.isArray(result.labels)) {
        console.log(`  配列長: ${result.labels.length}`);
        result.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
        });
      } else if (typeof result.labels === 'string') {
        console.log(`  文字列長: ${result.labels.length}`);
        try {
          const parsed = JSON.parse(result.labels);
          console.log(`  JSON解析結果: ${JSON.stringify(parsed)}`);
          console.log(`  解析後型: ${typeof parsed}`);
        } catch (e) {
          console.log(`  JSON解析失敗: ${e.message}`);
        }
      }
    });

    // 議事録・フォルダラベルを持つ結果を特定
    console.log('\n🎯 議事録・フォルダラベルの確認');
    console.log('=' .repeat(40));
    
    const meetingNotesResults = results.filter(result => {
      const labels = result.labels;
      if (Array.isArray(labels)) {
        return labels.some(label => 
          typeof label === 'string' && 
          (label.includes('議事録') || label.includes('meeting-notes') || label.includes('フォルダ'))
        );
      } else if (typeof labels === 'string') {
        return labels.includes('議事録') || labels.includes('meeting-notes') || labels.includes('フォルダ');
      }
      return false;
    });

    console.log(`📊 議事録・フォルダラベルを持つ結果: ${meetingNotesResults.length}件`);
    
    meetingNotesResults.forEach((result, index) => {
      console.log(`\n[議事録・フォルダ ${index + 1}] ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// テスト実行
checkLabelFormat().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * ラベル格納形式の確認テスト
 * LanceDBに格納されているラベルの形式を詳細調査
 */

import { lancedbClient } from '../lib/lancedb-client';

async function checkLabelFormat() {
  console.log('🔍 LanceDBラベル格納形式の確認');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    const results = await table.search().limit(10).toArray();
    
    console.log(`📊 取得した結果数: ${results.length}件`);
    
    results.forEach((result, index) => {
      console.log(`\n[結果 ${index + 1}] ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`  ラベル型: ${typeof result.labels}`);
      
      if (Array.isArray(result.labels)) {
        console.log(`  配列長: ${result.labels.length}`);
        result.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
        });
      } else if (typeof result.labels === 'string') {
        console.log(`  文字列長: ${result.labels.length}`);
        try {
          const parsed = JSON.parse(result.labels);
          console.log(`  JSON解析結果: ${JSON.stringify(parsed)}`);
          console.log(`  解析後型: ${typeof parsed}`);
        } catch (e) {
          console.log(`  JSON解析失敗: ${e.message}`);
        }
      }
    });

    // 議事録・フォルダラベルを持つ結果を特定
    console.log('\n🎯 議事録・フォルダラベルの確認');
    console.log('=' .repeat(40));
    
    const meetingNotesResults = results.filter(result => {
      const labels = result.labels;
      if (Array.isArray(labels)) {
        return labels.some(label => 
          typeof label === 'string' && 
          (label.includes('議事録') || label.includes('meeting-notes') || label.includes('フォルダ'))
        );
      } else if (typeof labels === 'string') {
        return labels.includes('議事録') || labels.includes('meeting-notes') || labels.includes('フォルダ');
      }
      return false;
    });

    console.log(`📊 議事録・フォルダラベルを持つ結果: ${meetingNotesResults.length}件`);
    
    meetingNotesResults.forEach((result, index) => {
      console.log(`\n[議事録・フォルダ ${index + 1}] ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// テスト実行
checkLabelFormat().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
