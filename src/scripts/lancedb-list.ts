/**
 * LanceDBのテーブル一覧とデータを表示するスクリプト
 * Usage: npx tsx src/scripts/lancedb-list.ts --table <tableName> --limit <number>
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  let tableName = '';
  let limit = 10;

  // 引数を解析
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--table' && i + 1 < args.length) {
      tableName = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  try {
    // LanceDBに接続
    console.log('LanceDBに接続中...');
    const dbPath = path.resolve('.lancedb');
    const db = await lancedb.connect(dbPath);
    
    // テーブル一覧を取得
    const tableNames = await db.tableNames();
    console.log('利用可能なテーブル:', tableNames.join(', '));
    
    // 特定のテーブルが指定されている場合
    if (tableName) {
      if (!tableNames.includes(tableName)) {
        console.error(`エラー: テーブル '${tableName}' が存在しません。`);
        process.exit(1);
      }
      
      // テーブルを開く
      const tbl = await db.openTable(tableName);
      console.log(`テーブル '${tableName}' を開きました`);
      
      // テーブルのスキーマを表示
      if (tbl.schema) {
        console.log('テーブルスキーマ:', JSON.stringify(tbl.schema, null, 2));
      } else {
        console.log('テーブルスキーマ: 利用できません');
      }
      
      // テーブルの行数を表示
      const count = await tbl.countRows();
      console.log(`テーブルには ${count} 行のデータがあります`);
      
      // データを取得
      console.log(`最大 ${limit} 件のデータを取得中...`);
      const data = await tbl.query().limit(limit).toArray();
      
      // データを表示
      console.log('\nテーブルデータ:');
      if (data.length === 0) {
        console.log('データがありません。');
      } else {
        data.forEach((row, index) => {
          console.log(`--- レコード ${index + 1} ---`);
          for (const key in row) {
            if (key === 'vector') {
              if (row[key] && typeof row[key] === 'object' && 'length' in row[key]) {
                const vectorLength = row[key].length;
                let vectorPreview = '';
                try {
                  // 最初の5要素を表示
                  if (vectorLength > 0) {
                    const previewArray = Array.from(row[key]).slice(0, 5);
                    vectorPreview = previewArray.map((v: number) => v.toFixed(4)).join(', ');
                  }
                  console.log(`  ${key}: [${vectorPreview}..., (${vectorLength}次元)]`);
                } catch (e) {
                  console.log(`  ${key}: [ベクトルデータ表示エラー]`);
                }
              } else {
                console.log(`  ${key}: ${row[key]}`);
              }
            } else if (Array.isArray(row[key])) {
              console.log(`  ${key}: [${row[key].join(', ')}]`);
            } else if (typeof row[key] === 'string' && row[key].length > 100) {
              console.log(`  ${key}: ${row[key].substring(0, 100)}...`);
            } else {
              console.log(`  ${key}: ${row[key]}`);
            }
          }
        });
      }
      
      console.log(`\n合計 ${data.length} 件のデータを表示しました。`);
    } else {
      console.log('テーブル名を指定してください (例: --table confluence)');
    }
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    process.exit(1);
  }
}

main();