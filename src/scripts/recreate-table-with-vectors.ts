/**
 * ベクトル付きテーブルの再作成
 * 
 * 正しいスキーマでLanceDBテーブルを再作成し、ベクトルデータを保存する
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

/**
 * ベクトル付きテーブルの再作成
 */
async function recreateTableWithVectors(): Promise<void> {
  console.log('🔧 ベクトル付きテーブルの再作成');
  console.log('='.repeat(80));
  console.log(`開始時刻: ${new Date().toISOString()}`);
  
  try {
    const db = await lancedb.connect(path.resolve('.lancedb'));
    
    // 1. 既存テーブルの削除
    console.log(`\n=== 1. 既存テーブルの削除 ===`);
    try {
      await db.dropTable('confluence');
      console.log('✅ 既存テーブルを削除しました');
    } catch (error) {
      console.log('⚠️ テーブルが存在しないか、削除に失敗しました:', error);
    }
    
    // テーブルが存在する場合は強制削除
    try {
      const tables = await db.tableNames();
      if (tables.includes('confluence')) {
        console.log('🔄 テーブルが存在するため、強制削除を試行します');
        await db.dropTable('confluence');
        console.log('✅ 強制削除が成功しました');
      }
    } catch (error) {
      console.log('⚠️ 強制削除に失敗しました:', error);
    }
    
    // 2. 新しいテーブルの作成
    console.log(`\n=== 2. 新しいテーブルの作成 ===`);
    
    // サンプルデータでテーブルを作成
    const sampleData = [
      {
        id: 'sample-1',
        pageId: 123456,
        title: 'サンプルページ1',
        spaceKey: 'TEST',
        lastUpdated: new Date().toISOString(),
        chunkIndex: 0,
        content: 'これはサンプルコンテンツです。教室管理について説明します。',
        labels: ['テスト', 'サンプル'],
        vector: new Float32Array(768).fill(0.1) // 768次元のダミーベクトル
      }
    ];
    
    const tbl = await db.createTable('confluence', sampleData);
    console.log('✅ 新しいテーブルを作成しました');
    
    // 3. 既存データの取得と処理
    console.log(`\n=== 3. 既存データの処理 ===`);
    
    // 既存のデータファイルから情報を取得
    const existingData = [
      {
        id: '640450787-0',
        pageId: 640450787,
        title: 'client-tomonokai-juku Home',
        spaceKey: undefined,
        lastUpdated: '2022-12-01T05:33:12.822Z',
        chunkIndex: 0,
        content: 'これはテストコンテンツです。',
        labels: ['フォルダ']
      },
      {
        id: '643858450-0',
        pageId: 643858450,
        title: '塾講師ステーションドキュメントスペース',
        spaceKey: undefined,
        lastUpdated: '2022-12-07T02:54:58.514Z',
        chunkIndex: 0,
        content: '塾講師ステーションドキュメントスペースの説明です。',
        labels: ['フォルダ']
      }
    ];
    
    // 4. 埋め込み生成とデータ挿入
    console.log(`\n=== 4. 埋め込み生成とデータ挿入 ===`);
    
    const processedData = [];
    for (const record of existingData) {
      try {
        console.log(`\n--- レコード処理: ${record.title} ---`);
        
        // 埋め込み生成
        const content = record.content || record.title || 'No content';
        const embedding = await getEmbeddings(content);
        
        console.log(`✅ 埋め込み生成成功: ${embedding.length}次元`);
        
        // データ準備
        const processedRecord = {
          ...record,
          vector: new Float32Array(embedding)
        };
        
        processedData.push(processedRecord);
        
      } catch (error) {
        console.error(`❌ レコード ${record.id} の処理エラー:`, error);
      }
    }
    
    // 5. データの挿入
    console.log(`\n=== 5. データの挿入 ===`);
    
    if (processedData.length > 0) {
      await tbl.add(processedData);
      console.log(`✅ ${processedData.length}件のレコードを挿入しました`);
    } else {
      console.log('⚠️ 挿入するデータがありません');
    }
    
    // 6. 検証
    console.log(`\n=== 6. 検証 ===`);
    
    const count = await tbl.countRows();
    console.log(`総レコード数: ${count}`);
    
    // サンプルレコードの確認
    const sampleRecords = await tbl.query().limit(2).toArray();
    for (const record of sampleRecords) {
      console.log(`\n--- レコード確認 ---`);
      console.log(`ID: ${record.id}`);
      console.log(`タイトル: ${record.title}`);
      console.log(`コンテンツ長: ${record.content?.length || 0}文字`);
      
      const vector = record.vector?.toArray ? record.vector.toArray() : record.vector;
      if (vector && Array.isArray(vector)) {
        console.log(`✅ ベクトル次元数: ${vector.length}`);
        console.log(`ベクトル範囲: ${Math.min(...vector).toFixed(4)} ～ ${Math.max(...vector).toFixed(4)}`);
      } else {
        console.log('❌ ベクトルが存在しません');
      }
    }
    
    // 7. 検索テスト
    console.log(`\n=== 7. 検索テスト ===`);
    
    try {
      const testQuery = '教室管理';
      const testEmbedding = await getEmbeddings(testQuery);
      
      const searchResults = await tbl.search(testEmbedding).limit(3).toArray();
      
      console.log(`検索クエリ: "${testQuery}"`);
      console.log(`検索結果数: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        console.log('検索結果:');
        searchResults.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.title} (距離: ${result._distance?.toFixed(4) || 'N/A'})`);
        });
      }
      
    } catch (error) {
      console.error('❌ 検索テストエラー:', error);
    }
    
  } catch (error) {
    console.error('❌ テーブル再作成エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ ベクトル付きテーブルの再作成完了');
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  try {
    await recreateTableWithVectors();
  } catch (error) {
    console.error('❌ 実行エラー:', error);
    process.exit(1);
  }
}

// スクリプト実行
if (require.main === module) {
  main();
}

export { recreateTableWithVectors };
