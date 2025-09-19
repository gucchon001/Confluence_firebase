/**
 * LanceDBのテーブル構造を確認するスクリプト
 * Usage: npx tsx src/scripts/lancedb-check-table.ts [テーブル名]
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  try {
    const tableName = process.argv[2] || 'confluence';
    
    console.log(`=== LanceDBテーブル '${tableName}' の構造確認 ===`);
    
    // 1. LanceDBに接続
    console.log('\n1. LanceDBに接続中...');
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`データベースパス: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // 2. テーブル一覧を取得
    console.log('\n2. テーブル一覧の取得');
    const tableNames = await db.tableNames();
    console.log(`利用可能なテーブル: ${tableNames.join(', ')}`);
    
    if (!tableNames.includes(tableName)) {
      console.error(`テーブル '${tableName}' が存在しません。`);
      process.exit(1);
    }
    
    // 3. テーブルを開く
    console.log(`\n3. テーブル '${tableName}' を開く`);
    const tbl = await db.openTable(tableName);
    
    // 4. テーブル情報を表示
    console.log('\n4. テーブル情報');
    const schema = await tbl.schema();
    console.log('スキーマ:');
    console.log(JSON.stringify(schema, null, 2));
    
    const rowCount = await tbl.countRows();
    console.log(`行数: ${rowCount}`);
    
    // 5. フィルタリングの確認
    console.log('\n5. フィルタリングのテスト');
    
    // 利用可能なフィールドの一覧を取得
    const fields = schema.fields.map(field => field.name);
    console.log(`利用可能なフィールド: ${fields.join(', ')}`);
    
    // テキストフィールドを特定
    const textFields = schema.fields
      .filter(field => field.type.typeId === 5) // 5はStringのtypeId
      .map(field => field.name);
    
    console.log(`テキストフィールド: ${textFields.join(', ')}`);
    
    // ベクトルフィールドを特定
    const vectorFields = schema.fields
      .filter(field => field.type.typeId === 16) // 16はListのtypeId
      .map(field => field.name);
    
    console.log(`ベクトルフィールド: ${vectorFields.join(', ')}`);
    
    // ベクトルの次元数を特定
    const vectorDimensions: Record<string, number> = {};
    for (const field of schema.fields) {
      if (field.type.typeId === 16 && field.type.listSize) {
        vectorDimensions[field.name] = field.type.listSize;
      }
    }
    
    console.log('ベクトルの次元数:');
    for (const [field, dim] of Object.entries(vectorDimensions)) {
      console.log(`  ${field}: ${dim}次元`);
    }
    
    // 6. サンプルデータの取得
    console.log('\n6. サンプルデータの取得（最初の1件）');
    
    try {
      // ベクトルの次元数に合わせてダミーベクトルを作成
      const vectorField = vectorFields[0]; // 最初のベクトルフィールド
      const vectorDim = vectorDimensions[vectorField] || 10;
      const dummyVector = new Array(vectorDim).fill(0);
      
      console.log(`${vectorDim}次元のダミーベクトルを使用して検索します。`);
      const results = await tbl.search(dummyVector).limit(1).toArray();
      
      // 結果を配列として取得
      const sampleData: any[] = [];
      
      // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
      const batchData = await results.promisedInner;
      
      if (batchData && batchData.batches && batchData.batches.length > 0) {
        for (const batch of batchData.batches) {
          if (batch && batch.numRows > 0) {
            // バッチから行データを抽出
            for (let i = 0; i < batch.numRows; i++) {
              const row: any = {};
              
              // 各列のデータを取得
              for (const fieldName in batch.schema.fields) {
                if (Object.prototype.hasOwnProperty.call(batch.schema.fields, fieldName)) {
                  const field = batch.schema.fields[fieldName];
                  if (field && field.name) {
                    row[field.name] = batch.getChild(field.name)?.get(i);
                  }
                }
              }
              
              sampleData.push(row);
            }
          }
        }
      }
      
      if (sampleData.length === 0) {
        console.log('サンプルデータを取得できませんでした。');
      } else {
        sampleData.forEach((row, i) => {
          console.log(`\n[サンプル ${i + 1}]`);
          
          // 各フィールドの値を表示
          for (const fieldName of fields) {
            if (fieldName === 'vector') {
              // ベクトルは長いので先頭5要素だけ表示
              if (row.vector && row.vector.length > 0) {
                const vectorPreview = row.vector.slice(0, 5).map((v: number) => v.toFixed(6)).join(', ');
                console.log(`${fieldName}: [${vectorPreview}, ...] (${row.vector.length}次元)`);
              } else {
                console.log(`${fieldName}: なし`);
              }
            } else if (Array.isArray(row[fieldName])) {
              // 配列の場合
              console.log(`${fieldName}: [${row[fieldName].join(', ')}]`);
            } else {
              // その他の値
              console.log(`${fieldName}: ${row[fieldName] || 'なし'}`);
            }
          }
        });
      }
    } catch (error) {
      console.error('サンプルデータの取得中にエラーが発生しました:', error);
    }
    
    // 7. フィルタリングのテスト
    console.log('\n7. フィルタリングのテスト');
    
    try {
      // テキストフィールドでフィルタリング
      for (const field of textFields) {
        if (field !== 'id') {
          console.log(`\n${field}フィールドでのフィルタリングをテスト:`);
          
          // ベクトルの次元数に合わせてダミーベクトルを作成
          const vectorField = vectorFields[0]; // 最初のベクトルフィールド
          const vectorDim = vectorDimensions[vectorField] || 10;
          const dummyVector = new Array(vectorDim).fill(0);
          
          try {
            // 空でない値を持つレコードを検索
            const filterResults = await tbl.search(dummyVector)
              .where(`${field} IS NOT NULL`)
              .limit(3)
              .execute();
            
            // 結果を配列として取得
            const filterArray: any[] = [];
            
            // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
            const filterBatchData = await filterResults.promisedInner;
            
            if (filterBatchData && filterBatchData.batches && filterBatchData.batches.length > 0) {
              for (const batch of filterBatchData.batches) {
                if (batch && batch.numRows > 0) {
                  // バッチから行データを抽出
                  for (let i = 0; i < batch.numRows; i++) {
                    const row: any = {};
                    
                    // 各列のデータを取得
                    for (const fieldName in batch.schema.fields) {
                      if (Object.prototype.hasOwnProperty.call(batch.schema.fields, fieldName)) {
                        const field = batch.schema.fields[fieldName];
                        if (field && field.name) {
                          row[field.name] = batch.getChild(field.name)?.get(i);
                        }
                      }
                    }
                    
                    filterArray.push(row);
                  }
                }
              }
            }
            
            if (filterArray.length === 0) {
              console.log(`  ${field} IS NOT NULL の検索結果: 0件`);
            } else {
              console.log(`  ${field} IS NOT NULL の検索結果: ${filterArray.length}件`);
              filterArray.forEach((result, i) => {
                console.log(`    [${i + 1}] ${field}: ${result[field] || 'なし'}`);
              });
            }
          } catch (error) {
            console.error(`  ${field}フィールドでのフィルタリング中にエラーが発生しました:`, error);
          }
        }
      }
    } catch (error) {
      console.error('フィルタリングのテスト中にエラーが発生しました:', error);
    }
    
    console.log('\nLanceDBテーブル構造確認完了');
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();