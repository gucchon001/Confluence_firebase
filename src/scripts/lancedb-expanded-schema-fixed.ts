/**
 * LanceDB 拡張スキーマテスト（修正版）
 * 
 * このスクリプトは、LanceDBの拡張スキーマを検証します。
 * 実行方法: npx tsx src/scripts/lancedb-expanded-schema-fixed.ts <table_name>
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
  page_id: string; // スネークケースに統一
  chunk_index: number; // スネークケースに統一
  url: string;
  last_updated: string; // スネークケースに統一
}

async function main() {
  console.log('=== LanceDB 拡張スキーマテスト（修正版） ===');
  console.log(`Node.js: ${process.version}`);
  
  try {
    // コマンドライン引数からテーブル名を取得（指定がなければデフォルト値を使用）
    const tableName = process.argv[2] || 'expanded_schema_new';
    
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
      page_id: pageId,
      chunk_index: chunkIndex,
      url: `https://example.com/pages/${pageId}`,
      last_updated: new Date().toISOString()
    };
    
    let tbl;
    if (!tableExists) {
      // サンプルデータを使用してテーブルを作成
      console.log('サンプルデータでテーブルを新規作成します');
      tbl = await db.createTable(tableName, [expandedRecord as any]);
      console.log(`テーブル '${tableName}' を作成しました`);
    } else {
      console.log('既存のテーブルを開きます');
      tbl = await db.openTable(tableName);
      console.log(`テーブル '${tableName}' を開きました`);
      
      // 既存のスキーマを確認
      console.log('既存のテーブルスキーマを確認中...');
      
      // 既存テーブルにレコードを追加する前に、テーブルの最初のレコードを取得してスキーマを確認
      const sampleRecord = await tbl.query().limit(1).toArray();
      if (sampleRecord.length > 0) {
        console.log('既存レコードのフィールド:');
        Object.keys(sampleRecord[0]).forEach(key => {
          console.log(`  - ${key}`);
        });
        
        // 既存のスキーマに合わせてレコードを調整
        const adjustedRecord = {
          id: testId,
          vector: vector,
          title: testTitle,
          content: testContent,
          space_key: 'TEST',
          labels: ['テスト', '拡張スキーマ']
        };
        
        // 既存のスキーマに存在するフィールドのみを追加
        if ('page_id' in sampleRecord[0]) adjustedRecord['page_id'] = pageId;
        if ('pageId' in sampleRecord[0]) adjustedRecord['pageId'] = pageId;
        if ('chunk_index' in sampleRecord[0]) adjustedRecord['chunk_index'] = chunkIndex;
        if ('chunkIndex' in sampleRecord[0]) adjustedRecord['chunkIndex'] = chunkIndex;
        if ('url' in sampleRecord[0]) adjustedRecord['url'] = `https://example.com/pages/${pageId}`;
        if ('last_updated' in sampleRecord[0]) adjustedRecord['last_updated'] = new Date().toISOString();
        if ('lastUpdated' in sampleRecord[0]) adjustedRecord['lastUpdated'] = new Date().toISOString();
        
        console.log(`既存テーブルにレコード '${testId}' を追加します (スキーマ調整済み)`);
        await tbl.add([adjustedRecord]);
      } else {
        console.log('既存テーブルは空です。新しいレコードを追加します。');
        await tbl.add([expandedRecord]);
      }
      console.log(`レコード '${testId}' を追加しました`);
    }
    
    // 6. テーブル情報の確認
    console.log('\n6. テーブル情報の確認');
    const tableInfo = await tbl.countRows();
    console.log(`テーブル行数: ${tableInfo}`);
    
    // 7. 挿入したレコードの確認
    console.log('\n7. 挿入したレコードの確認');
    const results = await tbl.query().where(`id = '${testId}'`).toArray();
    
    if (results.length > 0) {
      const record = results[0];
      console.log('挿入したレコード:');
      console.log(`  ID: ${record.id}`);
      console.log(`  タイトル: ${record.title}`);
      console.log(`  スペースキー: ${record.space_key}`);
      
      // ラベルの配列を安全に表示
      if (record.labels && Array.isArray(record.labels)) {
        console.log(`  ラベル: ${JSON.stringify(record.labels)}`);
      } else {
        console.log(`  ラベル: ${record.labels}`);
      }
      
      // ページIDの表示（スネークケースとキャメルケースの両方に対応）
      if ('page_id' in record) console.log(`  ページID: ${record.page_id}`);
      if ('pageId' in record) console.log(`  ページID: ${record.pageId}`);
      
      // チャンクインデックスの表示（スネークケースとキャメルケースの両方に対応）
      if ('chunk_index' in record) console.log(`  チャンクインデックス: ${record.chunk_index}`);
      if ('chunkIndex' in record) console.log(`  チャンクインデックス: ${record.chunkIndex}`);
      
      if ('url' in record) console.log(`  URL: ${record.url}`);
      
      // 最終更新日時の表示（スネークケースとキャメルケースの両方に対応）
      if ('last_updated' in record) console.log(`  最終更新日時: ${record.last_updated}`);
      if ('lastUpdated' in record) console.log(`  最終更新日時: ${record.lastUpdated}`);
      
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
      
      // ラベルの配列を安全に表示
      if (record.labels && Array.isArray(record.labels)) {
        console.log(`  ラベル: ${JSON.stringify(record.labels)}`);
      } else {
        console.log(`  ラベル: ${record.labels}`);
      }
    }
    
    // 10. 複数レコードのバッチ挿入
    console.log('\n10. 複数レコードのバッチ挿入');
    const batchSize = 3;
    const batchRecords = [];
    
    for (let i = 0; i < batchSize; i++) {
      const batchPageId = `batch-page-${Date.now()}-${i}`;
      const batchChunkIndex = i;
      const batchId = `${batchPageId}-${batchChunkIndex}`;
      
      // 基本フィールド
      const batchRecord = {
        id: batchId,
        vector: Array(vectorDim).fill(0).map(() => Math.random()),
        title: `バッチレコード ${i + 1}`,
        content: `これはバッチ挿入テスト用のレコード ${i + 1} です。`,
        space_key: 'BATCH',
        labels: [`バッチ-${i + 1}`, 'テスト']
      };
      
      // 既存のスキーマに合わせて拡張フィールドを追加
      if (results.length > 0) {
        const sampleRecord = results[0];
        if ('page_id' in sampleRecord) batchRecord['page_id'] = batchPageId;
        if ('pageId' in sampleRecord) batchRecord['pageId'] = batchPageId;
        if ('chunk_index' in sampleRecord) batchRecord['chunk_index'] = batchChunkIndex;
        if ('chunkIndex' in sampleRecord) batchRecord['chunkIndex'] = batchChunkIndex;
        if ('url' in sampleRecord) batchRecord['url'] = `https://example.com/pages/${batchPageId}`;
        if ('last_updated' in sampleRecord) batchRecord['last_updated'] = new Date().toISOString();
        if ('lastUpdated' in sampleRecord) batchRecord['lastUpdated'] = new Date().toISOString();
      }
      
      batchRecords.push(batchRecord);
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