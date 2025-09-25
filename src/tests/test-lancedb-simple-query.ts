/**
 * LanceDB簡単クエリでラベル構造を調査
 * 基本的な方法でデータを取得
 */

import { lancedbClient } from '../lib/lancedb-client';

async function investigateLanceDBSimpleQuery() {
  console.log('🔍 LanceDB簡単クエリでラベル構造を調査');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    console.log('📊 テーブル情報を取得中...');
    
    // テーブルの基本情報を取得
    console.log(`📊 テーブル名: ${connection.tableName}`);
    
    // 行数を確認
    const count = await table.countRows();
    console.log(`📊 総行数: ${count}行`);
    
    // 最初の5行を取得
    console.log('\n📊 最初の5行を取得中...');
    const sampleData = await table.take(5);
    console.log(`📊 サンプルデータ取得: ${sampleData.length}行`);
    
    // 各サンプルのラベルを詳細分析
    sampleData.forEach((row, index) => {
      console.log(`\n[サンプル ${index + 1}] ${row.title || 'No Title'}`);
      console.log(`  ラベル生データ: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
      
      if (row.labels !== null && row.labels !== undefined) {
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
        } else {
          console.log(`  その他の型: ${typeof row.labels}`);
          console.log(`  値: ${JSON.stringify(row.labels)}`);
        }
      } else {
        console.log(`  ラベル: null/undefined`);
      }
    });

    // 議事録関連のデータを検索
    console.log('\n🎯 議事録関連データの検索');
    console.log('=' .repeat(40));
    
    try {
      // タイトルに「議事録」が含まれるデータを検索
      const meetingNotesQuery = await table
        .where("title LIKE '%議事録%'")
        .limit(3)
        .toArray();
      
      console.log(`📊 議事録タイトル検索結果: ${meetingNotesQuery.length}件`);
      meetingNotesQuery.forEach((row, index) => {
        console.log(`\n[議事録 ${index + 1}] ${row.title}`);
        console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
        console.log(`  ラベル型: ${typeof row.labels}`);
      });
    } catch (error) {
      console.log(`❌ 議事録タイトル検索エラー: ${error.message}`);
    }

    try {
      // ラベルに「議事録」が含まれるデータを検索
      const meetingLabelsQuery = await table
        .where("labels LIKE '%議事録%'")
        .limit(3)
        .toArray();
      
      console.log(`\n📊 議事録ラベル検索結果: ${meetingLabelsQuery.length}件`);
      meetingLabelsQuery.forEach((row, index) => {
        console.log(`\n[議事録ラベル ${index + 1}] ${row.title}`);
        console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
        console.log(`  ラベル型: ${typeof row.labels}`);
      });
    } catch (error) {
      console.log(`❌ 議事録ラベル検索エラー: ${error.message}`);
    }

    // ラベルの型分布を分析
    console.log('\n📊 ラベル型分布分析');
    console.log('=' .repeat(30));
    
    const typeDistribution = sampleData.reduce((acc, row) => {
      const type = typeof row.labels;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}件`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
investigateLanceDBSimpleQuery().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * LanceDB簡単クエリでラベル構造を調査
 * 基本的な方法でデータを取得
 */

import { lancedbClient } from '../lib/lancedb-client';

async function investigateLanceDBSimpleQuery() {
  console.log('🔍 LanceDB簡単クエリでラベル構造を調査');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    console.log('📊 テーブル情報を取得中...');
    
    // テーブルの基本情報を取得
    console.log(`📊 テーブル名: ${connection.tableName}`);
    
    // 行数を確認
    const count = await table.countRows();
    console.log(`📊 総行数: ${count}行`);
    
    // 最初の5行を取得
    console.log('\n📊 最初の5行を取得中...');
    const sampleData = await table.take(5);
    console.log(`📊 サンプルデータ取得: ${sampleData.length}行`);
    
    // 各サンプルのラベルを詳細分析
    sampleData.forEach((row, index) => {
      console.log(`\n[サンプル ${index + 1}] ${row.title || 'No Title'}`);
      console.log(`  ラベル生データ: ${JSON.stringify(row.labels)}`);
      console.log(`  ラベル型: ${typeof row.labels}`);
      
      if (row.labels !== null && row.labels !== undefined) {
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
        } else {
          console.log(`  その他の型: ${typeof row.labels}`);
          console.log(`  値: ${JSON.stringify(row.labels)}`);
        }
      } else {
        console.log(`  ラベル: null/undefined`);
      }
    });

    // 議事録関連のデータを検索
    console.log('\n🎯 議事録関連データの検索');
    console.log('=' .repeat(40));
    
    try {
      // タイトルに「議事録」が含まれるデータを検索
      const meetingNotesQuery = await table
        .where("title LIKE '%議事録%'")
        .limit(3)
        .toArray();
      
      console.log(`📊 議事録タイトル検索結果: ${meetingNotesQuery.length}件`);
      meetingNotesQuery.forEach((row, index) => {
        console.log(`\n[議事録 ${index + 1}] ${row.title}`);
        console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
        console.log(`  ラベル型: ${typeof row.labels}`);
      });
    } catch (error) {
      console.log(`❌ 議事録タイトル検索エラー: ${error.message}`);
    }

    try {
      // ラベルに「議事録」が含まれるデータを検索
      const meetingLabelsQuery = await table
        .where("labels LIKE '%議事録%'")
        .limit(3)
        .toArray();
      
      console.log(`\n📊 議事録ラベル検索結果: ${meetingLabelsQuery.length}件`);
      meetingLabelsQuery.forEach((row, index) => {
        console.log(`\n[議事録ラベル ${index + 1}] ${row.title}`);
        console.log(`  ラベル: ${JSON.stringify(row.labels)}`);
        console.log(`  ラベル型: ${typeof row.labels}`);
      });
    } catch (error) {
      console.log(`❌ 議事録ラベル検索エラー: ${error.message}`);
    }

    // ラベルの型分布を分析
    console.log('\n📊 ラベル型分布分析');
    console.log('=' .repeat(30));
    
    const typeDistribution = sampleData.reduce((acc, row) => {
      const type = typeof row.labels;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}件`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
investigateLanceDBSimpleQuery().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
