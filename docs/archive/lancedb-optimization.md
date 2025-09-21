# LanceDBの最適化ガイド

このドキュメントでは、LanceDBを使用する際のパフォーマンス最適化とメモリ使用量の削減方法について説明します。

## 目次

1. [Lance形式の特徴](#lance形式の特徴)
2. [メモリ使用量の最適化](#メモリ使用量の最適化)
3. [バッチ処理の実装](#バッチ処理の実装)
4. [ストリーム処理の実装](#ストリーム処理の実装)
5. [データフラグメントの最適化](#データフラグメントの最適化)
6. [検索パラメータの最適化](#検索パラメータの最適化)

## Lance形式の特徴

Lance形式は、機械学習やAIアプリケーション向けに最適化されたモダンなカラムナー形式のデータフォーマットです。以下の特徴があります：

- **高性能ランダムアクセス**: Parquetと比較して100倍高速なランダムアクセスパターン
- **ゼロコピーデータ進化**: データセット全体を書き直すことなく、カラムデータの追加、削除、更新が可能
- **マルチモーダルデータ**: テキスト、画像、動画、ドキュメント、埋め込みなどを効率的に保存
- **ベクトル検索**: IVF-PQ、IVF-SQ、HNSWなどのアルゴリズムを使用した高速な最近傍検索
- **全文検索**: 転置インデックス、Ngramインデックス、トークナイザーを使用した高速テキスト検索
- **行レベルトランザクション**: 行レベルの競合解決によるACIDトランザクション

## メモリ使用量の最適化

LanceDBを使用する際のメモリ使用量を最適化するためのテクニックを紹介します。

### 1. データの分割処理

大量のデータを一度に処理するのではなく、小さなバッチに分割して処理することで、メモリ使用量を削減できます。

```typescript
// バッチサイズを設定
const batchSize = 100;

// データを分割して処理
for (let i = 0; i < data.length; i += batchSize) {
  const batch = data.slice(i, i + batchSize);
  await processData(batch);
}
```

### 2. 不要なデータの削除

処理が完了したデータは、できるだけ早く解放することでメモリ使用量を削減できます。

```typescript
async function processLargeDataset(data) {
  const results = [];
  
  for (const item of data) {
    const result = await processItem(item);
    results.push(result);
    
    // 処理済みのデータを削除
    delete item.largeProperty;
  }
  
  return results;
}
```

### 3. Node.jsのメモリ制限の調整

Node.jsのメモリ制限を調整することで、大量のデータを処理できるようになります。

```bash
# メモリ制限を8GBに設定
node --max-old-space-size=8192 script.js
```

### 4. ガベージコレクションの明示的な実行

大量のメモリを使用する操作の後に、明示的にガベージコレクションを実行することで、メモリを解放できます。

```typescript
// --expose-gc オプションを指定して実行する必要があります
if (global.gc) {
  console.log('メモリを解放中...');
  global.gc();
}
```

## バッチ処理の実装

大量のデータをLanceDBに挿入する際は、バッチ処理を実装することで効率的に処理できます。

```typescript
async function insertDataInBatches(tbl, data, batchSize = 100) {
  console.log(`${data.length}件のデータを${Math.ceil(data.length / batchSize)}バッチに分けて処理します。`);
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    console.log(`バッチ ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)} を処理中...`);
    
    try {
      await tbl.add(batch);
      console.log(`バッチ ${Math.floor(i / batchSize) + 1} の処理が完了しました。`);
    } catch (error) {
      console.error(`バッチ ${Math.floor(i / batchSize) + 1} の処理中にエラーが発生しました:`, error);
    }
    
    // メモリを解放
    if (global.gc) {
      global.gc();
    }
  }
}
```

## ストリーム処理の実装

大量のデータを処理する場合は、ストリーム処理を実装することでメモリ使用量を削減できます。

### 1. ファイルの読み込み

```typescript
import * as fs from 'fs';
import * as readline from 'readline';

async function processLargeFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  const results = [];
  
  for await (const line of rl) {
    // 各行を処理
    const result = await processLine(line);
    results.push(result);
  }
  
  return results;
}
```

### 2. データの変換

```typescript
import { Transform } from 'stream';

function transformData() {
  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      try {
        const transformedChunk = processChunk(chunk);
        callback(null, transformedChunk);
      } catch (error) {
        callback(error);
      }
    }
  });
}
```

### 3. LanceDBへの書き込み

LanceDBは現在、ストリームベースのAPIを直接サポートしていませんが、バッチ処理と組み合わせることで効率的に処理できます。

```typescript
async function streamProcessAndInsert(filePath, tbl, batchSize = 100) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  let batch = [];
  let count = 0;
  
  for await (const line of rl) {
    try {
      const record = JSON.parse(line);
      batch.push(record);
      count++;
      
      if (batch.length >= batchSize) {
        await tbl.add(batch);
        console.log(`${count}件のレコードを処理しました。`);
        batch = [];
        
        // メモリを解放
        if (global.gc) {
          global.gc();
        }
      }
    } catch (error) {
      console.error('レコードの処理中にエラーが発生しました:', error);
    }
  }
  
  // 残りのバッチを処理
  if (batch.length > 0) {
    await tbl.add(batch);
    console.log(`${count}件のレコードを処理しました。`);
  }
}
```

## データフラグメントの最適化

LanceDBでは、頻繁な小規模な書き込みによりファイルの断片化が発生し、読み取りパフォーマンスが低下する可能性があります。`compact_files`メソッドを使用して、小さなデータフラグメントを統合し、より効率的なファイルに再編成することができます。

```typescript
async function optimizeTable(tbl) {
  console.log('テーブルを最適化中...');
  
  try {
    await tbl.compact_files();
    console.log('テーブルの最適化が完了しました。');
  } catch (error) {
    console.error('テーブルの最適化中にエラーが発生しました:', error);
  }
}
```

## 検索パラメータの最適化

LanceDBでの検索パフォーマンスを最適化するためのテクニックを紹介します。

### 1. 適切な距離メトリックの選択

用途に応じて適切な距離メトリックを選択することで、検索精度を向上させることができます。

```typescript
// L2距離（ユークリッド距離）
const results = await tbl.search(queryVector)
  .metricType('l2')
  .limit(10)
  .execute();

// コサイン類似度
const results = await tbl.search(queryVector)
  .metricType('cosine')
  .limit(10)
  .execute();

// ドット積
const results = await tbl.search(queryVector)
  .metricType('dot')
  .limit(10)
  .execute();
```

### 2. インデックスの作成

頻繁に検索を行う場合は、インデックスを作成することで検索パフォーマンスを向上させることができます。

```typescript
// IVFインデックスの作成
await tbl.createIndex({
  type: 'IVF',
  numLists: 100
});

// HNSWインデックスの作成
await tbl.createIndex({
  type: 'HNSW',
  numNeighbors: 32,
  efConstruction: 100
});
```

### 3. フィルタリングの最適化

検索結果をフィルタリングする場合は、可能な限り早い段階でフィルタリングを行うことで、処理するデータ量を削減できます。

```typescript
// フィルタリングを含む検索
const results = await tbl.search(queryVector)
  .where('category = "electronics"')
  .limit(10)
  .execute();
```

### 4. 検索結果の制限

必要な数の結果だけを取得することで、メモリ使用量と処理時間を削減できます。

```typescript
// 上位10件の結果のみを取得
const results = await tbl.search(queryVector)
  .limit(10)
  .execute();
```

## 参考リソース

- [Lance公式ドキュメント](https://lancedb.github.io/lance/)
- [LanceDBガイド：テーブル/ベクトル検索](https://tensorflow.classcat.com/2023/09/22/lancedb-guides-tables-and-search/)
- [LanceDB基本機能](https://tensorflow.classcat.com/2023/09/21/lancedb-basic/)
