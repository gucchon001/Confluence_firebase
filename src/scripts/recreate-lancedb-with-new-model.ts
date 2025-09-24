/**
 * 新しい埋め込みモデルでLanceDBテーブルを再構築する
 * 
 * 384次元から768次元のモデルに変更し、既存のConfluenceデータを再インポートする
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

interface ConfluenceRecord {
  id: string;
  pageId: number;
  title: string;
  content: string;
  vector: number[];
  space_key: string;
  labels: any[];
  url: string;
  lastUpdated: string;
}

/**
 * LanceDBテーブルを再構築する
 */
async function recreateLanceDBTable(): Promise<void> {
  console.log('🔧 LanceDBテーブルの再構築開始');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    const tableName = 'confluence';
    
    // 既存のテーブルを削除
    const tableNames = await db.tableNames();
    if (tableNames.includes(tableName)) {
      console.log(`既存のテーブル '${tableName}' を削除中...`);
      await db.dropTable(tableName);
      console.log('✅ 既存テーブルを削除しました');
    }
    
    // 新しいモデルでテスト埋め込みを生成
    console.log('新しいモデルでテスト埋め込みを生成中...');
    const testEmbedding = await getEmbeddings('テスト用のサンプルテキスト');
    console.log(`✅ 新しいモデルの次元数: ${testEmbedding.length}`);
    
    if (testEmbedding.length !== 768) {
      console.warn(`⚠️ 警告: 期待される次元数は768ですが、実際は${testEmbedding.length}です`);
    }
    
    // 新しいテーブルを作成（サンプルデータで）
    console.log(`新しいテーブル '${tableName}' を作成中...`);
    const sampleData = [{
      id: 'sample-1',
      pageId: 1,
      title: 'サンプルページ',
      content: 'これはサンプルコンテンツです',
      vector: testEmbedding,
      space_key: 'TEST',
      labels: [],
      url: 'https://example.com/sample',
      lastUpdated: new Date().toISOString()
    }];
    
    const tbl = await db.createTable(tableName, sampleData);
    console.log('✅ 新しいテーブルが作成されました');
    
    // サンプルデータを削除
    await tbl.delete("id = 'sample-1'");
    console.log('✅ サンプルデータを削除しました');
    
    console.log('\n--- 次のステップ ---');
    console.log('📋 データの再インポートが必要です:');
    console.log('  1. 既存のConfluenceデータをバックアップ');
    console.log('  2. バッチ同期スクリプトを実行してデータを再インポート');
    console.log('  3. 新しいモデルで品質テストを実行');
    
    console.log('\n--- 推奨コマンド ---');
    console.log('npm run sync:confluence  # または適切な同期コマンド');
    
  } catch (error) {
    console.error('❌ テーブル再構築エラー:', error);
    throw error;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ LanceDBテーブルの再構築完了');
}

/**
 * 新しいモデルの品質をテストする
 */
async function testNewModel(): Promise<void> {
  console.log('\n--- 新しいモデルの品質テスト ---');
  
  try {
    const testQueries = [
      '教室管理の詳細は',
      '教室コピー機能でコピー可能な項目は？',
      'オファー機能の種類と使い方は？'
    ];
    
    for (const query of testQueries) {
      console.log(`\nテストクエリ: "${query}"`);
      const embedding = await getEmbeddings(query);
      console.log(`  ベクトル次元数: ${embedding.length}`);
      console.log(`  ベクトル範囲: ${Math.min(...embedding).toFixed(4)} ～ ${Math.max(...embedding).toFixed(4)}`);
      console.log(`  ベクトル平均: ${(embedding.reduce((sum, val) => sum + val, 0) / embedding.length).toFixed(4)}`);
    }
    
  } catch (error) {
    console.error('❌ モデルテストエラー:', error);
  }
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  try {
    await recreateLanceDBTable();
    await testNewModel();
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

export { recreateLanceDBTable, testNewModel };
