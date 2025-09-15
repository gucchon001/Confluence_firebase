# LanceDBパフォーマンスチューニングガイド

## 1. 概要

このドキュメントでは、LanceDBのパフォーマンスを最適化するためのベストプラクティスと手法について説明します。LanceDBはローカル環境で動作する軽量なベクトルデータベースですが、適切なチューニングを行うことで、大規模なデータセットでも高速な検索を実現できます。

## 2. インデックス最適化

### 2.1 インデックスタイプの選択

LanceDBでは、以下のインデックスタイプが利用可能です：

- **IVF-Flat**: 中規模のデータセット（数十万件）に適しています
- **HNSW**: 大規模なデータセット（数百万件以上）に適しています

```typescript
// IVF-Flatインデックスの作成
await tbl.createIndex({
  vectors: { vector: 768 },
  config: lancedb.index.ivfFlat({
    numPartitions: 256,  // データサイズに応じて調整
    distanceType: "cosine"
  })
});

// HNSWインデックスの作成
await tbl.createIndex({
  vectors: { vector: 768 },
  config: lancedb.index.hnsw({
    M: 16,  // グラフの次数（通常は12-48）
    efConstruction: 100,  // 構築時の探索幅（高いほど精度が上がるが時間がかかる）
    distanceType: "cosine"
  })
});
```

### 2.2 インデックスパラメータの調整

#### IVF-Flatのパラメータ

- **numPartitions**: データを分割するクラスタ数。データサイズの平方根程度が目安。
  - 小さいデータセット: 32-64
  - 中規模データセット: 128-256
  - 大規模データセット: 512-1024

#### HNSWのパラメータ

- **M**: グラフの次数。値が大きいほど精度が上がるが、メモリ使用量も増加。
  - 通常は16-32が良いバランス
  - メモリ制約がある場合は12
  - 高精度が必要な場合は48

- **efConstruction**: インデックス構築時の探索幅。値が大きいほど精度が上がるが、構築時間が長くなる。
  - 通常は100-200が良いバランス
  - 高速構築が必要な場合は40
  - 高精度が必要な場合は400

- **ef**: 検索時の探索幅。値が大きいほど精度が上がるが、検索時間が長くなる。
  - 通常は40-100が良いバランス
  - 高速検索が必要な場合は20
  - 高精度が必要な場合は200

```typescript
// 検索時のefパラメータを指定
const results = await tbl.search(vector, { ef: 50 }).limit(5).toArray();
```

## 3. データ管理の最適化

### 3.1 データの圧縮

LanceDBは内部でデータを圧縮して保存します。圧縮レベルを調整することで、ディスク使用量とパフォーマンスのバランスを取ることができます：

```typescript
// 高圧縮モードでテーブルを作成
const tbl = await db.createTable('compressed_table', data, {
  compression: 'zstd:7'  // 圧縮レベル（1-22、高いほど圧縮率が上がるが処理が遅くなる）
});
```

### 3.2 データのコンパクション

長期間の使用でデータファイルが断片化すると、パフォーマンスが低下する可能性があります。定期的にコンパクションを実行することで、パフォーマンスを維持できます：

```typescript
// データのコンパクション
await tbl.compactFiles();
```

### 3.3 バッチ処理

データの挿入や更新は、バッチで行うことでパフォーマンスが向上します：

```typescript
// バッチサイズ
const batchSize = 1000;

// データをバッチに分割
for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  await tbl.add(batch);
  
  // 明示的なガベージコレクション
  if (global.gc) {
    global.gc();
  }
}
```

## 4. メモリ管理

### 4.1 Node.jsのメモリ制限

Node.jsのデフォルトメモリ制限は、大規模なデータセットを扱う場合には不十分な場合があります。メモリ制限を引き上げることで、パフォーマンスを向上させることができます：

```bash
# メモリ制限を8GBに設定
node --max-old-space-size=8192 -r tsx/cjs src/scripts/your-script.ts
```

### 4.2 ストリーム処理

大量のデータを処理する場合は、ストリーム処理を使用してメモリ使用量を抑えることができます：

```typescript
import * as fs from 'fs';
import * as readline from 'readline';

async function processLargeFile(filePath) {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  const batchSize = 1000;
  let batch = [];
  
  for await (const line of rl) {
    const record = JSON.parse(line);
    batch.push(record);
    
    if (batch.length >= batchSize) {
      await processAndInsertBatch(batch);
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    await processAndInsertBatch(batch);
  }
}

async function processAndInsertBatch(batch) {
  // バッチを処理してLanceDBに挿入
  const processedBatch = await Promise.all(
    batch.map(async record => {
      const vector = await getEmbeddings(record.content);
      return {
        id: record.id,
        vector,
        title: record.title,
        content: record.content
      };
    })
  );
  
  await tbl.add(processedBatch);
}
```

## 5. クエリ最適化

### 5.1 検索パラメータの調整

```typescript
// 検索パラメータの調整
const results = await tbl.search(vector, {
  probeCount: 10,  // IVF-Flatで探索するクラスタ数
  ef: 50           // HNSWの探索幅
}).limit(5).toArray();
```

### 5.2 フィルタリングの最適化

フィルタリングを効率的に行うには、適切なインデックスを作成することが重要です：

```typescript
// スカラーフィールドにインデックスを作成
await tbl.createIndex({
  field: "space_key",
  config: lancedb.index.scalar()
});

// 複合フィルタリング
const results = await tbl.search(vector)
  .where(`space_key = 'TEST' AND chunk_index = 0`)
  .limit(5)
  .toArray();
```

### 5.3 プリフェッチとキャッシング

頻繁に使用されるクエリの結果をキャッシュすることで、パフォーマンスを向上させることができます：

```typescript
// キャッシュの実装
const cache = new Map();
const CACHE_TTL = 1000 * 60 * 5; // 5分

async function searchWithCache(query, vector, filters) {
  const cacheKey = JSON.stringify({ query, filters });
  const now = Date.now();
  
  if (cache.has(cacheKey)) {
    const { results, timestamp } = cache.get(cacheKey);
    
    // キャッシュが有効期限内であれば使用
    if (now - timestamp < CACHE_TTL) {
      return results;
    }
  }
  
  // 検索を実行
  const results = await performSearch(vector, filters);
  
  // キャッシュに保存
  cache.set(cacheKey, { results, timestamp: now });
  
  return results;
}
```

## 6. 分散処理

### 6.1 並列処理

複数のCPUコアを活用するために、並列処理を実装することができます：

```typescript
import { Worker } from 'worker_threads';

async function parallelProcessing(data, numWorkers = 4) {
  // データを分割
  const chunkSize = Math.ceil(data.length / numWorkers);
  const chunks = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  
  // ワーカーを作成して処理を分散
  const workers = chunks.map((chunk, index) => {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./worker.js', {
        workerData: { chunk, workerId: index }
      });
      
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', code => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  });
  
  // すべてのワーカーの結果を待機
  const results = await Promise.all(workers);
  
  return results.flat();
}
```

### 6.2 シャーディング

大規模なデータセットを複数のLanceDBテーブルに分割することで、パフォーマンスを向上させることができます：

```typescript
// シャードの作成
const numShards = 4;
const shards = [];

for (let i = 0; i < numShards; i++) {
  const shardName = `confluence_shard_${i}`;
  shards.push(await db.createTable(shardName, []));
}

// データをシャードに分散
for (const record of records) {
  // シャードキーを計算（例：IDのハッシュ値）
  const shardIndex = hashFunction(record.id) % numShards;
  await shards[shardIndex].add([record]);
}

// 検索時にすべてのシャードを並列に検索
async function searchAllShards(vector, limit) {
  const searchPromises = shards.map(shard => 
    shard.search(vector).limit(limit).toArray()
  );
  
  const shardResults = await Promise.all(searchPromises);
  
  // 結果をマージして再ランキング
  return mergeAndRank(shardResults.flat(), limit);
}
```

## 7. モニタリングとプロファイリング

### 7.1 パフォーマンスメトリクスの収集

```typescript
async function measurePerformance(operation, func) {
  const start = process.hrtime.bigint();
  const result = await func();
  const end = process.hrtime.bigint();
  
  const durationMs = Number(end - start) / 1000000;
  console.log(`${operation}: ${durationMs.toFixed(2)}ms`);
  
  return result;
}

// 使用例
const results = await measurePerformance('Vector Search', () => 
  tbl.search(vector).limit(5).toArray()
);
```

### 7.2 メモリ使用量の監視

```typescript
function logMemoryUsage() {
  const memoryUsage = process.memoryUsage();
  console.log('メモリ使用量:');
  console.log(`  RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)} MB`);
  console.log(`  ヒープ合計: ${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`);
  console.log(`  ヒープ使用: ${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`);
  console.log(`  外部: ${Math.round(memoryUsage.external / 1024 / 1024)} MB`);
}
```

## 8. ベストプラクティス

### 8.1 次元削減

高次元のベクトルは、次元削減技術を使用して低次元に変換することで、パフォーマンスを向上させることができます：

```typescript
// 次元削減の例（PCA）
// 注: 実際の実装にはML.jsなどのライブラリを使用することをお勧めします
function reduceDimensions(vectors, targetDim = 128) {
  // PCAなどの次元削減アルゴリズムを実装
  // ...
  return reducedVectors;
}
```

### 8.2 ベクトル正規化

ベクトルを正規化することで、コサイン類似度の計算が効率化されます：

```typescript
function normalizeVector(vector) {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
  return vector.map(val => val / norm);
}
```

### 8.3 クエリベクトルのキャッシング

頻繁に使用されるクエリのベクトルをキャッシュすることで、埋め込み生成のオーバーヘッドを削減できます：

```typescript
const vectorCache = new Map();
const VECTOR_CACHE_TTL = 1000 * 60 * 60; // 1時間

async function getCachedEmbedding(text) {
  const cacheKey = text;
  const now = Date.now();
  
  if (vectorCache.has(cacheKey)) {
    const { vector, timestamp } = vectorCache.get(cacheKey);
    
    if (now - timestamp < VECTOR_CACHE_TTL) {
      return vector;
    }
  }
  
  const vector = await getEmbeddings(text);
  vectorCache.set(cacheKey, { vector, timestamp: now });
  
  return vector;
}
```

## 9. まとめ

LanceDBのパフォーマンスを最適化するには、以下の点に注意してください：

1. データサイズと要件に合わせて適切なインデックスタイプとパラメータを選択する
2. バッチ処理とストリーム処理を活用してメモリ使用量を最適化する
3. 定期的にデータのコンパクションを実行する
4. クエリパラメータを調整して検索精度と速度のバランスを取る
5. キャッシングを活用して頻繁なクエリのパフォーマンスを向上させる
6. 大規模データセットでは並列処理やシャーディングを検討する
7. パフォーマンスメトリクスを収集して継続的に最適化を行う

これらの最適化手法を適用することで、LanceDBは大規模なデータセットでも高速で効率的なベクトル検索を実現できます。

## 10. 参考リソース

- [LanceDB 公式ドキュメント - Performance Tuning](https://lancedb.github.io/lancedb/guides/tuning_retrieval_performance/)
- [LanceDB 公式ドキュメント - Indexing](https://lancedb.github.io/lancedb/concepts/indexing/)
