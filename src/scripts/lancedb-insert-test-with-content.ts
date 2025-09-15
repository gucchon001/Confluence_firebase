/**
 * LanceDBにコンテンツフィールドを含むテストデータを挿入するスクリプト
 * Usage: npx tsx src/scripts/lancedb-insert-test-with-content.ts
 */
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';

async function main() {
  try {
    console.log('=== LanceDBコンテンツ付きテストデータ挿入ツール ===');
    
    // 1. LanceDBに接続
    console.log('\n1. LanceDBに接続中...');
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    console.log(`データベースパス: ${dbPath}`);
    const db = await lancedb.connect(dbPath);
    
    // 2. テーブル一覧を取得
    console.log('\n2. テーブル一覧の取得');
    const tableNames = await db.tableNames();
    console.log(`利用可能なテーブル: ${tableNames.join(', ')}`);
    
    const tableName = 'test_content';
    
    // 3. テーブルを開くか作成する
    console.log(`\n3. テーブル '${tableName}' を開く/作成`);
    let tbl;
    
    // テストデータを作成（ベクトルは小さくする）
    const testData = [
      {
        id: 'test-1',
        vector: new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1)),
        space_key: 'TEST',
        title: 'テスト文書1',
        labels: ['テスト', 'サンプル'],
        content: 'これはテスト用のコンテンツです。検索テストに使用します。'
      }
    ];
    
    // ベクトルを正規化
    testData.forEach(record => {
      const norm = Math.sqrt(record.vector.reduce((sum, val) => sum + val * val, 0)) || 1;
      record.vector = record.vector.map(val => val / norm);
    });
    
    if (tableNames.includes(tableName)) {
      console.log(`テーブル '${tableName}' が存在します。削除して再作成します...`);
      await db.dropTable(tableName);
    }
    
    console.log(`テーブル '${tableName}' を作成します...`);
    // テーブルを作成
    tbl = await db.createTable(tableName, testData);
    console.log(`テーブル '${tableName}' を作成しました。`);
    
    // 4. テストデータを作成
    console.log('\n4. テストデータの作成');
    const testRecords = [
      {
        id: 'test-account-1',
        vector: new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1 + 1)),
        space_key: 'TEST',
        title: 'テスト環境アカウント情報',
        labels: ['テスト', 'アカウント', '環境'],
        content: 'テスト環境で使用するアカウント情報です。ユーザー名とパスワードの管理方法について説明します。'
      },
      {
        id: 'test-word-1',
        vector: new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1 + 2)),
        space_key: 'TEST',
        title: 'ワード・ディフィニション用語集',
        labels: ['用語', 'ワード', '定義'],
        content: 'プロジェクトで使用する用語の定義集です。ワードの意味を明確にし、チーム内での認識を統一します。'
      },
      {
        id: 'test-permission-1',
        vector: new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1 + 3)),
        space_key: 'TEST',
        title: '権限管理マニュアル',
        labels: ['権限', '管理', 'セキュリティ'],
        content: 'システムの権限管理に関するマニュアルです。ロールベースのアクセス制御とセキュリティポリシーについて解説します。'
      }
    ];
    
    // ベクトルを正規化
    testRecords.forEach(record => {
      const norm = Math.sqrt(record.vector.reduce((sum, val) => sum + val * val, 0)) || 1;
      record.vector = record.vector.map(val => val / norm);
    });
    
    // 5. データを挿入
    console.log('\n5. テストデータの挿入');
    for (const record of testRecords) {
      await tbl.add([record]);
      console.log(`レコード '${record.id}' を挿入しました。`);
    }
    console.log(`${testRecords.length}件のテストデータを挿入しました。`);
    
    // 6. 行数を確認
    const rowCount = await tbl.countRows();
    console.log(`\n6. テーブルの行数: ${rowCount}`);
    
    // 7. テスト検索の実行
    console.log('\n7. テスト検索の実行');
    const testQueries = ['テスト', 'アカウント', 'ワード', '権限', 'セキュリティ'];
    
    for (const query of testQueries) {
      console.log(`\n検索クエリ: "${query}"`);
      
      // 埋め込みベクトルの生成（テスト用）
      let queryVector;
      
      // 簡易的なキーワードマッチング
      if (query.includes('テスト') || query.includes('環境')) {
        queryVector = new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1 + 1));
      } else if (query.includes('ワード') || query.includes('用語')) {
        queryVector = new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1 + 2));
      } else if (query.includes('権限') || query.includes('セキュリティ')) {
        queryVector = new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1 + 3));
      } else {
        queryVector = new Array(10).fill(0).map((_, i) => Math.sin(i * 0.1));
      }
      
      // ベクトルを正規化
      const queryNorm = Math.sqrt(queryVector.reduce((sum, val) => sum + val * val, 0)) || 1;
      const normalizedQueryVector = queryVector.map(val => val / queryNorm);
      
      console.log('検索実行中...');
      const searchResults = await tbl.search(normalizedQueryVector)
        .limit(5)
        .execute();
      
      // 結果を配列として取得
      const resultArray: any[] = [];
      
      // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
      const searchBatchData = await searchResults.promisedInner;
      
      if (searchBatchData && searchBatchData.batches && searchBatchData.batches.length > 0) {
        for (const batch of searchBatchData.batches) {
          if (batch && batch.numRows > 0) {
            // バッチから行データを抽出
            for (let i = 0; i < batch.numRows; i++) {
              const row: any = {};
              
              // 各列のデータを取得
              for (const fieldName in batch.schema.fields) {
                if (Object.prototype.hasOwnProperty.call(batch.schema.fields, fieldName)) {
                  const field = batch.schema.fields[fieldName];
                  if (field && field.name) {
                    row[field.name] = batch.getChild(field.name)?.get(i);
                  }
                }
              }
              
              // 距離スコアを追加
              row._distance = batch.getChild('_distance')?.get(i) || 0;
              resultArray.push(row);
            }
          }
        }
      }
      
      if (resultArray.length === 0) {
        console.log(`"${query}" の検索結果: 0件`);
      } else {
        console.log(`"${query}" の検索結果: ${resultArray.length}件`);
        resultArray.forEach((result, i) => {
          console.log(`\n[結果 ${i + 1}] スコア: ${result._distance?.toFixed(6) || 'N/A'}`);
          console.log(`ID: ${result.id || 'N/A'}`);
          console.log(`タイトル: ${result.title || 'N/A'}`);
          if (result.labels && result.labels.length > 0) {
            console.log(`ラベル: ${result.labels.join(', ')}`);
          }
          console.log(`コンテンツ: ${result.content || 'N/A'}`);
        });
      }
    }
    
    // 8. 文字列フィルタを使用した検索
    console.log('\n8. 文字列フィルタを使用した検索');
    
    // ダミーベクトルで検索（フィルタのみで検索）
    const dummyVector = new Array(10).fill(0.1);
    
    // タイトルでフィルタリング
    console.log('\nタイトルでフィルタリング: "title LIKE \'%アカウント%\'"');
    const titleFilterResults = await tbl.search(dummyVector)
      .where("title LIKE '%アカウント%'")
      .limit(5)
      .execute();
    
    // 結果を配列として取得
    const titleFilterArray: any[] = [];
    
    // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
    const titleFilterBatchData = await titleFilterResults.promisedInner;
    
    if (titleFilterBatchData && titleFilterBatchData.batches && titleFilterBatchData.batches.length > 0) {
      for (const batch of titleFilterBatchData.batches) {
        if (batch && batch.numRows > 0) {
          // バッチから行データを抽出
          for (let i = 0; i < batch.numRows; i++) {
            const row: any = {};
            
            // 各列のデータを取得
            for (const fieldName in batch.schema.fields) {
              if (Object.prototype.hasOwnProperty.call(batch.schema.fields, fieldName)) {
                const field = batch.schema.fields[fieldName];
                if (field && field.name) {
                  row[field.name] = batch.getChild(field.name)?.get(i);
                }
              }
            }
            
            titleFilterArray.push(row);
          }
        }
      }
    }
    
    if (titleFilterArray.length === 0) {
      console.log('タイトルフィルタの検索結果: 0件');
    } else {
      console.log(`タイトルフィルタの検索結果: ${titleFilterArray.length}件`);
      titleFilterArray.forEach((result, i) => {
        console.log(`\n[結果 ${i + 1}]`);
        console.log(`ID: ${result.id || 'N/A'}`);
        console.log(`タイトル: ${result.title || 'N/A'}`);
      });
    }
    
    // コンテンツでフィルタリング
    console.log('\nコンテンツでフィルタリング: "content LIKE \'%セキュリティ%\'"');
    const contentFilterResults = await tbl.search(dummyVector)
      .where("content LIKE '%セキュリティ%'")
      .limit(5)
      .execute();
    
    // 結果を配列として取得
    const contentFilterArray: any[] = [];
    
    // @ts-ignore - promisedInnerがプライベートプロパティだが、これを使用する
    const contentFilterBatchData = await contentFilterResults.promisedInner;
    
    if (contentFilterBatchData && contentFilterBatchData.batches && contentFilterBatchData.batches.length > 0) {
      for (const batch of contentFilterBatchData.batches) {
        if (batch && batch.numRows > 0) {
          // バッチから行データを抽出
          for (let i = 0; i < batch.numRows; i++) {
            const row: any = {};
            
            // 各列のデータを取得
            for (const fieldName in batch.schema.fields) {
              if (Object.prototype.hasOwnProperty.call(batch.schema.fields, fieldName)) {
                const field = batch.schema.fields[fieldName];
                if (field && field.name) {
                  row[field.name] = batch.getChild(field.name)?.get(i);
                }
              }
            }
            
            contentFilterArray.push(row);
          }
        }
      }
    }
    
    if (contentFilterArray.length === 0) {
      console.log('コンテンツフィルタの検索結果: 0件');
    } else {
      console.log(`コンテンツフィルタの検索結果: ${contentFilterArray.length}件`);
      contentFilterArray.forEach((result, i) => {
        console.log(`\n[結果 ${i + 1}]`);
        console.log(`ID: ${result.id || 'N/A'}`);
        console.log(`タイトル: ${result.title || 'N/A'}`);
        console.log(`コンテンツ: ${result.content || 'N/A'}`);
      });
    }
    
    console.log('\nLanceDBコンテンツ付きテストデータ挿入完了');
  } catch (error: any) {
    console.error('エラーが発生しました:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
