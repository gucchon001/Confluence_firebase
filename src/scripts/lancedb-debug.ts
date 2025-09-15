/**
 * LanceDBのデバッグ用スクリプト
 * データの保存形式や検索機能を詳細に確認する
 * Usage: npx tsx src/scripts/lancedb-debug.ts
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  try {
    console.log('=== LanceDB デバッグツール ===');
    
    // 1. LanceDBに接続
    console.log('\n1. LanceDBに接続中...');
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`データベースパス: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // 2. テーブル一覧を取得
    console.log('\n2. テーブル一覧の取得');
    const tableNames = await db.tableNames();
    console.log(`利用可能なテーブル: ${tableNames.join(', ')}`);
    
    const tableName = 'confluence';
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
    
    // 5. サンプルデータの取得
    console.log('\n5. サンプルデータの取得（最初の3件）');
    // ダミーベクトルで検索して最初の3件を取得
    const dummyVector = new Array(768).fill(0);
    const results = await tbl.search(dummyVector).limit(3).execute();
    
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
        console.log(`ID: ${row.id || 'N/A'}`);
        console.log(`タイトル: ${row.title || 'N/A'}`);
        console.log(`スペース: ${row.space_key || 'N/A'}`);
        
        if (row.labels && row.labels.length > 0) {
          console.log(`ラベル: ${row.labels.join(', ')}`);
        }
        
        // ベクトルの統計情報
        if (row.vector && row.vector.length > 0) {
          const vectorStats = calculateVectorStats(row.vector);
          console.log(`ベクトル次元数: ${row.vector.length}`);
          console.log(`ベクトル統計: 平均=${vectorStats.mean.toFixed(6)}, 標準偏差=${vectorStats.stdDev.toFixed(6)}, 最小=${vectorStats.min.toFixed(6)}, 最大=${vectorStats.max.toFixed(6)}`);
          console.log(`ベクトルノルム: ${vectorStats.norm.toFixed(6)}`);
          console.log(`ベクトル先頭5要素: [${row.vector.slice(0, 5).map((v: number) => v.toFixed(6)).join(', ')}]`);
        } else {
          console.log('ベクトルが存在しないか空です。');
        }
      });
    }
    
    // 6. テスト検索の実行
    console.log('\n6. テスト検索の実行');
    const testQueries = ['テスト', 'アカウント', 'ワード', '権限'];
    
    for (const query of testQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      
      // 埋め込みベクトルの生成（ダミー）
      const queryVector = new Array(768).fill(0).map((_, i) => Math.sin(i * 0.1));
      const queryNorm = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0));
      const normalizedQueryVector = queryVector.map(val => val / queryNorm);
      
      console.log('検索実行中...');
      const searchResults = await tbl.search(normalizedQueryVector)
        .limit(5)
        .execute();
      
      // 結果を配列として取得
      const resultArray: any[] = [];
      
      // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
      const searchBatchData = await searchResults.promisedInner;
      
      if (searchBatchData && searchBatchData.batches && searchBatchData.batches.length > 0) {
        for (const batch of searchBatchData.batches) {
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
              
              // 距離スコアを追加
              row._distance = batch.getChild('_distance')?.get(i) || 0;
              resultArray.push(row);
            }
          }
        }
      }
      
      if (resultArray.length === 0) {
        console.log(`"${query}" の検索結果: 0件`);
      } else {
        console.log(`"${query}" の検索結果: ${resultArray.length}件`);
        resultArray.forEach((result, i) => {
          console.log(`\n[結果 ${i + 1}] スコア: ${result._distance?.toFixed(6) || 'N/A'}`);
          console.log(`ID: ${result.id || 'N/A'}`);
          console.log(`タイトル: ${result.title || 'N/A'}`);
        });
      }
    }
    
    // 7. 実際の埋め込みベクトルを生成して検索
    console.log('\n7. 実際の埋め込みベクトルを使用した検索');
    try {
      const { ai } = await import('../ai/genkit');
      const testQuery = 'テスト環境のアカウント';
      console.log(`クエリ: "${testQuery}"`);
      
      console.log('埋め込みベクトル生成中...');
      const out: any = await ai.embed({ embedder: 'googleai/text-embedding-004', content: testQuery });
      const vec = Array.isArray(out) ? out[0].embedding : out.embedding;
      
      // L2正規化
      const norm = Math.sqrt(vec.reduce((sum: number, val: number) => sum + val * val, 0)) || 1;
      const normalizedVec = vec.map((val: number) => val / norm);
      
      console.log(`埋め込みベクトル生成完了 (${normalizedVec.length} 次元)`);
      console.log(`ベクトル先頭5要素: [${normalizedVec.slice(0, 5).map((v: number) => v.toFixed(6)).join(', ')}]`);
      
      console.log('検索実行中...');
      const realSearchResults = await tbl.search(normalizedVec)
        .limit(5)
        .execute();
      
      // 結果を配列として取得
      const realResultArray: any[] = [];
      
      // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
      const realSearchBatchData = await realSearchResults.promisedInner;
      
      if (realSearchBatchData && realSearchBatchData.batches && realSearchBatchData.batches.length > 0) {
        for (const batch of realSearchBatchData.batches) {
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
              
              // 距離スコアを追加
              row._distance = batch.getChild('_distance')?.get(i) || 0;
              realResultArray.push(row);
            }
          }
        }
      }
      
      if (realResultArray.length === 0) {
        console.log(`"${testQuery}" の検索結果: 0件`);
      } else {
        console.log(`"${testQuery}" の検索結果: ${realResultArray.length}件`);
        realResultArray.forEach((result, i) => {
          console.log(`\n[結果 ${i + 1}] スコア: ${result._distance?.toFixed(6) || 'N/A'}`);
          console.log(`ID: ${result.id || 'N/A'}`);
          console.log(`タイトル: ${result.title || 'N/A'}`);
        });
      }
    } catch (error) {
      console.error('実際の埋め込みベクトルを使用した検索でエラーが発生しました:', error);
    }
    
    console.log('\nLanceDBデバッグ完了');
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// ベクトルの統計情報を計算する関数
function calculateVectorStats(vector: number[]) {
  if (!vector || vector.length === 0) {
    return { mean: 0, stdDev: 0, min: 0, max: 0, norm: 0 };
  }
  
  const sum = vector.reduce((acc, val) => acc + val, 0);
  const mean = sum / vector.length;
  
  const squaredDiffs = vector.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / vector.length;
  const stdDev = Math.sqrt(variance);
  
  const min = Math.min(...vector);
  const max = Math.max(...vector);
  
  const squaredSum = vector.reduce((acc, val) => acc + val * val, 0);
  const norm = Math.sqrt(squaredSum);
  
  return { mean, stdDev, min, max, norm };
}

main();