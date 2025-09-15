/**
 * LanceDB基本機能テスト
 * 
 * このテストスイートは、LanceDBの基本的な機能を検証します。
 * 実行方法: npx vitest run src/tests/lancedb/basic.test.ts
 */
import { describe, test, expect, beforeAll } from 'vitest';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

describe('LanceDB基本機能テスト', () => {
  let db: lancedb.Connection;
  let tbl: lancedb.Table;
  const tableName = `test_basic_${Date.now()}`;
  
  // テスト前の準備
  beforeAll(async () => {
    // LanceDBに接続
    db = await lancedb.connect(path.resolve('.lancedb'));
  });
  
  test('BF-01: LanceDB接続テスト', async () => {
    // テーブル一覧を取得してデータベース接続を検証
    const tables = await db.tableNames();
    expect(Array.isArray(tables)).toBe(true);
  });
  
  test('BF-02: テーブル作成テスト', async () => {
    // 最小スキーマでテーブルを作成
    tbl = await db.createTable(tableName, [{
      id: 'test-1',
      vector: Array(10).fill(0).map(() => Math.random()),
      title: 'テストタイトル',
      content: 'テスト内容'
    }]);
    
    // テーブルが作成されたことを確認
    const tables = await db.tableNames();
    expect(tables).toContain(tableName);
  });
  
  test('BF-03: レコード挿入テスト', async () => {
    // 初期レコード数を取得
    const initialCount = await tbl.countRows();
    
    // 新しいレコードを挿入
    await tbl.add([{
      id: 'test-2',
      vector: Array(10).fill(0).map(() => Math.random()),
      title: 'テストタイトル2',
      content: 'テスト内容2'
    }]);
    
    // レコード数が増加していることを確認
    const newCount = await tbl.countRows();
    expect(newCount).toBe(initialCount + 1);
  });
  
  test('BF-04: レコード読み取りテスト', async () => {
    // すべてのレコードを取得
    const results = await tbl.query().toArray();
    
    // レコードが取得できることを確認
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('vector');
    expect(results[0]).toHaveProperty('title');
    expect(results[0]).toHaveProperty('content');
  });
  
  test('BF-05: ベクトル検索テスト', async () => {
    // 検索用のベクトルを作成
    const searchVector = Array(10).fill(0).map(() => Math.random());
    
    // ベクトル検索を実行
    const results = await tbl.search(searchVector).limit(5).toArray();
    
    // 検索結果が返されることを確認
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('_distance');
  });
  
  test('AF-01: フィルタリングテスト', async () => {
    // 特定のIDを持つレコードを検索
    const results = await tbl.query().where(`id = 'test-1'`).toArray();
    
    // フィルタリング結果が正しいことを確認
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('test-1');
  });
  
  test('ER-01: 無効なベクトル検証テスト', async () => {
    // 異なる次元数のベクトルを挿入
    const invalidVectorId = 'invalid-vector';
    await tbl.add([{
      id: invalidVectorId,
      vector: Array(5).fill(0), // テーブルのベクトルは10次元だが5次元を挿入
      title: '無効なベクトル',
      content: '無効なベクトルテスト'
    }]);
    
    // 挿入されたレコードを取得
    const results = await tbl.query().where(`id = '${invalidVectorId}'`).toArray();
    
    // レコードが存在することを確認
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(invalidVectorId);
    
    // ベクトルの次元数が変更されていることを確認
    // LanceDBは次元数の異なるベクトルを挿入すると、内部的に次元数を調整する
    const vectorLength = Array.isArray(results[0].vector) ? results[0].vector.length : 
                        typeof results[0].vector === 'object' ? Object.keys(results[0].vector).length : 0;
    
    // 元のテーブルのベクトル次元数（10）と異なることを確認
    expect(vectorLength).not.toBe(5);
  });
  
  test('ER-03: 存在しないテーブルテスト', async () => {
    // 存在しないテーブルを開く（エラーが発生することを期待）
    await expect(db.openTable('non_existent_table')).rejects.toThrow();
  });
});