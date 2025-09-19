/**
 * LanceDBの検索をテストするスクリプト
 */
import { getEmbeddings } from '../lib/embeddings';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function testSearch() {
  try {
    const query = 'ログイン機能の詳細は';
    console.log(`検索クエリ: '${query}'`);
    
    // 埋め込みベクトルを生成
    const vector = await getEmbeddings(query);
    console.log(`埋め込みベクトル生成完了 (${vector.length} 次元)`);
    
    // LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`LanceDB接続先: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // テーブルを開く
    const tableName = 'confluence';
    const tbl = await db.openTable(tableName);
    
    // 検索を実行
    console.log(`テーブル '${tableName}' で検索を実行中...`);
    const results = await tbl.search(vector).limit(5).toArray();
    
    // 結果を表示
    console.log('\n検索結果:');
    results.forEach((result, index) => {
      console.log(`\n--- 結果 ${index + 1} ---`);
      console.log(`タイトル: ${result.title}`);
      console.log(`スペース: ${result.space_key}`);
      console.log(`URL: ${result.url}`);
      console.log(`距離: ${result._distance}`);
      console.log(`内容の一部: ${result.content?.substring(0, 100)}...`);
    });
    
    console.log(`\n合計 ${results.length} 件の結果が見つかりました`);
    
    // テーブル内の全レコード数を確認
    const count = await tbl.countRows();
    console.log(`テーブル内の総レコード数: ${count}`);
    
  } catch (err) {
    console.error('エラー:', err);
  }
}

testSearch();
