/**
 * 特定ページIDのラベルデータ詳細分析
 * ページID 703561854 のラベル格納形式を詳しく調査
 */

import { lancedbClient } from '../lib/lancedb-client';

async function analyzeSpecificPageLabels() {
  console.log('🔍 ページID 703561854 のラベル詳細分析');
  console.log('=' .repeat(60));

  const targetPageId = 703561854;

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    console.log(`📊 対象ページID: ${targetPageId}`);
    console.log(`📊 テーブル名: ${connection.tableName}`);
    
    // 特定ページIDのデータを検索
    console.log('\n📊 ページID検索実行中...');
    
    try {
      // ページIDで検索
      const pageResults = await table
        .where(`pageId = ${targetPageId}`)
        .toArray();
      
      console.log(`📊 検索結果数: ${pageResults.length}件`);
      
      if (pageResults.length === 0) {
        console.log('❌ 指定されたページIDのデータが見つかりません');
        
        // 近いページIDを検索
        console.log('\n🔍 近いページIDを検索中...');
        const nearbyResults = await table
          .where(`pageId >= ${targetPageId - 100} AND pageId <= ${targetPageId + 100}`)
          .limit(10)
          .toArray();
        
        console.log(`📊 近いページID検索結果: ${nearbyResults.length}件`);
        nearbyResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ページID: ${result.pageId}, タイトル: ${result.title}`);
        });
        
        return;
      }
      
      // 各結果のラベルを詳細分析
      pageResults.forEach((result, index) => {
        console.log(`\n[結果 ${index + 1}] ページID: ${result.pageId}`);
        console.log(`  タイトル: ${result.title}`);
        console.log(`  チャンクインデックス: ${result.chunkIndex}`);
        console.log(`  ラベル生データ: ${JSON.stringify(result.labels)}`);
        console.log(`  ラベル型: ${typeof result.labels}`);
        console.log(`  ラベルconstructor: ${result.labels?.constructor?.name}`);
        
        if (result.labels !== null && result.labels !== undefined) {
          if (Array.isArray(result.labels)) {
            console.log(`  配列長: ${result.labels.length}`);
            result.labels.forEach((label, i) => {
              console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
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
                parsed.forEach((item, i) => {
                  console.log(`    [${i}]: ${JSON.stringify(item)} (型: ${typeof item})`);
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

    } catch (error) {
      console.error(`❌ ページID検索エラー: ${error.message}`);
      
      // 別の方法で検索を試行
      console.log('\n🔍 別の方法で検索を試行中...');
      try {
        const allResults = await table
          .where(`pageId = ${targetPageId}`)
          .limit(5)
          .toArray();
        
        console.log(`📊 別方法検索結果: ${allResults.length}件`);
        allResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ページID: ${result.pageId}, タイトル: ${result.title}`);
        });
      } catch (e) {
        console.error(`❌ 別方法検索もエラー: ${e.message}`);
      }
    }

    // ラベルが空でない他のページを検索して比較
    console.log('\n🔍 ラベルが空でない他のページを検索中...');
    try {
      const nonEmptyLabelResults = await table
        .where(`labels IS NOT NULL AND labels != '[]' AND labels != 'null'`)
        .limit(5)
        .toArray();
      
      console.log(`📊 ラベルが空でないページ: ${nonEmptyLabelResults.length}件`);
      nonEmptyLabelResults.forEach((result, index) => {
        console.log(`\n[比較 ${index + 1}] ページID: ${result.pageId}`);
        console.log(`  タイトル: ${result.title}`);
        console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
        console.log(`  ラベル型: ${typeof result.labels}`);
      });
    } catch (error) {
      console.error(`❌ ラベル検索エラー: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
analyzeSpecificPageLabels().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
 * 特定ページIDのラベルデータ詳細分析
 * ページID 703561854 のラベル格納形式を詳しく調査
 */

import { lancedbClient } from '../lib/lancedb-client';

async function analyzeSpecificPageLabels() {
  console.log('🔍 ページID 703561854 のラベル詳細分析');
  console.log('=' .repeat(60));

  const targetPageId = 703561854;

  try {
    const connection = await lancedbClient.getConnection();
    const table = connection.table;
    
    console.log(`📊 対象ページID: ${targetPageId}`);
    console.log(`📊 テーブル名: ${connection.tableName}`);
    
    // 特定ページIDのデータを検索
    console.log('\n📊 ページID検索実行中...');
    
    try {
      // ページIDで検索
      const pageResults = await table
        .where(`pageId = ${targetPageId}`)
        .toArray();
      
      console.log(`📊 検索結果数: ${pageResults.length}件`);
      
      if (pageResults.length === 0) {
        console.log('❌ 指定されたページIDのデータが見つかりません');
        
        // 近いページIDを検索
        console.log('\n🔍 近いページIDを検索中...');
        const nearbyResults = await table
          .where(`pageId >= ${targetPageId - 100} AND pageId <= ${targetPageId + 100}`)
          .limit(10)
          .toArray();
        
        console.log(`📊 近いページID検索結果: ${nearbyResults.length}件`);
        nearbyResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ページID: ${result.pageId}, タイトル: ${result.title}`);
        });
        
        return;
      }
      
      // 各結果のラベルを詳細分析
      pageResults.forEach((result, index) => {
        console.log(`\n[結果 ${index + 1}] ページID: ${result.pageId}`);
        console.log(`  タイトル: ${result.title}`);
        console.log(`  チャンクインデックス: ${result.chunkIndex}`);
        console.log(`  ラベル生データ: ${JSON.stringify(result.labels)}`);
        console.log(`  ラベル型: ${typeof result.labels}`);
        console.log(`  ラベルconstructor: ${result.labels?.constructor?.name}`);
        
        if (result.labels !== null && result.labels !== undefined) {
          if (Array.isArray(result.labels)) {
            console.log(`  配列長: ${result.labels.length}`);
            result.labels.forEach((label, i) => {
              console.log(`    [${i}]: ${JSON.stringify(label)} (型: ${typeof label})`);
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
                parsed.forEach((item, i) => {
                  console.log(`    [${i}]: ${JSON.stringify(item)} (型: ${typeof item})`);
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

    } catch (error) {
      console.error(`❌ ページID検索エラー: ${error.message}`);
      
      // 別の方法で検索を試行
      console.log('\n🔍 別の方法で検索を試行中...');
      try {
        const allResults = await table
          .where(`pageId = ${targetPageId}`)
          .limit(5)
          .toArray();
        
        console.log(`📊 別方法検索結果: ${allResults.length}件`);
        allResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ページID: ${result.pageId}, タイトル: ${result.title}`);
        });
      } catch (e) {
        console.error(`❌ 別方法検索もエラー: ${e.message}`);
      }
    }

    // ラベルが空でない他のページを検索して比較
    console.log('\n🔍 ラベルが空でない他のページを検索中...');
    try {
      const nonEmptyLabelResults = await table
        .where(`labels IS NOT NULL AND labels != '[]' AND labels != 'null'`)
        .limit(5)
        .toArray();
      
      console.log(`📊 ラベルが空でないページ: ${nonEmptyLabelResults.length}件`);
      nonEmptyLabelResults.forEach((result, index) => {
        console.log(`\n[比較 ${index + 1}] ページID: ${result.pageId}`);
        console.log(`  タイトル: ${result.title}`);
        console.log(`  ラベル: ${JSON.stringify(result.labels)}`);
        console.log(`  ラベル型: ${typeof result.labels}`);
      });
    } catch (error) {
      console.error(`❌ ラベル検索エラー: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
    console.error('エラー詳細:', error.stack);
  }
}

// テスト実行
analyzeSpecificPageLabels().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
