/**
 * LanceDBパフォーマンステスト
 * 
 * このテストスイートは、LanceDBのパフォーマンスを検証します。
 * 実行方法: npx vitest run src/tests/lancedb-performance-tests.ts
 */
import { describe, test, expect, beforeAll } from 'vitest';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

describe('LanceDBパフォーマンステスト', () => {
  let db: lancedb.Connection;
  let tbl: lancedb.Table;
  const tableName = `test_perf_${Date.now()}`;
  const vectorDim = 10;
  
  // テスト前の準備
  beforeAll(async () => {
    // LanceDBに接続
    db = await lancedb.connect(path.resolve('.lancedb'));
    
    // テスト用テーブルを作成
    tbl = await db.createTable(tableName, [{
      id: 'perf-init',
      vector: Array(vectorDim).fill(0).map(() => Math.random()),
      title: 'パフォーマンステスト初期レコード',
      content: 'これはパフォーマンステスト用の初期レコードです'
    }]);
  });
  
  test('PF-01: 挿入パフォーマンステスト（小規模）', async () => {
    const batchSize = 10;
    const records = Array(batchSize).fill(0).map((_, i) => ({
      id: `perf-small-${i}`,
      vector: Array(vectorDim).fill(0).map(() => Math.random()),
      title: `小規模パフォーマンステスト ${i}`,
      content: `これは小規模パフォーマンステスト用のレコード ${i} です`
    }));
    
    // 挿入時間を計測
    const start = Date.now();
    await tbl.add(records);
    const duration = Date.now() - start;
    
    console.log(`${batchSize}レコードの挿入時間: ${duration}ms`);
    
    // 挿入が1秒以内に完了することを期待
    expect(duration).toBeLessThan(1000);
  });
  
  test('PF-01: 挿入パフォーマンステスト（中規模）', async () => {
    const batchSize = 100;
    const records = Array(batchSize).fill(0).map((_, i) => ({
      id: `perf-medium-${i}`,
      vector: Array(vectorDim).fill(0).map(() => Math.random()),
      title: `中規模パフォーマンステスト ${i}`,
      content: `これは中規模パフォーマンステスト用のレコード ${i} です`
    }));
    
    // 挿入時間を計測
    const start = Date.now();
    await tbl.add(records);
    const duration = Date.now() - start;
    
    console.log(`${batchSize}レコードの挿入時間: ${duration}ms`);
    
    // 挿入が5秒以内に完了することを期待
    expect(duration).toBeLessThan(5000);
  });
  
  test('PF-02: 検索パフォーマンステスト', async () => {
    const iterations = 10;
    let totalDuration = 0;
    
    // 複数回の検索を実行して平均時間を計測
    for (let i = 0; i < iterations; i++) {
      const vector = Array(vectorDim).fill(0).map(() => Math.random());
      
      const start = Date.now();
      await tbl.search(vector).limit(10).toArray();
      const duration = Date.now() - start;
      
      totalDuration += duration;
    }
    
    const averageDuration = totalDuration / iterations;
    console.log(`平均検索時間: ${averageDuration}ms`);
    
    // 検索が平均100ms以内に完了することを期待
    expect(averageDuration).toBeLessThan(100);
  });
  
  test('PF-03: フィルタリングパフォーマンステスト', async () => {
    const iterations = 10;
    let totalDuration = 0;
    
    // 複数回のフィルタリング検索を実行して平均時間を計測
    for (let i = 0; i < iterations; i++) {
      const vector = Array(vectorDim).fill(0).map(() => Math.random());
      
      const start = Date.now();
      await tbl.search(vector).where(`title LIKE '%パフォーマンス%'`).limit(10).toArray();
      const duration = Date.now() - start;
      
      totalDuration += duration;
    }
    
    const averageDuration = totalDuration / iterations;
    console.log(`平均フィルタリング検索時間: ${averageDuration}ms`);
    
    // フィルタリング検索が平均200ms以内に完了することを期待
    expect(averageDuration).toBeLessThan(200);
  });
  
  test('MU-01: メモリ使用量テスト', async () => {
    // 初期メモリ使用量を記録
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // 100レコードを挿入
    const batchSize = 100;
    const records = Array(batchSize).fill(0).map((_, i) => ({
      id: `mem-test-${i}`,
      vector: Array(vectorDim).fill(0).map(() => Math.random()),
      title: `メモリテスト ${i}`,
      content: `これはメモリテスト用のレコード ${i} です`
    }));
    
    await tbl.add(records);
    
    // 挿入後のメモリ使用量を記録
    const afterInsertMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    // 10回の検索を実行
    for (let i = 0; i < 10; i++) {
      const vector = Array(vectorDim).fill(0).map(() => Math.random());
      await tbl.search(vector).limit(10).toArray();
    }
    
    // 検索後のメモリ使用量を記録
    const afterSearchMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    console.log(`初期メモリ使用量: ${initialMemory.toFixed(2)} MB`);
    console.log(`挿入後メモリ使用量: ${afterInsertMemory.toFixed(2)} MB (差: ${(afterInsertMemory - initialMemory).toFixed(2)} MB)`);
    console.log(`検索後メモリ使用量: ${afterSearchMemory.toFixed(2)} MB (差: ${(afterSearchMemory - afterInsertMemory).toFixed(2)} MB)`);
    
    // メモリ使用量の増加が100MB以内であることを期待
    expect(afterSearchMemory - initialMemory).toBeLessThan(100);
  });
});
