/**
 * LanceDBのテストテーブルを作成するスクリプト
 * 検索テスト用の最小限のテーブルを作成します
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  try {
    console.log('LanceDBに接続中...');
    const db = await lancedb.connect('.lancedb');
    
    // テーブル名
    const tableName = 'search_test';
    
    // テーブルが存在するか確認
    const tableNames = await db.tableNames();
    console.log('利用可能なテーブル:', tableNames.join(', '));
    
    // テーブルが存在する場合は削除
    if (tableNames.includes(tableName)) {
      console.log(`テーブル '${tableName}' が存在します。削除します...`);
      await db.dropTable(tableName);
      console.log(`テーブル '${tableName}' を削除しました。`);
    }
    
    // テストデータ
    const vectorDim = 10;
    const testData = [
      {
        id: 'doc1',
        vector: Array(vectorDim).fill(0).map(() => Math.random()),
        title: 'テストドキュメント1',
        content: 'これはテストドキュメント1です。スペースについての説明が含まれています。'
      },
      {
        id: 'doc2',
        vector: Array(vectorDim).fill(0).map(() => Math.random()),
        title: 'テストドキュメント2',
        content: 'これはテストドキュメント2です。アカウント管理について説明しています。'
      },
      {
        id: 'doc3',
        vector: Array(vectorDim).fill(0).map(() => Math.random()),
        title: 'テストドキュメント3',
        content: 'これはテストドキュメント3です。権限設定について説明しています。'
      }
    ];
    
    // テーブル作成
    console.log(`テーブル '${tableName}' を作成します...`);
    const tbl = await db.createTable(tableName, testData);
    console.log(`テーブル '${tableName}' を作成しました。`);
    
    // テーブル情報を表示
    const count = await tbl.countRows();
    console.log(`テーブルには ${count} 行のデータがあります。`);
    
    // テーブルのスキーマを表示
    if (tbl.schema) {
      console.log('テーブルスキーマ:', JSON.stringify(tbl.schema, null, 2));
    } else {
      console.log('テーブルスキーマ: 利用できません');
    }
    
    console.log('テストテーブルの作成が完了しました。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
