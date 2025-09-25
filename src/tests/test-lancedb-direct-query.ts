/**
 * LanceDB直接クエリでラベル構造を調査
 * ベクトル検索を使わずに直接データを取得
 */

import { lancedbClient } from '../lib/lancedb-client';

async function investigateLanceDBDirectQuery() {
  console.log('🔍 LanceDB直接クエリでラベル構造を調査');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    // ベクトル検索を使わずに直接データを取得
    console.log('📊 テーブル情報を取得中...');
    
    // テーブルのスキーマを確認
    const schema = table.schema;
    console.log('📋 テーブルスキーマ:');
    console.log(JSON.stringify(schema, null, 2));
    
    // ラベルフィールドの型を確認
    const labelsField = schema.fields.find(field => field.name === 'labels');
    if (labelsField) {
      console.log('\n📋 ラベルフィールドの詳細:');
      console.log(JSON.stringify(labelsField, null, 2));
    }
    
    // サンプルデータを取得（ベクトル検索を使わない方法）
    console.log('\n📊 サンプルデータを取得中...');
    
    // テーブルの行数を確認
    const count = await table.countRows();
    console.log(`📊 総行数: ${count}行`);
    
    // 最初の10行を取得
    const sampleData = await table.take(10);
    console.log(`📊 サンプルデータ取得: ${sampleData.length}行`);
    
    // 各サンプルのラベルを詳細分析
    sampleData.forEach((row, index) => {
      console.log(`\n[サンプル ${index + 1}] ${row.title || 'No Title'}`);
      console.log(`  ラベル生データ: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
      console.log(`  ラベルconstructor: ${row.labels?.constructor?.name}`);
      
      if (Array.isArray(row.labels)) {
        console.log(`  配列長: ${row.labels.length}`);
        row.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
        });
      } else if (typeof row.labels === 'string') {
        console.log(`  文字列長: ${row.labels.length}`);
        console.log(`  文字列内容: "${row.labels}"`);
        
        // JSON解析を試行
        try {
          const parsed = JSON.parse(row.labels);
          console.log(`  JSON解析成功: ${JSON.stringify(parsed)}`);
          console.log(`  解析後型: ${typeof parsed}`);
        } catch (e) {
          console.log(`  JSON解析失敗: ${e.message}`);
        }
      }
    });

    // 議事録関連のデータを検索
    console.log('\n🎯 議事録関連データの検索');
    console.log('=' .repeat(40));
    
    // タイトルに「議事録」が含まれるデータを検索
    const meetingNotesQuery = await table
      .where("title LIKE '%議事録%'")
      .limit(5)
      .toArray();
    
    console.log(`📊 議事録タイトル検索結果: ${meetingNotesQuery.length}件`);
    meetingNotesQuery.forEach((row, index) => {
      console.log(`\n[議事録 ${index + 1}] ${row.title}`);
      console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
    });

    // ラベルに「議事録」が含まれるデータを検索
    const meetingLabelsQuery = await table
      .where("labels LIKE '%議事録%'")
      .limit(5)
      .toArray();
    
    console.log(`\n📊 議事録ラベル検索結果: ${meetingLabelsQuery.length}件`);
    meetingLabelsQuery.forEach((row, index) => {
      console.log(`\n[議事録ラベル ${index + 1}] ${row.title}`);
      console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
investigateLanceDBDirectQuery().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * LanceDB直接クエリでラベル構造を調査
 * ベクトル検索を使わずに直接データを取得
 */

import { lancedbClient } from '../lib/lancedb-client';

async function investigateLanceDBDirectQuery() {
  console.log('🔍 LanceDB直接クエリでラベル構造を調査');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    // ベクトル検索を使わずに直接データを取得
    console.log('📊 テーブル情報を取得中...');
    
    // テーブルのスキーマを確認
    const schema = table.schema;
    console.log('📋 テーブルスキーマ:');
    console.log(JSON.stringify(schema, null, 2));
    
    // ラベルフィールドの型を確認
    const labelsField = schema.fields.find(field => field.name === 'labels');
    if (labelsField) {
      console.log('\n📋 ラベルフィールドの詳細:');
      console.log(JSON.stringify(labelsField, null, 2));
    }
    
    // サンプルデータを取得（ベクトル検索を使わない方法）
    console.log('\n📊 サンプルデータを取得中...');
    
    // テーブルの行数を確認
    const count = await table.countRows();
    console.log(`📊 総行数: ${count}行`);
    
    // 最初の10行を取得
    const sampleData = await table.take(10);
    console.log(`📊 サンプルデータ取得: ${sampleData.length}行`);
    
    // 各サンプルのラベルを詳細分析
    sampleData.forEach((row, index) => {
      console.log(`\n[サンプル ${index + 1}] ${row.title || 'No Title'}`);
      console.log(`  ラベル生データ: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
      console.log(`  ラベルconstructor: ${row.labels?.constructor?.name}`);
      
      if (Array.isArray(row.labels)) {
        console.log(`  配列長: ${row.labels.length}`);
        row.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
        });
      } else if (typeof row.labels === 'string') {
        console.log(`  文字列長: ${row.labels.length}`);
        console.log(`  文字列内容: "${row.labels}"`);
        
        // JSON解析を試行
        try {
          const parsed = JSON.parse(row.labels);
          console.log(`  JSON解析成功: ${JSON.stringify(parsed)}`);
          console.log(`  解析後型: ${typeof parsed}`);
        } catch (e) {
          console.log(`  JSON解析失敗: ${e.message}`);
        }
      }
    });

    // 議事録関連のデータを検索
    console.log('\n🎯 議事録関連データの検索');
    console.log('=' .repeat(40));
    
    // タイトルに「議事録」が含まれるデータを検索
    const meetingNotesQuery = await table
      .where("title LIKE '%議事録%'")
      .limit(5)
      .toArray();
    
    console.log(`📊 議事録タイトル検索結果: ${meetingNotesQuery.length}件`);
    meetingNotesQuery.forEach((row, index) => {
      console.log(`\n[議事録 ${index + 1}] ${row.title}`);
      console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
    });

    // ラベルに「議事録」が含まれるデータを検索
    const meetingLabelsQuery = await table
      .where("labels LIKE '%議事録%'")
      .limit(5)
      .toArray();
    
    console.log(`\n📊 議事録ラベル検索結果: ${meetingLabelsQuery.length}件`);
    meetingLabelsQuery.forEach((row, index) => {
      console.log(`\n[議事録ラベル ${index + 1}] ${row.title}`);
      console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
investigateLanceDBDirectQuery().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
