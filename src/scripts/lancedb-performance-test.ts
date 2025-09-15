/**
 * LanceDBのパフォーマンステスト
 * 大規模データセットでのパフォーマンスを検証します
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

// ダミーの埋め込みベクトルを生成する関数
function generateDummyVector(dimension: number = 10): number[] {
  return Array(dimension).fill(0).map(() => Math.random());
}

async function main() {
  try {
    console.log('=== LanceDBパフォーマンステスト ===\n');
    
    // LanceDBに接続
    console.log('LanceDBに接続中...');
    const db = await lancedb.connect('.lancedb');
    
    // テーブル名
    const tableName = 'search_test';
    
    // テーブルが存在するか確認
    const tableNames = await db.tableNames();
    if (!tableNames.includes(tableName)) {
      console.error(`エラー: テーブル '${tableName}' が存在しません。`);
      process.exit(1);
    }
    
    // テーブルを開く
    console.log(`テーブル '${tableName}' を開きます...`);
    const tbl = await db.openTable(tableName);
    
    // テーブル情報を表示
    const count = await tbl.countRows();
    console.log(`テーブルには ${count} 行のデータがあります。\n`);
    
    // テスト1: 単純な検索のパフォーマンス
    console.log('テスト1: 単純な検索のパフォーマンス');
    const queries = ['スペース', 'アカウント', 'ワード', '権限', 'フロー'];
    const iterations = 5;
    
    for (const query of queries) {
      console.log(`\nクエリ: "${query}"`);
      
      // 埋め込みベクトルを生成
      console.log('埋め込みベクトルを生成中...');
      const start1 = Date.now();
      let vector: number[];
      try {
        const fullVector = await getEmbeddings(query);
        vector = fullVector.slice(0, 10);
      } catch (error) {
        console.warn('埋め込み生成エラー:', error);
        vector = generateDummyVector(10);
        console.log('ダミーベクトルを使用します');
      }
      const end1 = Date.now();
      console.log(`埋め込みベクトル生成完了: ${end1 - start1}ms`);
      
      // 複数回検索を実行して平均時間を計測
      let totalTime = 0;
      let totalResults = 0;
      
      for (let i = 0; i < iterations; i++) {
        const start2 = Date.now();
        const results = await tbl.search(vector).limit(5).toArray();
        const end2 = Date.now();
        const time = end2 - start2;
        
        totalTime += time;
        totalResults += results.length;
        
        console.log(`  検索 ${i + 1}: ${time}ms, ${results.length}件の結果`);
      }
      
      const avgTime = totalTime / iterations;
      const avgResults = totalResults / iterations;
      console.log(`平均: ${avgTime.toFixed(2)}ms, ${avgResults.toFixed(1)}件の結果`);
    }
    
    // テスト2: フィルタ付き検索のパフォーマンス
    console.log('\nテスト2: フィルタ付き検索のパフォーマンス');
    const query = 'テスト';
    
    // 埋め込みベクトルを生成
    console.log(`\nクエリ: "${query}"`);
    console.log('埋め込みベクトルを生成中...');
    let vector: number[];
    try {
      const fullVector = await getEmbeddings(query);
      vector = fullVector.slice(0, 10);
    } catch (error) {
      console.warn('埋め込み生成エラー:', error);
      vector = generateDummyVector(10);
      console.log('ダミーベクトルを使用します');
    }
    console.log('埋め込みベクトル生成完了');
    
    // フィルタなし
    const start3 = Date.now();
    const results1 = await tbl.search(vector).limit(5).toArray();
    const end3 = Date.now();
    console.log(`フィルタなし: ${end3 - start3}ms, ${results1.length}件の結果`);
    
    // タイトルフィルタ
    const start4 = Date.now();
    const results2 = await tbl.search(vector).where("title LIKE '%テスト%'").limit(5).toArray();
    const end4 = Date.now();
    console.log(`タイトルフィルタ: ${end4 - start4}ms, ${results2.length}件の結果`);
    
    // コンテンツフィルタ
    const start5 = Date.now();
    const results3 = await tbl.search(vector).where("content LIKE '%テスト%'").limit(5).toArray();
    const end5 = Date.now();
    console.log(`コンテンツフィルタ: ${end5 - start5}ms, ${results3.length}件の結果`);
    
    // テスト3: メモリ使用量
    console.log('\nテスト3: メモリ使用量');
    const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(`初期メモリ使用量: ${initialMemory.toFixed(2)} MB`);
    
    // 全件取得
    const start6 = Date.now();
    const allResults = await tbl.query().toArray();
    const end6 = Date.now();
    const afterQueryMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    console.log(`全件取得: ${end6 - start6}ms, ${allResults.length}件のデータ`);
    console.log(`取得後メモリ使用量: ${afterQueryMemory.toFixed(2)} MB (差: ${(afterQueryMemory - initialMemory).toFixed(2)} MB)`);
    
    // 検索を10回実行
    const start7 = Date.now();
    for (let i = 0; i < 10; i++) {
      const q = queries[i % queries.length];
      const v = generateDummyVector(10);
      await tbl.search(v).limit(5).toArray();
    }
    const end7 = Date.now();
    const afterSearchMemory = process.memoryUsage().heapUsed / 1024 / 1024;
    
    console.log(`10回の検索: ${end7 - start7}ms`);
    console.log(`検索後メモリ使用量: ${afterSearchMemory.toFixed(2)} MB (差: ${(afterSearchMemory - afterQueryMemory).toFixed(2)} MB)`);
    
    console.log('\nパフォーマンステストが完了しました。');
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

main();