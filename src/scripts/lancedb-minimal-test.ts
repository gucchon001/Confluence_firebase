/**
 * LanceDB最小限テスト: スキーマ定義を使用してテーブルを作成し、データを挿入するテスト
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  try {
    console.log('LanceDBに接続中...');
    const db = await lancedb.connect('.lancedb');
    
    // テーブル名
    const tableName = 'test_minimal';
    
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
    const testData = [
      {
        id: 'test-1',
        vector: new Float32Array(Array(384).fill(0).map(() => Math.random())),
        title: 'テストタイトル1',
        labels: ['テスト', 'ラベル1']
      }
    ];
    
    // テーブル作成（明示的にスキーマを指定）
    console.log(`テーブル '${tableName}' を作成します...`);
    const tbl = await db.createTable(tableName, testData, {
      id: { type: 'string', nullable: false },
      vector: { type: 'vector', valueType: 'float32', dimensions: 384, nullable: false },
      title: { type: 'string', nullable: false },
      labels: { type: 'list', valueType: 'string', nullable: false }
    });
    console.log(`テーブル '${tableName}' を作成しました。`);
    
    // テーブル情報を表示
    const count = await tbl.countRows();
    console.log(`テーブルには ${count} 行のデータがあります。`);
    
    // データを追加
    const newData = {
      id: 'test-2',
      vector: new Float32Array(Array(384).fill(0).map(() => Math.random())),
      title: 'テストタイトル2',
      labels: ['テスト', 'ラベル2']
    };
    
    console.log('データを追加します...');
    await tbl.add([newData]);
    console.log('データを追加しました。');
    
    // テーブル情報を表示
    const newCount = await tbl.countRows();
    console.log(`テーブルには ${newCount} 行のデータがあります。`);
    
    // データを検索
    console.log('データを検索します...');
    const results = await tbl.query().toArray();
    console.log(`検索結果: ${results.length} 件`);
    
    // 検索結果を表示
    results.forEach((result, index) => {
      console.log(`[${index + 1}] ID: ${result.id}, タイトル: ${result.title}`);
      // labelsが配列でない場合の対応
      const labels = Array.isArray(result.labels) ? result.labels.join(', ') : String(result.labels || '');
      console.log(`    ラベル: ${labels}`);
      console.log(`    ベクトル次元数: ${result.vector.length}`);
    });
    
    console.log('テストが完了しました。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

main();