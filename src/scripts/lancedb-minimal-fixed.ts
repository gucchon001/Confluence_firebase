/**
 * LanceDB最小限テスト（完全修正版）
 * 
 * このスクリプトは、LanceDBの最小限のスキーマと操作で動作を検証します。
 * 実行方法: npx tsx src/scripts/lancedb-minimal-fixed.ts
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

// 最小限のスキーマ定義
interface MinimalRecord {
  id: string;
  vector: number[];
  title: string;
  content: string;
}

async function main() {
  console.log('=== LanceDB最小限テスト（完全修正版） ===');
  console.log(`Node.js: ${process.version}`);
  
  try {
    // 1. 最小限のデータを準備
    console.log('\n1. テストデータの準備');
    const testId = `test-${Date.now()}`;
    const testTitle = 'テスト文書タイトル';
    const testContent = 'これはLanceDBのテスト用の文書内容です。正しく保存と検索ができるかを検証します。';
    
    console.log(`ID: ${testId}`);
    console.log(`タイトル: ${testTitle}`);
    console.log(`内容: ${testContent}`);
    
    // 2. 埋め込みベクトルを生成
    console.log('\n2. 埋め込みベクトルの生成');
    console.log('getEmbeddings関数を呼び出し中...');
    const rawVector = await getEmbeddings(testContent);
    
    // 埋め込みベクトルの型情報を出力
    console.log(`埋め込みベクトルの型: ${typeof rawVector}`);
    console.log(`Array.isArray: ${Array.isArray(rawVector)}`);
    console.log(`コンストラクタ名: ${rawVector.constructor?.name || '不明'}`);
    console.log(`長さ: ${rawVector.length}`);
    console.log(`先頭10要素: [${rawVector.slice(0, 10).map(v => v.toFixed(6)).join(', ')}]`);
    
    // 3. ベクトルを純number[]に変換
    console.log('\n3. ベクトルをnumber[]に変換');
    const vector = Array.from(rawVector, x => {
      const num = Number(x);
      return Number.isFinite(num) ? num : 0;
    });
    
    console.log(`変換後の型: ${typeof vector}`);
    console.log(`Array.isArray: ${Array.isArray(vector)}`);
    console.log(`長さ: ${vector.length}`);
    console.log(`先頭10要素: [${vector.slice(0, 10).map(v => v.toFixed(6)).join(', ')}]`);
    
    // 4. LanceDBに接続
    console.log('\n4. LanceDBに接続');
    const dbPath = path.resolve('.lancedb');
    console.log(`データベースパス: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // 5. テーブル作成（最小限のスキーマ）
    const tableName = 'minimal_fixed';
    console.log(`\n5. テーブル '${tableName}' を作成/オープン`);
    
    // テーブルが既に存在するか確認
    const tableExists = (await db.tableNames()).includes(tableName);
    console.log(`テーブル '${tableName}' の存在: ${tableExists}`);
    
    // 6. レコード作成
    const record: MinimalRecord = {
      id: testId,
      vector: vector,
      title: testTitle,
      content: testContent
    };
    
    let tbl;
    if (!tableExists) {
      // サンプルデータを使用してテーブルを作成
      console.log('サンプルデータでテーブルを新規作成します');
      tbl = await db.createTable(tableName, [record]);
      console.log(`テーブル '${tableName}' を作成しました`);
    } else {
      console.log('既存のテーブルを開きます');
      tbl = await db.openTable(tableName);
      console.log(`テーブル '${tableName}' を開きました`);
      
      // 既存テーブルにレコードを追加
      await tbl.add([record]);
      console.log(`既存テーブルにレコード '${testId}' を追加しました`);
    }
    
    // 7. 読み戻し検証
    console.log('\n7. 読み戻し検証');
    try {
      const results = await tbl.query().limit(1).toArray();
      console.log(`取得したレコード数: ${results.length}`);
      
      if (results.length > 0) {
        const record = results[0];
        console.log('最新のレコード:');
        console.log(`  ID: ${record.id}`);
        console.log(`  タイトル: ${record.title}`);
        
        // ベクトルの型を確認
        console.log(`  ベクトルの型: ${typeof record.vector}`);
        console.log(`  ベクトルはArray? ${Array.isArray(record.vector)}`);
        console.log(`  ベクトル長: ${record.vector?.length || 'N/A'}`);
        
        // ベクトルの内容をJSON文字列として表示
        console.log(`  ベクトル先頭5要素: ${JSON.stringify(record.vector).substring(0, 50)}...`);
        console.log(`  内容: ${record.content.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error('レコード読み取り中にエラーが発生しました:', error);
      throw error;
    }
    
    // 8. 検索の動作確認
    console.log('\n8. 検索の動作確認');
    try {
      const searchResults = await tbl.search(vector).limit(1).toArray();
      console.log(`検索結果数: ${searchResults.length}`);
      
      if (searchResults.length > 0) {
        const record = searchResults[0];
        console.log('検索結果:');
        console.log(`  ID: ${record.id}`);
        console.log(`  距離: ${record._distance}`);
        console.log(`  タイトル: ${record.title}`);
        console.log(`  内容: ${record.content.substring(0, 50)}...`);
      }
    } catch (error) {
      console.error('検索中にエラーが発生しました:', error);
      throw error;
    }
    
    console.log('\n=== テスト完了 ===');
    console.log(`テーブル '${tableName}' には現在 ${await tbl.countRows()} 行のデータがあります`);
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
