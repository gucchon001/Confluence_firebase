# LanceDB トラブルシューティングガイド

## 1. よくあるエラーと解決策

### 1.1 StringExpectedエラー

#### 症状
データ挿入時に以下のようなエラーが発生します：

```
Error saving to LanceDB: Failed to convert JavaScript value `Object {"id":"640450787-0","vector":[...]}` into rust type `String`
```

#### 原因
`mergeInsert`メソッドを使用した場合、複雑なオブジェクト構造がLanceDBのRustバックエンドで正しく処理されないことがあります。

#### 解決策
1. `mergeInsert`の代わりに`add`メソッドを使用する
2. オブジェクト構造をシンプルにする
3. 明示的な型変換を行う

```typescript
// 修正前
await tbl.mergeInsert(lancedbRecords, ['id']);

// 修正後
await tbl.add(lancedbRecords);
```

### 1.2 Schema型のインポートエラー

#### 症状
```
Module '"@lancedb/lancedb"' has no exported member 'Schema'.
```

#### 原因
`@lancedb/lancedb`パッケージには`Schema`型が直接エクスポートされていません。

#### 解決策
独自のインターフェース定義を作成します：

```typescript
interface SchemaField {
  type: string;
  valueType?: string;
  dimensions?: number;
  nullable: boolean;
}

interface SchemaDefinition {
  [key: string]: SchemaField;
}
```

### 1.3 テーブル作成エラー

#### 症状
```
The schema passed in does not appear to be a schema (no 'fields' property)
```

#### 原因
スキーマ定義が正しくないか、テーブル作成メソッドの引数が不適切です。

#### 解決策
サンプルデータを使用してスキーマを推論させる方法が最も安定しています：

```typescript
const sampleData = [createConfluenceSampleData()] as unknown as Record<string, unknown>[];
tbl = await db.createTable(tableName, sampleData);
```

### 1.4 ベクトル形式エラー

#### 症状
データ挿入時にベクトル形式に関するエラーが発生します。

#### 原因
`Float32Array`などの特殊な配列形式がLanceDBで正しく処理されないことがあります。

#### 解決策
通常の配列に変換してから挿入します：

```typescript
const vector = Array.from(embedding as number[]);
```

## 2. パフォーマンスの問題

### 2.1 検索が遅い

#### 症状
検索操作が予想よりも遅い。

#### 解決策
1. インデックスを作成する
2. クエリを最適化する
3. 結果の制限を適切に設定する

```typescript
// 検索を最適化する例
const results = await tbl.search(vector)
  .limit(10)  // 必要な結果数だけに制限
  .toArray();
```

### 2.2 メモリ使用量が多い

#### 症状
アプリケーションのメモリ使用量が時間とともに増加する。

#### 解決策
1. 大きなデータセットをバッチ処理する
2. 不要なデータをメモリに保持しない
3. Node.jsのメモリオプションを調整する

```bash
# メモリ制限を設定してスクリプトを実行
node --max-old-space-size=4096 script.js
```

## 3. データ整合性の問題

### 3.1 データが見つからない

#### 症状
挿入したはずのデータが検索結果に表示されない。

#### 解決策
1. テーブルの行数を確認する
2. 検索クエリを確認する
3. データ挿入が成功したか確認する

```typescript
// テーブルの行数を確認
const count = await tbl.countRows();
console.log(`Table has ${count} rows`);

// サンプルレコードを確認
const sample = await tbl.query().limit(1).toArray();
console.log('Sample record:', JSON.stringify(sample[0], null, 2));
```

### 3.2 重複データ

#### 症状
同じデータが複数回挿入される。

#### 解決策
1. 一意のIDを使用する
2. 挿入前に既存データを確認する
3. `mergeInsert`を使用する（適切な場合）

```typescript
// IDが既に存在するか確認してから挿入
const existingIds = new Set<string>();
const results = await tbl.query().select(['id']).toArray();
for (const result of results) {
  existingIds.add(result.id);
}

// 新しいレコードのみをフィルタリング
const newRecords = records.filter(r => !existingIds.has(r.id));
if (newRecords.length > 0) {
  await tbl.add(newRecords);
}
```

## 4. その他の問題

### 4.1 型の不一致

#### 症状
データ挿入や検索時に型の不一致に関するエラーが発生する。

#### 解決策
明示的な型変換を行い、LanceDBの期待する型と一致させます：

```typescript
const record = {
  id: String(id),
  vector: Array.from(vector),
  title: String(title),
  content: String(content),
  chunkIndex: Number(chunkIndex)
};
```

### 4.2 フィルタリングの問題

#### 症状
`where`メソッドを使用したフィルタリングが期待通りに動作しない。

#### 解決策
JavaScriptでのフィルタリングを検討します：

```typescript
// LanceDBの検索結果をJavaScriptでフィルタリング
const results = await tbl.search(vector).limit(20).toArray();
const filteredResults = results.filter(r => r.title && r.title.includes('テスト'));
```

## 5. デバッグ方法

### 5.1 ログ出力

詳細なログを出力して問題を特定します：

```typescript
console.log('Table opened successfully');
console.log('Inserting test record...');
await tbl.add([{id: 'test-1', vector: new Array(384).fill(0), title: 'Test Title', content: 'Test content'}]);
console.log('Record inserted successfully');
const count = await tbl.countRows();
console.log('Table has ' + count + ' rows');
```

### 5.2 テーブル情報の確認

テーブルのスキーマやデータを確認します：

```typescript
// テーブルのスキーマを確認
const schema = await tbl.schema();
console.log('Table schema:', schema);

// サンプルデータを確認
const sample = await tbl.query().limit(1).toArray();
console.log('Sample record:', JSON.stringify(sample[0], null, 2));
```

### 5.3 エラーハンドリング

適切なエラーハンドリングを実装して、問題を特定しやすくします：

```typescript
try {
  // 操作を実行
} catch (error: any) {
  console.error(`Error: ${error.message}`);
  console.error(`Stack: ${error.stack}`);
  // エラーログを保存
  await ErrorHandler.logError('operation_name', error, { context });
}
```

## 6. 参考資料

- [LanceDB GitHub Issues](https://github.com/lancedb/lancedb/issues)
- [LanceDB公式ドキュメント](https://lancedb.github.io/lancedb/)
- [LanceDB Node.js API リファレンス](https://lancedb.github.io/lancedb/nodejs/)
