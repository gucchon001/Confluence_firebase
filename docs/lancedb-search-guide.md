# LanceDBを使用したベクトル検索ガイド

## 1. 概要

このドキュメントでは、LanceDBを使用したベクトル検索の実装方法について説明します。LanceDBは軽量で高速なベクトルデータベースであり、ローカル環境での開発やテストに適しています。

## 2. 検索の基本

### 2.1 距離メトリクス

LanceDBでは、以下の距離メトリクスがサポートされています：

- `L2`（ユークリッド距離）- デフォルト
- `cosine`（コサイン類似度）
- `dot`（内積）
- `hamming`（ハミング距離）- バイナリベクトル用

```typescript
// コサイン類似度を使用した検索
const results = await tbl.search(vector)
  .distanceType("cosine")
  .limit(5)
  .toArray();
```

### 2.2 完全検索（kNN）

最も基本的な検索方法は、すべてのベクトルをスキャンして最も近いk個のベクトルを返す完全検索（kNN）です：

```typescript
// 最も近い5件を検索
const results = await tbl.search(vector).limit(5).toArray();
```

### 2.3 近似最近傍検索（ANN）

大規模なデータセットでは、インデックスを作成して近似最近傍検索（ANN）を使用することで検索速度を向上させることができます：

```typescript
// インデックスの作成
await tbl.createIndex({
  vectors: { vector: 384 },
  config: lancedb.index.ivfFlat({
    numPartitions: 256,
    distanceType: "cosine"
  })
});

// インデックスを使用した検索
const results = await tbl.search(vector).limit(5).toArray();
```

## 3. フィルタリング

### 3.1 基本的なフィルタリング

検索結果をフィルタリングするには、`where`メソッドを使用します：

```typescript
// スペースキーでフィルタリング
const results = await tbl.search(vector)
  .where(`space_key = 'TEST'`)
  .limit(5)
  .toArray();
```

### 3.2 複合フィルタリング

複数の条件を組み合わせることも可能です：

```typescript
// 複合フィルタリング
const results = await tbl.search(vector)
  .where(`space_key = 'TEST' AND chunk_index = 0`)
  .limit(5)
  .toArray();
```

## 4. ハイブリッド検索（本プロジェクトの実装方針）

中核は `src/lib/lancedb-search-client.ts` の `searchLanceDB` で実装されています。概要:

- 埋め込み（384次元）生成、キーワード抽出、LanceDB接続を並列実行
- 候補取得: ベクトル / キーワード（LIKE）/ BM25（Lunr）/ タイトル厳格一致
- 早期ラベル除外（議事録/アーカイブ/スコープ外 等）
- スコア付与: `calculateKeywordScore` / `calculateLabelScore` / `calculateHybridScore`
- 重複除去（タイトル）→ 表示用フィールド整形 → 上位 `topK` 返却

パラメータ例: `{ query, topK, useLunrIndex, labelFilters, tableName }`

Lunr未初期化時はLIKEにフォールバックします。

### 4.1 フィルタリングによるハイブリッド検索

```typescript
// ベクトル検索 + テキストフィルタリング
const results = await tbl.search(vector)
  .where(`content LIKE '%検索キーワード%'`)
  .limit(5)
  .toArray();
```

### 4.2 JavaScriptによる後処理

LanceDBのJavaScript APIでは、フルテキスト検索のネイティブサポートが限られているため、検索結果をJavaScriptで後処理する方法も有効です：

```typescript
// 全レコードを取得
const allRecords = await tbl.query().toArray();

// JavaScriptでフィルタリング
const filteredResults = allRecords.filter(record => 
  record.content.includes('検索キーワード')
);
```

## 5. 距離範囲検索

特定の距離範囲内のベクトルを検索することも可能です：

```typescript
// 距離が0.1から0.5の範囲内のベクトルを検索
const results = await tbl.search(vector)
  .distanceRange(0.1, 0.5)
  .toArray();
```

## 6. 検索結果の出力

### 6.1 配列として出力

```typescript
const results = await tbl.search(vector).limit(5).toArray();
```

検索結果には、元のレコードのすべてのフィールドに加えて、`_distance`フィールドが含まれます。これは、クエリベクトルと検索結果のベクトル間の距離を表します。

### 6.2 検索結果の処理

```typescript
// 検索結果の処理
results.forEach(record => {
  console.log(`ID: ${record.id}`);
  console.log(`距離: ${record._distance}`);
  console.log(`タイトル: ${record.title}`);
  console.log(`内容: ${record.content.substring(0, 50)}...`);
});
```

## 7. パフォーマンス最適化

### 7.1 インデックスの最適化

インデックスパラメータを調整することで、検索パフォーマンスを向上させることができます：

```typescript
// インデックスの最適化
await tbl.createIndex({
  vectors: { vector: 384 },
  config: lancedb.index.hnsw({
    M: 16,
    efConstruction: 100,
    distanceType: "cosine"
  })
});
```

### 7.2 バッチ処理

大量のデータを扱う場合は、バッチ処理を検討してください：

```typescript
// バッチサイズ
const batchSize = 10;

// データをバッチに分割
for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  await tbl.add(batch);
}
```

## 8. 実装例

### 8.1 基本的な検索API

```typescript
import { NextRequest } from 'next/server';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../../lib/embeddings';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query: string = body?.query || '';
    const topK: number = body?.topK || 5;
    const filters: Record<string, string | string[]> | undefined = body?.filters;
    
    if (!query) return new Response(JSON.stringify({ error: 'query is required' }), { status: 400 });

    // 1. クエリを埋め込みベクトルに変換
    const vec = await getEmbeddings(query);
    
    // 2. LanceDBに接続
    const dbPath = path.resolve(process.cwd(), '.lancedb');
    const db = await lancedb.connect(dbPath);
    const tbl = await db.openTable('confluence');
    
    // 3. 検索クエリを構築
    let q = tbl.search(vec).limit(topK);
    
    // フィルタリングを適用
    if (filters) {
      const clauses: string[] = [];
      for (const [k, v] of Object.entries(filters)) {
        if (Array.isArray(v)) {
          if (v.length > 0) {
            clauses.push(`${k} IN (${v.map((x) => `'${x}'`).join(',')})`);
          }
        } else if (v) {
          clauses.push(`${k} = '${v}'`);
        }
      }
      if (clauses.length) {
        q = q.where(clauses.join(' AND '));
      }
    }
    
    // 4. 検索実行
    const results = await q.toArray();
    
    // 5. レスポンス返却
    return new Response(JSON.stringify({ results }), { 
      headers: { 'Content-Type': 'application/json' } 
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500 });
  }
}
```

### 8.2 コマンドライン検索ツール

```typescript
import 'dotenv/config';
import * as lancedb from '@lancedb/lancedb';
import * as path from 'path';
import { getEmbeddings } from '../lib/embeddings';

async function main() {
  const queryText = process.argv[2];
  if (!queryText) {
    console.error('Usage: npx tsx src/scripts/lancedb-search.ts "your search query"');
    process.exit(1);
  }

  console.log(`検索クエリ: "${queryText}"`);

  // 埋め込みベクトルを生成
  const queryVector = await getEmbeddings(queryText);
  
  // LanceDBに接続
  const dbPath = path.resolve('.lancedb');
  const db = await lancedb.connect(dbPath);
  const tbl = await db.openTable('confluence');
  
  // 検索を実行
  const results = await tbl.search(queryVector).limit(5).toArray();
  
  // 結果を表示
  console.log('検索結果:');
  results.forEach((r, index) => {
    console.log(`--- 結果 ${index + 1} ---`);
    console.log(`  ID: ${r.id}`);
    console.log(`  距離: ${r._distance}`);
    console.log(`  タイトル: ${r.title}`);
    console.log(`  内容: ${r.content?.substring(0, 100)}...`);
  });
}

main().catch(console.error);
```

## 9. 注意点と既知の問題

### 9.1 ベクトル型の扱い

LanceDBから読み戻したベクトルは標準的なJavaScript配列ではなく、特殊なオブジェクトとして返されます：

- `Array.isArray(record.vector)`は`false`を返す
- `record.vector.slice()`や`record.vector.map()`などの配列メソッドは使用できない
- ベクトルの内容を確認するには`JSON.stringify(record.vector)`を使用する

### 9.2 ラベル配列の検索制限

LanceDBでは、配列型のフィールド（例：`labels`）に対するLIKE検索が直接サポートされていません。代わりに、以下のアプローチを使用してください：

```typescript
// 全レコードを取得してJavaScriptでフィルタリング
const allRecords = await tbl.query().toArray();
const filteredByLabel = allRecords.filter(record => 
  Array.isArray(record.labels) && 
  record.labels.some(label => label.includes('テスト'))
);
```

## 10. 参考リソース

- [LanceDB 公式ドキュメント - Vector Search](https://lancedb.github.io/lancedb/search/)
- [LanceDB JavaScript API リファレンス](https://lancedb.github.io/lancedb/api-reference/js/lancedb/)
