/**
 * 動作するテーブルの作成
 * 
 * 正しいスキーマでベクトルデータを保存するテーブルを作成
 */

import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

async function createWorkingTable(): Promise<void> {
  console.log('🔧 動作するテーブルの作成');
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
    
    // 2. テストデータの準備（少数のレコードでテスト）
    console.log(`\n=== 2. テストデータの準備 ===`);
    
    const testData = [
      {
        id: 'test-001',
        pageId: 100001,
        title: '教室管理機能の詳細',
        lastUpdated: new Date().toISOString(),
        chunkIndex: 0,
        content: '教室管理機能では、教室の登録、編集、削除、一覧表示が可能です。教室情報には、教室名、住所、電話番号、担当者情報が含まれます。',
        labels: ['教室管理', '機能']
      },
      {
        id: 'test-002',
        pageId: 100002,
        title: 'ユーザー登録・退会フロー',
        lastUpdated: new Date().toISOString(),
        chunkIndex: 0,
        content: 'ユーザーの登録から退会までの手順を説明します。メール認証、パスワード設定、プロフィール入力などの詳細な流れを記載しています。',
        labels: ['ユーザー管理', 'フロー']
      },
      {
        id: 'test-003',
        pageId: 100003,
        title: '契約管理機能の詳細',
        lastUpdated: new Date().toISOString(),
        chunkIndex: 0,
        content: '契約管理機能の詳細な操作方法を説明します。契約情報の検索、編集、履歴確認、レポート出力などの機能について記載しています。',
        labels: ['契約管理', '機能']
      }
    ];
    
    // 3. 埋め込み生成
    console.log(`\n=== 3. 埋め込み生成 ===`);
    
    const processedData = [];
    
    for (const record of testData) {
      console.log(`\n--- レコード処理: ${record.title} ---`);
      
      // 埋め込み生成
      const content = record.content || record.title || 'No content';
      const embedding = await getEmbeddings(content);
      
      console.log(`✅ 埋め込み生成成功: ${embedding.length}次元`);
      
      // データ準備（配列として保存）
      const processedRecord = {
        id: record.id,
        pageId: record.pageId,
        title: record.title,
        lastUpdated: record.lastUpdated,
        chunkIndex: record.chunkIndex,
        content: record.content,
        labels: record.labels,
        vector: embedding // 配列として保存
      };
      
      processedData.push(processedRecord);
    }
    
    // 4. テーブルの作成
    console.log(`\n=== 4. テーブルの作成 ===`);
    
    const tbl = await db.createTable('confluence', processedData);
    console.log(`✅ ${processedData.length}件のレコードでテーブルを作成しました`);
    
    // 5. 最終確認
    console.log(`\n=== 5. 最終確認 ===`);
    
    const finalCount = await tbl.countRows();
    console.log(`最終レコード数: ${finalCount}`);
    
    // 6. サンプルレコードの確認
    console.log(`\n=== 6. サンプルレコードの確認 ===`);
    
    const sampleRecords = await tbl.query().limit(3).toArray();
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
    
    // 7. ベクトル検索のテスト
    console.log(`\n=== 7. ベクトル検索のテスト ===`);
    
    try {
      const queryEmbedding = await getEmbeddings('教室管理');
      console.log(`✅ クエリ埋め込み生成成功: ${queryEmbedding.length}次元`);
      
      const searchResults = await tbl.search(queryEmbedding).limit(3).toArray();
      console.log(`✅ ベクトル検索成功: ${searchResults.length}件の結果`);
      
      for (const result of searchResults) {
        console.log(`\n--- 検索結果 ---`);
        console.log(`タイトル: ${result.title}`);
        console.log(`距離: ${result._distance?.toFixed(4) || 'N/A'}`);
      }
      
    } catch (error) {
      console.error('❌ ベクトル検索エラー:', error);
    }
    
  } catch (error) {
    console.error('❌ テーブル作成エラー:', error);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 動作するテーブルの作成完了');
}

if (require.main === module) {
  createWorkingTable();
}

export { createWorkingTable };
