/**
 * LanceDBテーブルの再構築
 * 
 * 新しい埋め込みモデル（768次元）でLanceDBテーブルを再構築する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

/**
 * LanceDBテーブルを再構築する
 */
async function rebuildLanceDBTable(): Promise<void> {
  console.log('🔧 LanceDBテーブルの再構築');
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
    
  } catch (error) {
    console.error('❌ テーブル再構築エラー:', error);
    throw error;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ LanceDBテーブルの再構築完了');
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  try {
    await rebuildLanceDBTable();
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

export { rebuildLanceDBTable };
