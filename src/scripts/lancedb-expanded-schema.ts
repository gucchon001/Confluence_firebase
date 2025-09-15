/**
 * LanceDB 拡張スキーマテスト
 * 
 * このスクリプトは、LanceDBの拡張スキーマを検証します。
 * 実行方法: npx tsx src/scripts/lancedb-expanded-schema.ts
 */
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

// 拡張スキーマ定義
interface ExpandedRecord {
  id: string;
  vector: number[];
  title: string;
  content: string;
  space_key: string;
  labels: string[];
  pageId: string;
  chunkIndex: number;
  url: string;
  lastUpdated: string;
}

async function main() {
  console.log('=== LanceDB 拡張スキーマテスト ===');
  console.log(`Node.js: ${process.version}`);
  
  try {
    // 1. テストデータの準備
    console.log('\n1. テストデータの準備');
    const pageId = `page-${Date.now()}`;
    const chunkIndex = 0;
    const testId = `${pageId}-${chunkIndex}`;
    const testTitle = '拡張スキーマテスト文書';
    const testContent = 'これはLanceDBの拡張スキーマテスト用の文書内容です。';
    
    console.log(`ID: ${testId}`);
    console.log(`ページID: ${pageId}`);
    console.log(`チャンクインデックス: ${chunkIndex}`);
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
    const tableName = 'expanded_schema';
    console.log(`\n4. テーブル '${tableName}' を作成/オープン`);
    
    // テーブルが既に存在するか確認
    const tableExists = (await db.tableNames()).includes(tableName);
    console.log(`テーブル '${tableName}' の存在: ${tableExists}`);
    
    // 5. 拡張レコード作成
    const expandedRecord: ExpandedRecord = {
      id: testId,
      vector: vector,
      title: testTitle,
      content: testContent,
      space_key: 'TEST',
      labels: ['テスト', '拡張スキーマ'],
      pageId: pageId,
      chunkIndex: chunkIndex,
      url: `https://example.com/pages/${pageId}`,
      lastUpdated: new Date().toISOString()
    };
    
    let tbl;
    if (!tableExists) {
      // サンプルデータを使用してテーブルを作成
      console.log('サンプルデータでテーブルを新規作成します');
      tbl = await db.createTable(tableName, [expandedRecord]);
      console.log(`テーブル '${tableName}' を作成しました`);
    } else {
      console.log('既存のテーブルを開きます');
      tbl = await db.openTable(tableName);
      console.log(`テーブル '${tableName}' を開きました`);
      
      // 既存テーブルにレコードを追加
      await tbl.add([expandedRecord]);
      console.log(`既存テーブルにレコード '${testId}' を追加しました`);
    }
    
    // 6. テーブルスキーマの確認
    console.log('\n6. テーブルスキーマの確認');
    console.log('テーブルスキーマ:');
    console.log(JSON.stringify(tbl.schema, null, 2));
    
    // 7. 挿入したレコードの確認
    console.log('\n7. 挿入したレコードの確認');
    const results = await tbl.query().where(`id = '${testId}'`).toArray();
    
    if (results.length > 0) {
      const record = results[0];
      console.log('挿入したレコード:');
      console.log(`  ID: ${record.id}`);
      console.log(`  タイトル: ${record.title}`);
      console.log(`  スペースキー: ${record.space_key}`);
      console.log(`  ラベル: ${JSON.stringify(record.labels)}`);
      console.log(`  ページID: ${record.pageId}`);
      console.log(`  チャンクインデックス: ${record.chunkIndex}`);
      console.log(`  URL: ${record.url}`);
      console.log(`  最終更新日時: ${record.lastUpdated}`);
      console.log(`  内容: ${record.content.substring(0, 50)}...`);
    } else {
      console.log('レコードが見つかりません');
    }
    
    // 8. フィルタリングテスト
    console.log('\n8. フィルタリングテスト');
    
    // スペースキーでフィルタリング
    console.log('スペースキーでフィルタリング:');
    const spaceResults = await tbl.query().where(`space_key = 'TEST'`).toArray();
    console.log(`  結果件数: ${spaceResults.length}`);
    
    // ラベルでフィルタリング
    console.log('ラベルでフィルタリング:');
    const labelResults = await tbl.query().where(`labels LIKE '%テスト%'`).toArray();
    console.log(`  結果件数: ${labelResults.length}`);
    
    // 複合フィルタリング
    console.log('複合フィルタリング:');
    const complexResults = await tbl.query().where(`space_key = 'TEST' AND chunkIndex = 0`).toArray();
    console.log(`  結果件数: ${complexResults.length}`);
    
    // 9. 検索テスト
    console.log('\n9. 検索テスト');
    const searchResults = await tbl.search(vector).limit(5).toArray();
    console.log(`検索結果数: ${searchResults.length}`);
    
    if (searchResults.length > 0) {
      const record = searchResults[0];
      console.log('検索結果:');
      console.log(`  ID: ${record.id}`);
      console.log(`  距離: ${record._distance}`);
      console.log(`  タイトル: ${record.title}`);
      console.log(`  スペースキー: ${record.space_key}`);
      console.log(`  ラベル: ${JSON.stringify(record.labels)}`);
    }
    
    // 10. 複数レコードのバッチ挿入
    console.log('\n10. 複数レコードのバッチ挿入');
    const batchSize = 3;
    const batchRecords: ExpandedRecord[] = [];
    
    for (let i = 0; i < batchSize; i++) {
      const batchPageId = `batch-page-${Date.now()}`;
      const batchChunkIndex = i;
      const batchId = `${batchPageId}-${batchChunkIndex}`;
      
      batchRecords.push({
        id: batchId,
        vector: Array(vectorDim).fill(0).map(() => Math.random()),
        title: `バッチレコード ${i + 1}`,
        content: `これはバッチ挿入テスト用のレコード ${i + 1} です。`,
        space_key: 'BATCH',
        labels: ['バッチ', `テスト-${i + 1}`],
        pageId: batchPageId,
        chunkIndex: batchChunkIndex,
        url: `https://example.com/pages/${batchPageId}`,
        lastUpdated: new Date().toISOString()
      });
    }
    
    console.log(`${batchRecords.length}件のバッチレコードを挿入します`);
    await tbl.add(batchRecords);
    console.log('バッチ挿入が完了しました');
    
    // バッチ挿入結果の確認
    const batchResults = await tbl.query().where(`space_key = 'BATCH'`).toArray();
    console.log(`バッチ挿入結果: ${batchResults.length}件のレコードが見つかりました`);
    
    console.log('\n=== テスト完了 ===');
    console.log(`テーブル '${tableName}' には現在 ${await tbl.countRows()} 行のデータがあります`);
    
  } catch (error) {
    console.error('テスト実行中にエラーが発生しました:', error);
    process.exit(1);
  }
}

main();
