# BigInt使用箇所の分析

## 概要

BigIntは、LanceDBから取得したデータの`int64`型フィールドがJavaScriptでBigIntとして返されることで発生します。

## BigIntが発生する箇所

### 1. LanceDBスキーマ定義

**ファイル**: `src/lib/lancedb-schema.ts`, `docs/01-architecture/01.02.02-lancedb-data-structure-specification.md`

```typescript
page_id: { type: 'int64', nullable: false }  // int64型として定義
```

LanceDBの`int64`型は、JavaScript SDKでBigIntとして返される可能性があります。

### 2. LanceDBからデータを取得する箇所

#### 2.1 `lunr-initializer.ts`

**行**: 196, 225, 312

```typescript
// LanceDBからデータを取得
const batchDocs = await (tbl.query().limit(FETCH_BATCH_SIZE) as any).offset(offset).toArray();
// または
allDocs = await tbl.query().limit(10000).toArray();

// doc.page_idがBigIntになる可能性がある
const page_id = tableName === 'jira_issues' 
  ? 0
  : (doc.page_id ?? pageId);  // ← ここでBigIntになる可能性
```

**影響**: `LunrDocument`の`page_id`フィールドにBigIntが含まれる可能性があります。

#### 2.2 `lancedb-search-client.ts`

**行**: 413, 503

```typescript
// LanceDBから検索結果を取得
const filterOnlyResults = await tbl.query().where(params.filter).limit(topK).toArray();

// row.page_idがBigIntになる可能性がある
const pageId = row.page_id ?? row.pageId;
```

**影響**: 検索結果の`page_id`がBigIntになる可能性があります。

### 3. BigIntがシリアライズされる箇所

#### 3.1 `lunr-search-client.ts` - `saveToDisk()`

**行**: 298-337

```typescript
async saveToDisk(documents: LunrDocument[], ...): Promise<void> {
  // documentsの中のpage_idがBigIntの可能性がある
  const sanitizedDocuments = this.convertBigIntToNumber(documents);
  
  const data = {
    index: index.toJSON(),
    documents: sanitizedDocuments,  // ← ここでBigIntを変換
    ...
  };
  
  // JSON.stringify()でBigIntエラーが発生する可能性
  const jsonPayload = JSON.stringify(data, this.bigIntReplacer.bind(this), 0);
}
```

**問題**: `JSON.stringify()`はBigIntを直接シリアライズできません。

**修正**: `convertBigIntToNumber()`と`bigIntReplacer()`でBigIntをNumberまたはStringに変換。

#### 3.2 `search-logger.ts` - `saveSearchLog()`

**行**: 73-111

```typescript
public saveSearchLog(query: string, results: any[]): void {
  const logEntry: SearchLogEntry = {
    ...
    results: results.slice(0, 10).map(r => ({
      page_id: typeof r.page_id === 'bigint' ? Number(r.page_id) : r.page_id,  // ← BigIntを変換
      ...
    })),
  };
  
  // JSON.stringify()でBigIntエラーが発生する可能性
  const logLine = JSON.stringify(logEntry, this.bigIntReplacer.bind(this)) + '\n';
}
```

**問題**: 検索結果の`page_id`がBigIntの場合、ログ保存時にエラーが発生する可能性があります。

**修正**: `bigIntReplacer()`でBigIntをNumberまたはStringに変換。

### 4. その他のBigInt変換箇所

#### 4.1 `pageid-migration-helper.ts` - `getPageIdFromRecord()`

**行**: 78-85

```typescript
export function getPageIdFromRecord(record: any): number | string | undefined {
  if (record.page_id !== undefined) {
    const numericPageId = Number(record.page_id);  // ← BigIntをNumberに変換
    return Number.isFinite(numericPageId) ? numericPageId : record.page_id;
  }
  return undefined;
}
```

**役割**: `page_id`がBigIntの場合、Numberに変換します。

#### 4.2 `migrate-lancedb-table-to-extended-schema.ts`

**行**: 82-94, 125-130

```typescript
// BigIntをNumberに変換するヘルパー関数
const toNumber = (value: any): number => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  ...
};

// JSON.stringify用のreplacer関数
const replacer = (key: string, value: any) => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value;
};
```

**役割**: マイグレーションスクリプトでBigIntをNumberに変換します。

## 影響範囲

### 直接的な影響

1. **検索インデックスのキャッシュ保存**: `saveToDisk()`でBigIntエラーが発生し、キャッシュが保存できない
2. **検索ログの保存**: `saveSearchLog()`でBigIntエラーが発生し、ログが保存できない

### 間接的な影響

1. **検索速度の低下**: キャッシュが保存できないため、毎回インデックスを再構築する必要がある
2. **メモリ使用量の増加**: キャッシュが効かないため、メモリ使用量が増加する

## 修正内容

### 1. `lunr-search-client.ts`

- `convertBigIntToNumber()`: BigIntを再帰的にNumberまたはStringに変換
- `bigIntReplacer()`: JSON.stringify用のreplacer関数
- `saveToDisk()`: データ保存前にBigIntを変換

### 2. `search-logger.ts`

- `bigIntReplacer()`: JSON.stringify用のreplacer関数
- `saveSearchLog()`: `page_id`がBigIntの場合にNumberに変換

## 今後の対策

1. **LanceDBから取得したデータの型チェック**: `page_id`がBigIntかどうかを確認し、必要に応じて変換
2. **型定義の明確化**: `page_id`の型を`number | bigint`として定義し、変換処理を明確にする
3. **ユニットテスト**: BigIntを含むデータでのシリアライズテストを追加

## 参考資料

- [LanceDB Schema Specification](../01-architecture/01.02.02-lancedb-data-structure-specification.md)
- [JavaScript BigInt](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/BigInt)
- [JSON.stringify() and BigInt](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#bigint_values)

