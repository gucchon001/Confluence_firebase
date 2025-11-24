# page_id消失問題の根本原因分析

## 問題の概要

本番環境で以下のエラーが発生：
```
[lancedbRetrieverTool] ❌ page_id not found for result: 【作成中】改善チケット記載内容. This is a data integrity issue.
[ChunkMerger] ❌ page_id not found for result: 【作成中】改善チケット記載内容. Skipping chunk enrichment.
```

## 根本原因

### 1. **LanceDBから取得したデータの`page_id`がBigInt型**

LanceDBのスキーマで`page_id`が`int64`型として定義されており、JavaScript SDKがBigIntとして返す可能性があります。

### 2. **`mapLanceDBRecordToAPI`でのBigInt処理の不備**

**問題箇所**: `src/lib/pageid-migration-helper.ts` の `mapLanceDBRecordToAPI`関数

**問題コード**:
```typescript
const numericPageId = Number(page_id);
return {
  ...
  page_id: Number.isFinite(numericPageId) ? numericPageId : page_id,  // ← BigIntのまま返される可能性
};
```

**問題点**:
- `page_id`がBigIntの場合、`Number(page_id)`で変換するが、安全な範囲を超えている場合、`Number.isFinite(numericPageId)`がfalseになる
- その結果、`page_id`がBigIntのまま返される
- 後続の処理で`getPageIdFromRecord`がBigIntを正しく処理できず、undefinedが返される

### 3. **ベクトル検索結果が`mapLanceDBRecordToAPI`を通していない**

**問題箇所**: `src/lib/lancedb-search-client.ts` の `executeVectorSearch`関数

**問題コード**:
```typescript
let vectorResults = await vectorQuery.limit(searchLimit).toArray();
// ← mapLanceDBRecordToAPIを通していない
vectorResults = vectorResults.map(result => {
  const pageId = getPageIdFromRecord(result);  // ← result.page_idがBigIntのまま
  const page_id = result.page_id ?? pageId;    // ← BigIntのまま残る
  ...
});
```

**問題点**:
- LanceDBから直接取得したデータが`mapLanceDBRecordToAPI`を通していない
- `page_id`がBigIntのまま残り、後続の処理で問題が発生

## データフロー

```
1. LanceDBからデータ取得
   ↓ (page_id: BigInt)
2. executeVectorSearch: toArray()
   ↓ (page_id: BigIntのまま)
3. vectorResults.map() で処理
   ↓ (page_id: BigIntのまま)
4. unified-search-result-processor.ts: formatResults()
   ↓ (page_id: BigIntのまま)
5. getPageIdFromRecord() で取得
   ↓ (BigIntを処理できるようになったが、既に失われている可能性)
6. lancedbRetrieverTool: getPageIdFromRecord()
   ↓ (undefined)
7. ❌ page_id not found エラー
```

## 修正内容

### 1. `mapLanceDBRecordToAPI`でのBigInt処理を強化

- BigInt, Number, Stringのいずれでも確実にNumberに変換
- 安全な範囲を超える場合も文字列から数値化を試みる
- 無効な値の場合はundefinedを返す

### 2. ベクトル検索結果を`mapLanceDBRecordsToAPI`で変換

- `executeVectorSearch`でLanceDBから取得したデータを`mapLanceDBRecordsToAPI`で変換
- フォールバック処理（フィルタのみ検索）でも同様に変換

## 修正後のデータフロー

```
1. LanceDBからデータ取得
   ↓ (page_id: BigInt)
2. executeVectorSearch: toArray()
   ↓ (page_id: BigIntのまま)
3. mapLanceDBRecordsToAPI() で変換
   ↓ (page_id: Numberに変換)
4. vectorResults.map() で処理
   ↓ (page_id: Number)
5. unified-search-result-processor.ts: formatResults()
   ↓ (page_id: Number)
6. getPageIdFromRecord() で取得
   ↓ (Number)
7. ✅ page_idが正しく取得される
```

## まとめ

**根本原因**: 
- LanceDBから取得した`page_id`がBigInt型のまま、`mapLanceDBRecordToAPI`を通さずに処理されていた
- `mapLanceDBRecordToAPI`でBigIntを正しく処理していなかった

**修正**:
- `mapLanceDBRecordToAPI`でBigIntを確実にNumberに変換
- ベクトル検索結果を`mapLanceDBRecordsToAPI`で変換

これにより、page_id消失問題が解消される。

