/**
 * LanceDBラベル格納形式の詳細調査
 * 実際のデータベースからラベルの構造を詳しく分析
 */

import { lancedbClient } from '../lib/lancedb-client';

async function investigateLanceDBLabelStructure() {
  console.log('🔍 LanceDBラベル格納形式の詳細調査');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    // より多くのサンプルを取得
    const results = await table.search().limit(20).toArray();
    
    console.log(`📊 取得した結果数: ${results.length}件`);
    console.log(`📊 テーブル名: ${connection.tableName}`);
    
    // ラベルを持つ結果を特定
    const resultsWithLabels = results.filter(result => 
      result.labels && 
      result.labels !== null && 
      result.labels !== undefined &&
      (Array.isArray(result.labels) ? result.labels.length > 0 : true)
    );
    
    console.log(`\n📊 ラベルを持つ結果: ${resultsWithLabels.length}件`);
    
    // 各結果のラベル構造を詳細分析
    resultsWithLabels.forEach((result, index) => {
      console.log(`\n[結果 ${index + 1}] ${result.title}`);
      console.log(`  ラベル生データ: ${JSON.stringify(result.labels)}`);
      console.log(`  ラベル型: ${typeof result.labels}`);
      console.log(`  ラベルconstructor: ${result.labels?.constructor?.name}`);
      
      if (Array.isArray(result.labels)) {
        console.log(`  配列長: ${result.labels.length}`);
        result.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
          if (typeof label === 'object') {
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
          }
        } catch (e) {
          console.log(`  JSON解析失敗: ${e.message}`);
        }
      } else if (typeof result.labels === 'object' && result.labels !== null) {
        console.log(`  オブジェクト型: ${typeof result.labels}`);
        console.log(`  オブジェクトkeys: ${Object.keys(result.labels)}`);
        console.log(`  オブジェクトvalues: ${Object.values(result.labels)}`);
      }
    });

    // 議事録・フォルダ関連の結果を特定
    console.log('\n🎯 議事録・フォルダ関連の結果を特定');
    console.log('=' .repeat(50));
    
    const meetingRelatedResults = results.filter(result => {
      const title = result.title || '';
      const labels = result.labels;
      
      const titleContainsMeeting = title.includes('議事録') || 
                                 title.includes('meeting') || 
                                 title.includes('ミーティング');
      
      let labelsContainMeeting = false;
      if (labels) {
        if (Array.isArray(labels)) {
          labelsContainMeeting = labels.some(label => 
            String(label).toLowerCase().includes('議事録') ||
            String(label).toLowerCase().includes('meeting')
          );
        } else if (typeof labels === 'string') {
          labelsContainMeeting = labels.toLowerCase().includes('議事録') ||
                                labels.toLowerCase().includes('meeting');
        }
      }
      
      return titleContainsMeeting || labelsContainMeeting;
    });

    console.log(`📊 議事録・フォルダ関連結果: ${meetingRelatedResults.length}件`);
    
    meetingRelatedResults.forEach((result, index) => {
      console.log(`\n[議事録関連 ${index + 1}] ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`  ラベル型: ${typeof result.labels}`);
    });

    // ラベルの型分布を分析
    console.log('\n📊 ラベル型分布分析');
    console.log('=' .repeat(30));
    
    const typeDistribution = results.reduce((acc, result) => {
      const type = typeof result.labels;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}件`);
    });

    // 空のラベルを持つ結果
    const emptyLabelResults = results.filter(result => 
      !result.labels || 
      (Array.isArray(result.labels) && result.labels.length === 0) ||
      (typeof result.labels === 'string' && result.labels.trim() === '')
    );
    
    console.log(`\n📊 空のラベルを持つ結果: ${emptyLabelResults.length}件`);
    
    // 空ラベル結果のタイトルを表示
    emptyLabelResults.slice(0, 5).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// テスト実行
investigateLanceDBLabelStructure().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * LanceDBラベル格納形式の詳細調査
 * 実際のデータベースからラベルの構造を詳しく分析
 */

import { lancedbClient } from '../lib/lancedb-client';

async function investigateLanceDBLabelStructure() {
  console.log('🔍 LanceDBラベル格納形式の詳細調査');
  console.log('=' .repeat(60));

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    // より多くのサンプルを取得
    const results = await table.search().limit(20).toArray();
    
    console.log(`📊 取得した結果数: ${results.length}件`);
    console.log(`📊 テーブル名: ${connection.tableName}`);
    
    // ラベルを持つ結果を特定
    const resultsWithLabels = results.filter(result => 
      result.labels && 
      result.labels !== null && 
      result.labels !== undefined &&
      (Array.isArray(result.labels) ? result.labels.length > 0 : true)
    );
    
    console.log(`\n📊 ラベルを持つ結果: ${resultsWithLabels.length}件`);
    
    // 各結果のラベル構造を詳細分析
    resultsWithLabels.forEach((result, index) => {
      console.log(`\n[結果 ${index + 1}] ${result.title}`);
      console.log(`  ラベル生データ: ${JSON.stringify(result.labels)}`);
      console.log(`  ラベル型: ${typeof result.labels}`);
      console.log(`  ラベルconstructor: ${result.labels?.constructor?.name}`);
      
      if (Array.isArray(result.labels)) {
        console.log(`  配列長: ${result.labels.length}`);
        result.labels.forEach((label, i) => {
          console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
          if (typeof label === 'object') {
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
          }
        } catch (e) {
          console.log(`  JSON解析失敗: ${e.message}`);
        }
      } else if (typeof result.labels === 'object' && result.labels !== null) {
        console.log(`  オブジェクト型: ${typeof result.labels}`);
        console.log(`  オブジェクトkeys: ${Object.keys(result.labels)}`);
        console.log(`  オブジェクトvalues: ${Object.values(result.labels)}`);
      }
    });

    // 議事録・フォルダ関連の結果を特定
    console.log('\n🎯 議事録・フォルダ関連の結果を特定');
    console.log('=' .repeat(50));
    
    const meetingRelatedResults = results.filter(result => {
      const title = result.title || '';
      const labels = result.labels;
      
      const titleContainsMeeting = title.includes('議事録') || 
                                 title.includes('meeting') || 
                                 title.includes('ミーティング');
      
      let labelsContainMeeting = false;
      if (labels) {
        if (Array.isArray(labels)) {
          labelsContainMeeting = labels.some(label => 
            String(label).toLowerCase().includes('議事録') ||
            String(label).toLowerCase().includes('meeting')
          );
        } else if (typeof labels === 'string') {
          labelsContainMeeting = labels.toLowerCase().includes('議事録') ||
                                labels.toLowerCase().includes('meeting');
        }
      }
      
      return titleContainsMeeting || labelsContainMeeting;
    });

    console.log(`📊 議事録・フォルダ関連結果: ${meetingRelatedResults.length}件`);
    
    meetingRelatedResults.forEach((result, index) => {
      console.log(`\n[議事録関連 ${index + 1}] ${result.title}`);
      console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
      console.log(`  ラベル型: ${typeof result.labels}`);
    });

    // ラベルの型分布を分析
    console.log('\n📊 ラベル型分布分析');
    console.log('=' .repeat(30));
    
    const typeDistribution = results.reduce((acc, result) => {
      const type = typeof result.labels;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(typeDistribution).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}件`);
    });

    // 空のラベルを持つ結果
    const emptyLabelResults = results.filter(result => 
      !result.labels || 
      (Array.isArray(result.labels) && result.labels.length === 0) ||
      (typeof result.labels === 'string' && result.labels.trim() === '')
    );
    
    console.log(`\n📊 空のラベルを持つ結果: ${emptyLabelResults.length}件`);
    
    // 空ラベル結果のタイトルを表示
    emptyLabelResults.slice(0, 5).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// テスト実行
investigateLanceDBLabelStructure().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
