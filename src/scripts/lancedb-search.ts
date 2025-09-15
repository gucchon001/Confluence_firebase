/**
 * LanceDBの検索テストスクリプト
 * Usage: npx tsx src/scripts/lancedb-search.ts "検索クエリ" --table <tableName> --dim <次元数>
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

async function main() {
  // コマンドライン引数の解析
  const args = process.argv.slice(2);
  let query = '';
  let tableName = 'confluence';
  let vectorDim = 10; // デフォルトの次元数
  
  // 検索クエリ（最初の引数）
  if (args.length > 0 && !args[0].startsWith('--')) {
    query = args[0];
  }
  
  // オプション引数の解析
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--table' && i + 1 < args.length) {
      tableName = args[i + 1];
      i++;
    } else if (args[i] === '--dim' && i + 1 < args.length) {
      vectorDim = parseInt(args[i + 1], 10);
      i++;
    }
  }
  
  if (!query) {
    console.error('Usage: npx tsx src/scripts/lancedb-search.ts "検索クエリ" --table <tableName> --dim <次元数>');
    process.exit(1);
  }
  
  console.log(`検索クエリ: "${query}"`);
  
  try {
    // 埋め込みベクトルを生成
    console.log('埋め込みベクトルを生成中...');
    const fullVector = await getEmbeddings(query);
    console.log(`埋め込みベクトル生成完了 (${fullVector.length} 次元)`);
    
    // 指定された次元数に切り詰め
    const vector = fullVector.slice(0, vectorDim);
    console.log(`次元数を ${vectorDim} に切り詰めました`);
    
    // LanceDBに接続
    console.log('LanceDBに接続中...');
    const dbPath = path.resolve('.lancedb');
    console.log('LanceDB パス:', dbPath);
    const db = await lancedb.connect(dbPath);
    
    // テーブル一覧を取得
    const tableNames = await db.tableNames();
    console.log('利用可能なテーブル:', tableNames.join(', '));
    
    // テーブルが存在するか確認
    if (!tableNames.includes(tableName)) {
      console.error(`エラー: テーブル '${tableName}' が存在しません。`);
      process.exit(1);
    }
    
    // テーブルを開く
    const tbl = await db.openTable(tableName);
    console.log(`テーブル '${tableName}' を開きました`);
    
    // 検索を実行
    console.log('検索を実行中...');
    const results = await tbl.search(vector).limit(5).toArray();
    
    // 検索結果を表示
    console.log('検索結果:');
    if (results.length === 0) {
      console.log('検索結果がありません');
    } else {
      results.forEach((result, index) => {
        console.log(`\n--- 結果 ${index + 1} ---`);
        console.log(`ID: ${result.id}`);
        console.log(`距離: ${result._distance}`);
        console.log(`タイトル: ${result.title}`);
        
        if (result.space_key) {
          console.log(`スペースキー: ${result.space_key}`);
        }
        
        if (result.labels) {
          const labels = Array.isArray(result.labels) ? result.labels.join(', ') : String(result.labels);
          console.log(`ラベル: ${labels}`);
        }
        
        if (result.content) {
          console.log(`コンテンツ: ${result.content.substring(0, 100)}...`);
        }
        
        if (result.url) {
          console.log(`URL: ${result.url}`);
        }
      });
    }
    
  } catch (error: any) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

main();