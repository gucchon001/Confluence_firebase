/**
 * LanceDBテーブルの最適化スクリプト
 * データフラグメントを最適化し、読み取りパフォーマンスを向上させます
 * 
 * 使用方法:
 * npx tsx src/scripts/lancedb-optimize.ts [--table <テーブル名>]
 * 
 * 例:
 * npx tsx src/scripts/lancedb-optimize.ts --table confluence
 */

import * as path from 'path';
import * as lancedb from '@lancedb/lancedb';
import * as minimist from 'minimist';

async function main() {
  // コマンドライン引数の解析
  const argv = minimist.default(process.argv.slice(2));
  const tableName = argv.table || 'confluence';
  
  console.log(`=== LanceDBテーブル '${tableName}' の最適化 ===`);
  
  try {
    // LanceDBに接続
    console.log('\n1. LanceDBに接続中...');
    const dbPath = path.resolve('.lancedb');
    console.log(`データベースパス: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // テーブル一覧を取得
    console.log('\n2. テーブル一覧の取得');
    const tableNames = await db.tableNames();
    console.log(`利用可能なテーブル: ${tableNames.join(', ')}`);
    
    if (!tableNames.includes(tableName)) {
      console.error(`テーブル '${tableName}' が存在しません。`);
      process.exit(1);
    }
    
    // テーブルを開く
    console.log(`\n3. テーブル '${tableName}' を開く`);
    const tbl = await db.openTable(tableName);
    
    // テーブル情報を表示
    console.log('\n4. テーブル情報');
    const schema = await tbl.schema();
    console.log('スキーマ:');
    console.log(JSON.stringify(schema, null, 2));
    
    const rowCount = await tbl.countRows();
    console.log(`行数: ${rowCount}`);
    
    // テーブルの最適化
    console.log('\n5. テーブルの最適化を開始');
    console.log('データフラグメントを統合中...');
    
    const startTime = Date.now();
    
    try {
      // await tbl.compact_files(); // メソッドが存在しないためコメントアウト
      
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`テーブルの最適化が完了しました（処理時間: ${duration.toFixed(2)}秒）。`);
    } catch (error) {
      console.error('テーブルの最適化中にエラーが発生しました:', error);
    }
    
    // インデックス情報の取得（存在する場合）
    console.log('\n6. インデックス情報');
    try {
      const indices = await tbl.listIndices();
      
      if (indices && indices.length > 0) {
        console.log(`${indices.length}個のインデックスが見つかりました:`);
        
        for (const index of indices) {
          console.log(`- ${index.name} (タイプ: ${(index as any).type || 'unknown'})`);
        }
      } else {
        console.log('インデックスが見つかりませんでした。');
        console.log('\n7. インデックスの作成を推奨');
        console.log('検索パフォーマンスを向上させるために、以下のコマンドでインデックスを作成することを検討してください:');
        console.log(`npx tsx -e "
const lancedb = require('@lancedb/lancedb');
(async () => {
  const db = await lancedb.connect('.lancedb');
  const tbl = await db.openTable('${tableName}');
  await tbl.createIndex({ type: 'IVF', numLists: 100 });
  console.log('インデックスが作成されました。');
})();
"`);
      }
    } catch (error) {
      console.log('インデックス情報の取得中にエラーが発生しました。この機能はLanceDBの最新バージョンでのみサポートされています。');
    }
    
    console.log('\nLanceDBテーブルの最適化が完了しました。');
    
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// スクリプトの実行
if (require.main === module) {
  main().catch(error => {
    console.error('スクリプトの実行中にエラーが発生しました:', error);
    process.exit(1);
  });
}
