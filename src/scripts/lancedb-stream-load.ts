/**
 * LanceDBストリーム処理によるデータロードスクリプト
 * 大規模なJSONL/JSONファイルをストリーム処理してLanceDBに保存します
 * 
 * 使用方法:
 * npx tsx src/scripts/lancedb-stream-load.ts <ファイルパス> [--batch-size <バッチサイズ>] [--table <テーブル名>]
 * 
 * 例:
 * npx tsx src/scripts/lancedb-stream-load.ts data/embeddings-large.jsonl --batch-size 100 --table my_vectors
 */

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import * as minimist from 'minimist';

interface VectorRecord {
  id: string;
  vector?: number[];
  embedding?: number[];
  featureVector?: number[];
  [key: string]: any;
}

async function main() {
  // コマンドライン引数の解析
  const argv = minimist.default(process.argv.slice(2));
  const filePath = argv._[0];
  const batchSize = argv['batch-size'] || 100;
  const tableName = argv.table || 'confluence';
  
  if (!filePath) {
    console.error('ファイルパスを指定してください。');
    console.error('使用方法: npx tsx src/scripts/lancedb-stream-load.ts <ファイルパス> [--batch-size <バッチサイズ>] [--table <テーブル名>]');
    process.exit(1);
  }
  
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) {
    console.error(`ファイル '${absolutePath}' が存在しません。`);
    process.exit(1);
  }
  
  console.log(`=== LanceDBストリーム処理によるデータロード ===`);
  console.log(`ファイル: ${absolutePath}`);
  console.log(`テーブル: ${tableName}`);
  console.log(`バッチサイズ: ${batchSize}`);
  
  try {
    // LanceDBに接続
    console.log('\nLanceDBに接続中...');
    const dbPath = path.resolve('.lancedb');
    const db = await lancedb.connect(dbPath);
    
    // テーブルの存在確認
    const tableExists = (await db.tableNames()).includes(tableName);
    let tbl;
    
    if (tableExists) {
      console.log(`テーブル '${tableName}' が存在します。開きます...`);
      tbl = await db.openTable(tableName);
      const rowCount = await tbl.countRows();
      console.log(`テーブルには現在 ${rowCount} 行のデータがあります。`);
    } else {
      console.log(`テーブル '${tableName}' が存在しません。ファイルを読み込んで新規作成します...`);
    }
    
    // ファイルの種類を判定（JSONL or JSON）
    const fileContent = fs.readFileSync(absolutePath, 'utf8').trim();
    const isJsonArray = fileContent.startsWith('[') && fileContent.endsWith(']');
    
    if (isJsonArray) {
      // JSONファイルの場合
      console.log('JSONファイルを処理します...');
      await processJsonFile(absolutePath, db, tableName, batchSize);
    } else {
      // JSONLファイルの場合
      console.log('JSONLファイルをストリーム処理します...');
      await processJsonlFileWithStream(absolutePath, db, tableName, batchSize);
    }
    
    // 処理完了後のテーブル情報を表示
    if ((await db.tableNames()).includes(tableName)) {
      tbl = await db.openTable(tableName);
      const finalRowCount = await tbl.countRows();
      console.log(`\n処理が完了しました。テーブル '${tableName}' には ${finalRowCount} 行のデータがあります。`);
      
      // テーブルの最適化
      try {
        console.log('\nテーブルを最適化中...');
        // compact_filesメソッドが存在するか確認
        if (typeof tbl.compact_files === 'function') {
          await tbl.compact_files();
          console.log('テーブルの最適化が完了しました。');
        } else {
          console.log('このバージョンのLanceDBはcompact_filesメソッドをサポートしていません。');
        }
      } catch (error) {
        console.error('テーブルの最適化中にエラーが発生しました:', error);
      }
    } else {
      console.log('\n処理が完了しましたが、テーブルの作成に失敗しました。');
    }
    
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * JSONファイルを処理する関数
 */
async function processJsonFile(filePath: string, db: any, tableName: string, batchSize: number): Promise<void> {
  try {
    // ファイルを読み込む
    console.log('JSONファイルを読み込み中...');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let data: VectorRecord[];
    
    try {
      data = JSON.parse(fileContent);
    } catch (error) {
      console.error('JSONの解析に失敗しました:', error);
      return;
    }
    
    if (!Array.isArray(data)) {
      console.error('JSONファイルが配列形式ではありません。');
      return;
    }
    
    console.log(`${data.length}件のレコードを読み込みました。`);
    
    // データを正規化
    const normalizedData = data.map(record => normalizeVectorRecord(record));
    
    // バッチ処理でデータを挿入
    await processDataInBatches(normalizedData, db, tableName, batchSize);
    
  } catch (error) {
    console.error('JSONファイルの処理中にエラーが発生しました:', error);
  }
}

/**
 * JSONLファイルをストリーム処理する関数
 */
async function processJsonlFileWithStream(filePath: string, db: any, tableName: string, batchSize: number): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // ファイルストリームを作成
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      let batch: VectorRecord[] = [];
      let totalProcessed = 0;
      let batchCount = 0;
      let tableCreated = false;
      
      // 各行を処理
      rl.on('line', async (line) => {
        try {
          // 空行をスキップ
          if (!line.trim()) return;
          
          // JSONを解析
          const record = JSON.parse(line) as VectorRecord;
          
          // ベクトルフィールドを正規化
          const normalizedRecord = normalizeVectorRecord(record);
          
          // バッチに追加
          batch.push(normalizedRecord);
          totalProcessed++;
          
          // バッチサイズに達したら処理
          if (batch.length >= batchSize) {
            // 一時的に読み込みを停止
            rl.pause();
            
            try {
              // 最初のバッチの場合はテーブルを作成
              if (!tableCreated && !(await db.tableNames()).includes(tableName)) {
                console.log(`テーブル '${tableName}' を作成中...`);
                
                // サンプルデータでスキーマを作成
                const sampleData = [{
                  id: 'sample-1',
                  vector: new Array(batch[0].vector?.length || 10).fill(0.1),
                  space_key: 'SAMPLE',
                  title: 'サンプルデータ',
                  labels: ['サンプル'],
                  content: 'これはサンプルデータです。',
                  pageId: 'sample-page-1',
                  chunkIndex: 0,
                  url: 'https://example.com',
                  lastUpdated: new Date().toISOString()
                }];
                
                await db.createTable(tableName, sampleData);
                tableCreated = true;
                
                // サンプルデータを削除
                const tbl = await db.openTable(tableName);
                await tbl.delete("id = 'sample-1'");
              }
              
              // 既存のテーブルにデータを追加
              const tbl = await db.openTable(tableName);
              await tbl.add(batch);
              
              batchCount++;
              console.log(`バッチ ${batchCount} (${totalProcessed}件) を処理しました。`);
              
              // バッチをクリア
              batch = [];
              
              // メモリを解放
              if (global.gc) {
                global.gc();
              }
            } catch (error) {
              console.error(`バッチ ${batchCount + 1} の処理中にエラーが発生しました:`, error);
            }
            
            // 読み込みを再開
            rl.resume();
          }
        } catch (error) {
          console.error('行の処理中にエラーが発生しました:', error);
        }
      });
      
      // ファイル読み込み完了時の処理
      rl.on('close', async () => {
        try {
          // 残りのバッチを処理
          if (batch.length > 0) {
            if (!tableCreated && !(await db.tableNames()).includes(tableName)) {
              console.log(`テーブル '${tableName}' を作成中...`);
              
              // サンプルデータでスキーマを作成
              const sampleData = [{
                id: 'sample-1',
                vector: new Array(batch[0].vector?.length || 10).fill(0.1),
                space_key: 'SAMPLE',
                title: 'サンプルデータ',
                labels: ['サンプル'],
                content: 'これはサンプルデータです。',
                pageId: 'sample-page-1',
                chunkIndex: 0,
                url: 'https://example.com',
                lastUpdated: new Date().toISOString()
              }];
              
              await db.createTable(tableName, sampleData);
              tableCreated = true;
              
              // サンプルデータを削除
              const tbl = await db.openTable(tableName);
              await tbl.delete("id = 'sample-1'");
            }
            
            const tbl = await db.openTable(tableName);
            await tbl.add(batch);
            
            batchCount++;
            console.log(`最終バッチ ${batchCount} (合計 ${totalProcessed}件) を処理しました。`);
          }
          
          console.log(`\n合計 ${totalProcessed} 件のレコードを処理しました。`);
          resolve();
        } catch (error) {
          console.error('最終バッチの処理中にエラーが発生しました:', error);
          reject(error);
        }
      });
      
      // エラー処理
      rl.on('error', (error) => {
        console.error('ファイルの読み込み中にエラーが発生しました:', error);
        reject(error);
      });
      
    } catch (error) {
      console.error('JSONLファイルのストリーム処理中にエラーが発生しました:', error);
      reject(error);
    }
  });
}

/**
 * データをバッチ処理する関数
 */
async function processDataInBatches(data: VectorRecord[], db: any, tableName: string, batchSize: number): Promise<void> {
  // バッチ数を計算
  const batchCount = Math.ceil(data.length / batchSize);
  console.log(`${data.length}件のデータを${batchCount}バッチに分けて処理します。`);
  
  let tableCreated = false;
  
  // バッチ処理
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    
    console.log(`バッチ ${batchNumber}/${batchCount} を処理中...`);
    
    try {
      // 最初のバッチの場合はテーブルを作成
      if (!tableCreated && !(await db.tableNames()).includes(tableName)) {
        console.log(`テーブル '${tableName}' を作成中...`);
        
        // サンプルデータでスキーマを作成
        const sampleData = [{
          id: 'sample-1',
          vector: new Array(batch[0].vector?.length || 10).fill(0.1),
          space_key: 'SAMPLE',
          title: 'サンプルデータ',
          labels: ['サンプル'],
          content: 'これはサンプルデータです。',
          pageId: 'sample-page-1',
          chunkIndex: 0,
          url: 'https://example.com',
          lastUpdated: new Date().toISOString()
        }];
        
        await db.createTable(tableName, sampleData);
        tableCreated = true;
        
        // サンプルデータを削除
        const tbl = await db.openTable(tableName);
        await tbl.delete("id = 'sample-1'");
      }
      
      // 既存のテーブルにデータを追加
      const tbl = await db.openTable(tableName);
      await tbl.add(batch);
      
      console.log(`バッチ ${batchNumber} の処理が完了しました。`);
    } catch (error) {
      console.error(`バッチ ${batchNumber} の処理中にエラーが発生しました:`, error);
    }
    
    // メモリを解放
    if (global.gc) {
      global.gc();
    }
  }
}

/**
 * ベクトルレコードを正規化する関数
 */
function normalizeVectorRecord(record: VectorRecord): VectorRecord {
  const normalizedRecord: VectorRecord = { ...record };
  
  // IDがない場合は生成
  if (!normalizedRecord.id) {
    normalizedRecord.id = `record-${Math.random().toString(36).substring(2, 15)}`;
  }
  
  // ベクトルフィールドを正規化
  const vector = normalizedRecord.vector || normalizedRecord.embedding || normalizedRecord.featureVector;
  if (vector) {
    normalizedRecord.vector = vector;
    
    // 重複を避けるために他のベクトルフィールドを削除
    if (normalizedRecord.embedding && normalizedRecord.vector !== normalizedRecord.embedding) {
      delete normalizedRecord.embedding;
    }
    if (normalizedRecord.featureVector && normalizedRecord.vector !== normalizedRecord.featureVector) {
      delete normalizedRecord.featureVector;
    }
  }
  
  // 必須フィールドを確保
  normalizedRecord.space_key = normalizedRecord.space_key || 'unknown';
  normalizedRecord.title = normalizedRecord.title || '';
  normalizedRecord.labels = normalizedRecord.labels || [];
  normalizedRecord.content = normalizedRecord.content || '';
  normalizedRecord.pageId = normalizedRecord.pageId || '';
  normalizedRecord.chunkIndex = normalizedRecord.chunkIndex || 0;
  normalizedRecord.url = normalizedRecord.url || '';
  normalizedRecord.lastUpdated = normalizedRecord.lastUpdated || new Date().toISOString();
  
  return normalizedRecord;
}

// スクリプトの実行
if (require.main === module) {
  main().catch(error => {
    console.error('スクリプトの実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}