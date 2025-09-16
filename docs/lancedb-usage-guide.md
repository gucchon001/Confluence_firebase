# LanceDB 使用ガイド

## 1. 概要

このドキュメントでは、Confluence仕様書要約チャットボットにおけるLanceDBの使用方法とベストプラクティスについて説明します。LanceDBは、ローカルファイルシステム上で動作する高速なベクトルデータベースであり、埋め込みベクトルとメタデータを効率的に保存・検索するために使用されています。

## 2. 環境設定

### 2.1 依存関係

```json
{
  "dependencies": {
    "@lancedb/lancedb": "^0.22.0",
    "@xenova/transformers": "^2.17.2"
  }
}
```

### 2.2 インストール

```bash
npm install @lancedb/lancedb @xenova/transformers
```

## 3. スキーマ定義

LanceDBのスキーマ定義は、TypeScriptインターフェースを使用して行います。`@lancedb/lancedb`パッケージには`Schema`型が直接エクスポートされていないため、独自のインターフェースを定義する必要があります。

```typescript
// スキーマ定義のインターフェース
interface SchemaField {
  type: string;
  valueType?: string;
  dimensions?: number;
  nullable: boolean;
}

interface SchemaDefinition {
  [key: string]: SchemaField;
}

// 最小限のスキーマ定義（エラー切り分け用）
export const MinimalLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },
  vector: { type: 'vector', valueType: 'float32', dimensions: 768, nullable: false },
  title: { type: 'string', nullable: false },
  content: { type: 'string', nullable: false }
};

// 完全なスキーマ定義
export const FullLanceDBSchema: SchemaDefinition = {
  id: { type: 'string', nullable: false },
  vector: { type: 'vector', valueType: 'float32', dimensions: 768, nullable: false },
  space_key: { type: 'string', nullable: false },
  title: { type: 'string', nullable: false },
  labels: { type: 'list', valueType: 'string', nullable: false },
  content: { type: 'string', nullable: false },
  pageId: { type: 'string', nullable: false },
  chunkIndex: { type: 'int32', nullable: false },
  url: { type: 'string', nullable: false },
  lastUpdated: { type: 'string', nullable: false }
};
```

## 4. データベース接続とテーブル作成

LanceDBに接続し、テーブルを作成または開く方法は以下の通りです。

```typescript
import * as lancedb from '@lancedb/lancedb';
import { createConfluenceSampleData } from '../lib/lancedb-schema';

// LanceDBテーブル準備
const tableName = 'confluence';
const dbPath = path.resolve(process.cwd(), '.lancedb');
console.log(`Connecting to LanceDB at ${dbPath}`);
const db = await lancedb.connect(dbPath);

// テーブル存在確認と作成
const tableNames = await db.tableNames();
let tbl: any;

if (!tableNames.includes(tableName)) {
  console.log(`Creating LanceDB table '${tableName}' with explicit minimal schema`);
  
  // サンプルデータを使用してテーブルを作成
  const sampleData = [createConfluenceSampleData()] as unknown as Record<string, unknown>[];
  tbl = await db.createTable(tableName, sampleData);
  
  // サンプルデータを削除
  await tbl.delete("id = 'sample-1'");
} else {
  console.log(`Opening existing LanceDB table '${tableName}'`);
  tbl = await db.openTable(tableName);
}
```

## 5. データの挿入

### 5.1 データ挿入のベストプラクティス

LanceDBにデータを挿入する際は、以下のベストプラクティスに従ってください：

1. シンプルなオブジェクト構造を使用する
2. 適切な型変換を行う
3. `add`メソッドを使用する（`mergeInsert`ではなく）

```typescript
// データ挿入の例
const records = [
  {
    id: 'record-1',
    vector: Array.from(embedding), // Float32Arrayから通常の配列に変換
    title: String(title),
    content: String(content)
  }
];

// テーブルにデータを挿入
await tbl.add(records);
```

### 5.2 エラー回避のポイント

- **StringExpectedエラー**: `mergeInsert`メソッドを使用すると、オブジェクト構造が複雑な場合に「StringExpected」エラーが発生することがあります。代わりに`add`メソッドを使用してください。
- **型変換**: 文字列フィールドには明示的に`String()`を使用し、数値フィールドには`Number()`を使用することで型の不一致を防ぎます。
- **ベクトル形式**: 埋め込みベクトルは`Float32Array`から通常の配列に変換して保存します。

## 6. データの検索

### 6.1 ベクトル検索

```typescript
// ベクトル検索の例
const vector = await getEmbeddings(query);
const results = await tbl.search(vector).limit(5).toArray();
```

### 6.2 フィルタリング

LanceDBの`where`メソッドを使用してフィルタリングを行うことができます。ただし、複雑なフィルタリングはJavaScriptで行う方が安全な場合があります。

```typescript
// JavaScriptでのフィルタリング例
const results = await tbl.search(vector).limit(10).toArray();
const filteredResults = results.filter(r => r.title && r.title.includes('テスト'));
```

## 7. パフォーマンス最適化

### 7.1 インデックス作成

LanceDBは自動的にベクトルインデックスを作成しますが、大規模なデータセットでは明示的にインデックスを作成することでパフォーマンスを向上させることができます。

```typescript
// インデックス作成の例（現在のプロジェクトでは未実装）
await tbl.createIndex({
  vector: { 
    type: 'vector', 
    valueType: 'float32', 
    dimensions: 768 
  }
});
```

### 7.2 バッチ処理

大量のデータを挿入する場合は、バッチ処理を使用することでパフォーマンスを向上させることができます。

```typescript
const BATCH_SIZE = 100;
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE);
  await tbl.add(batch);
}
```

## 8. エラーハンドリング

エラーハンドリングは、try-catch構文を使用して適切に行ってください。

```typescript
try {
  await tbl.add(records);
  console.log(`Successfully saved ${records.length} records to LanceDB`);
} catch (error: any) {
  console.error(`Error saving to LanceDB: ${error.message}`);
  await ErrorHandler.logError('lancedb_save', error, { batchCount });
}
```

## 9. 公式ドキュメントとの比較検証

現在の実装は、LanceDBの公式ドキュメントに基づいています。主な相違点と検証結果は以下の通りです：

1. **スキーマ定義**: 公式ドキュメントではスキーマ定義のための明示的なAPIは提供されていませんが、サンプルデータを使用したスキーマ推論は推奨されています。現在の実装はこのアプローチに従っています。

2. **データ挿入**: 公式ドキュメントでは`add`メソッドと`mergeInsert`メソッドの両方が紹介されていますが、複雑なオブジェクト構造の場合は`add`メソッドが推奨されています。現在の実装は`add`メソッドを使用しており、これは適切です。

3. **検索機能**: 公式ドキュメントに従って、ベクトル検索と結果のフィルタリングを実装しています。現在の実装は適切です。

## 10. まとめ

LanceDBは、ローカル環境でのベクトル検索に適した軽量なデータベースです。適切なスキーマ定義とデータ挿入方法を使用することで、効率的なベクトル検索を実現することができます。

このドキュメントで説明したベストプラクティスに従うことで、LanceDBを効果的に活用し、パフォーマンスと安定性を向上させることができます。

## 参考資料

- [LanceDB公式ドキュメント](https://lancedb.github.io/lancedb/)
- [LanceDB GitHub](https://github.com/lancedb/lancedb)
- [@xenova/transformers ドキュメント](https://huggingface.co/Xenova/all-mpnet-base-v2)
