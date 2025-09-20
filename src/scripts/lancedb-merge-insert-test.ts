/**
 * LanceDB mergeInsertテスト
 * 
 * このスクリプトは、LanceDBのmergeInsert機能を検証します。
 * 実行方法: npx tsx src/scripts/lancedb-merge-insert-test.ts
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

// 最小限のスキーマ定義
interface MinimalRecord {
  id: string;
  vector: number[];
  title: string;
  content: string;
}

async function main() {
  console.log('=== LanceDB mergeInsertテスト ===');
  console.log(`Node.js: ${process.version}`);
  
  try {
    // 1. テストデータの準備
    console.log('\n1. テストデータの準備');
    const testId = `merge-test-${Date.now()}`;
    const testTitle = 'マージテスト文書';
    const testContent = 'これはLanceDBのmergeInsertテスト用の文書内容です。';
    
    console.log(`ID: ${testId}`);
    console.log(`タイトル: ${testTitle}`);
    console.log(`内容: ${testContent}`);
    
    // 2. ベクトルデータの生成（ダミー）
    console.log('\n2. ダミーベクトルの生成');
    const vectorDim = 10; // テスト用に小さい次元数
    const vector = Array(vectorDim).fill(0).map(() => Math.random());
    
    console.log(`ベクトル次元数: ${vector.length}`);
    console.log(`ベクトル内容: [${vector.map(v => v.toFixed(6)).join(', ')}]`);
    
    // 3. LanceDBに接続
    console.log('\n3. LanceDBに接続');
    const dbPath = path.resolve('.lancedb');
    console.log(`データベースパス: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // 4. テーブル作成
    const tableName = 'merge_test';
    console.log(`\n4. テーブル '${tableName}' を作成/オープン`);
    
    // テーブルが既に存在するか確認
    const tableExists = (await db.tableNames()).includes(tableName);
    console.log(`テーブル '${tableName}' の存在: ${tableExists}`);
    
    // 5. 初期レコード作成
    const initialRecord: MinimalRecord = {
      id: testId,
      vector: vector,
      title: testTitle,
      content: testContent
    };
    
    let tbl;
    if (!tableExists) {
      // サンプルデータを使用してテーブルを作成
      console.log('サンプルデータでテーブルを新規作成します');
      tbl = await db.createTable(tableName, [initialRecord as any]);
      console.log(`テーブル '${tableName}' を作成しました`);
    } else {
      console.log('既存のテーブルを開きます');
      tbl = await db.openTable(tableName);
      console.log(`テーブル '${tableName}' を開きました`);
      
      // 既存テーブルにレコードを追加
      await tbl.add([initialRecord]);
      console.log(`既存テーブルにレコード '${testId}' を追加しました`);
    }
    
    // 6. 初期レコードの確認
    console.log('\n6. 初期レコードの確認');
    const initialResults = await tbl.query().where(`id = '${testId}'`).toArray();
    
    if (initialResults.length > 0) {
      console.log('初期レコード:');
      console.log(`  ID: ${initialResults[0].id}`);
      console.log(`  タイトル: ${initialResults[0].title}`);
      console.log(`  内容: ${initialResults[0].content}`);
    } else {
      console.log('初期レコードが見つかりません');
    }
    
    // 7. 更新用レコードの準備
    console.log('\n7. 更新用レコードの準備');
    const updatedTitle = `${testTitle} (更新済み)`;
    const updatedContent = `${testContent} この内容は更新されました。`;
    
    // 更新するフィールドのみを含むオブジェクト
    const updateRecord = {
      id: testId,
      title: updatedTitle,
      content: updatedContent
    };
    
    console.log('更新内容:');
    console.log(`  タイトル: ${updateRecord.title}`);
    console.log(`  内容: ${updateRecord.content}`);
    
    // 8. 部分更新の試行
    console.log('\n8. 部分更新の試行（ベクトルなし）');
    try {
      await tbl.mergeInsert([updateRecord], ['id']);
      console.log('部分更新が成功しました');
    } catch (error) {
      console.error('部分更新中にエラーが発生しました:', error);
      console.log('部分更新はサポートされていないようです。完全なレコードで再試行します...');
      
      // 完全なレコードで再試行
      const fullUpdateRecord: MinimalRecord = {
        id: testId,
        vector: vector, // 元のベクトルを再利用
        title: updatedTitle,
        content: updatedContent
      };
      
      try {
        await tbl.mergeInsert([fullUpdateRecord], ['id']);
        console.log('完全なレコードでの更新が成功しました');
      } catch (error) {
        console.error('完全なレコードでの更新中にエラーが発生しました:', error);
        throw error;
      }
    }
    
    // 9. 更新結果の確認
    console.log('\n9. 更新結果の確認');
    const updatedResults = await tbl.query().where(`id = '${testId}'`).toArray();
    
    if (updatedResults.length > 0) {
      console.log('更新後のレコード:');
      console.log(`  ID: ${updatedResults[0].id}`);
      console.log(`  タイトル: ${updatedResults[0].title}`);
      console.log(`  内容: ${updatedResults[0].content}`);
      
      // 更新が成功したか確認
      const isUpdated = 
        updatedResults[0].title === updatedTitle && 
        updatedResults[0].content === updatedContent;
      
      if (isUpdated) {
        console.log('✅ 更新が正常に適用されました');
      } else {
        console.log('❌ 更新が適用されていません');
      }
    } else {
      console.log('更新後のレコードが見つかりません');
    }
    
    // 10. 複数レコードの一括更新テスト
    console.log('\n10. 複数レコードの一括更新テスト');
    
    // 追加のテストレコードを作成
    const batchIds = Array(3).fill(0).map((_, i) => `batch-${Date.now()}-${i}`);
    const batchRecords = batchIds.map(id => ({
      id,
      vector: Array(vectorDim).fill(0).map(() => Math.random()),
      title: `バッチレコード ${id}`,
      content: `これはバッチテスト用のレコード ${id} です。`
    }));
    
    // レコードをバッチで追加
    console.log(`${batchRecords.length}件のバッチレコードを追加します`);
    await tbl.add(batchRecords);
    
    // バッチ更新用レコードを準備
    const batchUpdates = batchIds.map(id => ({
      id,
      vector: Array(vectorDim).fill(0).map(() => Math.random()), // 新しいベクトル
      title: `更新済みバッチレコード ${id}`,
      content: `これはバッチ更新後のレコード ${id} です。`
    }));
    
    // バッチ更新を実行
    console.log(`${batchUpdates.length}件のレコードをバッチ更新します`);
    try {
      await tbl.mergeInsert(batchUpdates, ['id']);
      console.log('バッチ更新が成功しました');
      
      // バッチ更新結果の確認
      const batchResults = await tbl.query().where(`id LIKE 'batch-%'`).toArray();
      console.log(`${batchResults.length}件のバッチレコードが見つかりました`);
      
      // 更新が成功したか確認
      const allUpdated = batchResults.every(record => 
        record.title.includes('更新済み') && 
        record.content.includes('バッチ更新後')
      );
      
      if (allUpdated) {
        console.log('✅ すべてのバッチレコードが正常に更新されました');
      } else {
        console.log('❌ 一部のバッチレコードが正しく更新されていません');
      }
    } catch (error) {
      console.error('バッチ更新中にエラーが発生しました:', error);
    }
    
    console.log('\n=== テスト完了 ===');
    console.log(`テーブル '${tableName}' には現在 ${await tbl.countRows()} 行のデータがあります`);
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
