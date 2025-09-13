# Vector Search API 修正ガイド

## 問題点

Vector Search APIへのデータアップロード時に400エラー（Bad Request）が発生しています。これは、リクエストの形式がAPIの期待する形式と一致していないことが原因と考えられます。

## 修正内容

以下の修正を行いました：

### 1. フィールド名の修正

現在の実装では：
```javascript
{
  datapointId: `${record.pageId}-${record.chunkIndex}`,
  featureVector: record.embedding.map(Number),
  metadata: {
    title: record.title,
    url: record.url,
    content: record.content
  }
}
```

修正後の実装：
```javascript
{
  id: `${record.pageId}-${record.chunkIndex}`, // datapointIdではなくidを使用
  embedding: {
    values: record.embedding.map(Number), // featureVectorではなくembedding.valuesを使用
    dimension: record.embedding.length // 次元数を明示的に指定
  },
  // メタデータを構造化
  string_metadata: {
    title: record.title,
    url: record.url
  },
  textual_metadata: {
    content: record.content
  }
}
```

### 2. メタデータの構造化

メタデータを単一のオブジェクトではなく、`string_metadata`と`textual_metadata`に分けて構造化しました。これにより、検索時に適切なフィルタリングが可能になります。

### 3. バッチサイズの調整

バッチサイズを50から10に減らして、処理の安定性を向上させました。

### 4. 待機時間の追加

レート制限を考慮して、各バッチの処理後に待機時間を追加しました：
- 通常処理後: 500ms
- エラー発生後: 2000ms

### 5. その他のオプションフィールドの追加

検索の柔軟性を高めるために、以下のフィールドを追加しました：
- `restricts`: コンテンツタイプによる検索制限
- `crowding_tag`: 同じページからの結果を多様化するためのタグ
- `numeric_restricts`: タイムスタンプなどの数値による制限

## 実装手順

1. `functions/src/index-fix.ts`に修正版のコードを作成しました
2. この修正をテストして問題がなければ、本番の`functions/src/index.ts`に適用します
3. 修正後、関数を再デプロイして実行します

## 期待される効果

- Vector Search APIへのデータアップロードが成功するようになります
- 構造化されたメタデータにより、検索の精度と柔軟性が向上します
- バッチサイズの調整と待機時間の追加により、安定したアップロードが可能になります

## 注意点

- APIの仕様は変更される可能性があるため、最新のドキュメントを参照することをお勧めします
- エラーが発生した場合は、詳細なエラーメッセージを確認して問題を特定してください
