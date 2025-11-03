/**
 * LanceDBのスキーマとデータ構造を詳細に確認するスクリプト
 */

import { optimizedLanceDBClient } from '../src/lib/optimized-lancedb-client';

async function main() {
  console.log('🔍 LanceDBスキーマとデータ構造の確認を開始...\n');

  try {
    const connection = await optimizedLanceDBClient.getConnection();
    const table = connection.table;

    // テーブル情報を取得
    console.log('📊 テーブル情報:');
    console.log(`   テーブル名: ${connection.tableName}`);
    console.log('');

    // スキーマ情報を取得
    const sampleData = await table.query().limit(3).toArrow();
    
    console.log('📋 スキーマ情報:');
    console.log(`   総フィールド数: ${sampleData.schema.fields.length}`);
    console.log('');
    
    console.log('📝 全フィールド一覧:\n');
    sampleData.schema.fields.forEach((field: any, idx: number) => {
      console.log(`${idx + 1}. ${field.name}`);
      console.log(`   型: ${field.type}`);
      console.log(`   nullable: ${field.nullable}`);
      if (field.metadata) {
        console.log(`   metadata: ${JSON.stringify(field.metadata)}`);
      }
      console.log('');
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🔍 サンプルレコードの詳細（最初の3件）:\n');

    for (let i = 0; i < sampleData.numRows; i++) {
      console.log(`━━━━━━ レコード ${i + 1} ━━━━━━`);
      
      for (let j = 0; j < sampleData.schema.fields.length; j++) {
        const field = sampleData.schema.fields[j];
        const column = sampleData.getChildAt(j);
        const value = column?.get(i);
        
        // vectorフィールドは長すぎるのでスキップ
        if (field.name === 'vector') {
          console.log(`${field.name}: [vector data - ${value?.length || 0} dimensions]`);
          continue;
        }
        
        // その他のフィールド
        let displayValue: any;
        
        if (value === null || value === undefined) {
          displayValue = '(null)';
        } else if (typeof value === 'object') {
          // オブジェクト型の場合
          if (Array.isArray(value)) {
            displayValue = `[Array: ${value.length}件] ${JSON.stringify(value)}`;
          } else {
            // Arrow型の場合
            try {
              const jsonValue = JSON.parse(JSON.stringify(value));
              displayValue = `[${value.constructor?.name}] ${JSON.stringify(jsonValue)}`;
            } catch {
              displayValue = `[${value.constructor?.name}] (stringify failed)`;
            }
          }
        } else if (typeof value === 'string' && value.length > 100) {
          displayValue = value.substring(0, 100) + '... (truncated)';
        } else {
          displayValue = value;
        }
        
        console.log(`${field.name}: ${displayValue}`);
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 特にlabelsフィールドに注目
    console.log('🏷️ labelsフィールドの詳細分析:\n');
    
    const labelFieldIndex = sampleData.schema.fields.findIndex((f: any) => f.name === 'labels');
    
    if (labelFieldIndex >= 0) {
      const labelColumn = sampleData.getChildAt(labelFieldIndex);
      const labelField = sampleData.schema.fields[labelFieldIndex];
      
      console.log('📌 labelsフィールド情報:');
      console.log(`   インデックス: ${labelFieldIndex}`);
      console.log(`   型: ${labelField.type}`);
      console.log(`   型詳細: ${JSON.stringify(labelField.type, null, 2)}`);
      console.log('');
      
      // 全レコードのラベル統計
      const allData = await table.query().limit(1000).toArrow();
      const allLabelColumn = allData.getChildAt(labelFieldIndex);
      
      let emptyCount = 0;
      let nonEmptyCount = 0;
      const nonEmptySamples: any[] = [];
      
      for (let i = 0; i < allData.numRows; i++) {
        const labels = allLabelColumn?.get(i);
        
        // 空かどうかを判定
        let isEmpty = true;
        
        if (labels) {
          if (Array.isArray(labels)) {
            isEmpty = labels.length === 0;
          } else if (typeof labels === 'object') {
            try {
              const jsonLabels = JSON.parse(JSON.stringify(labels));
              if (Array.isArray(jsonLabels)) {
                isEmpty = jsonLabels.length === 0;
              } else if (typeof jsonLabels === 'object') {
                isEmpty = Object.keys(jsonLabels).length === 0;
              }
            } catch {
              isEmpty = true;
            }
          }
        }
        
        if (isEmpty) {
          emptyCount++;
        } else {
          nonEmptyCount++;
          
          if (nonEmptySamples.length < 5) {
            const titleColumn = allData.getChildAt(
              allData.schema.fields.findIndex((f: any) => f.name === 'title')
            );
            const title = titleColumn?.get(i) || 'Unknown';
            
            let labelArray: any = labels;
            if (labels && typeof labels === 'object' && !Array.isArray(labels)) {
              try {
                labelArray = JSON.parse(JSON.stringify(labels));
              } catch {
                labelArray = labels;
              }
            }
            
            nonEmptySamples.push({
              title,
              labels: labelArray
            });
          }
        }
      }
      
      console.log('📊 ラベル統計（最初の1000件）:');
      console.log(`   空のラベル: ${emptyCount}件`);
      console.log(`   非空のラベル: ${nonEmptyCount}件`);
      console.log('');
      
      if (nonEmptySamples.length > 0) {
        console.log('📋 ラベルが存在するページのサンプル:\n');
        nonEmptySamples.forEach((sample, idx) => {
          console.log(`${idx + 1}. ${sample.title}`);
          console.log(`   Labels: ${JSON.stringify(sample.labels)}`);
          console.log('');
        });
      } else {
        console.log('⚠️ すべてのページでlabelsが空です！');
      }
    } else {
      console.log('❌ labelsフィールドが見つかりません！');
    }

    console.log('✅ 分析完了');

  } catch (error: any) {
    console.error('❌ エラーが発生しました:', error.message);
    console.error(error.stack);
  } finally {
    await optimizedLanceDBClient.resetConnection();
    process.exit(0);
  }
}

main();

