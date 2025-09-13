# Vector Search インデックス検証結果

## インデックスの詳細設定

確認したVector Searchインデックスの詳細設定は以下の通りです：

| 設定項目 | 値 |
|---------|-----|
| アルゴリズムの種類 | tree-AH |
| ディメンション | 768 |
| 近似近傍数 | 10 |
| 更新方法 | バッチ |
| シャードのサイズ | 中 |
| 距離測定のタイプ | ドット積距離 |
| 特徴の正規化タイプ | なし |
| 検索するリーフノードの割合 | 0.05 |
| リーフノードの埋め込み数 | 1,000 |

## コードとの整合性確認

### 埋め込みベクトルの次元数

1. **インデックス設定**: 768次元
2. **生成コード**: `generateEmbedding`関数で`text-embedding-004`モデルを使用
   ```typescript
   const embedding = response.data.predictions[0].embeddings.values;
   console.log(`[embedding] Generated embedding with ${embedding.length} dimensions`);
   ```
   - このモデルは768次元のベクトルを生成するため、インデックス設定と一致しています

3. **テスト関数**: `minimal-test.ts`で768次元のテストベクトルを使用
   ```typescript
   embedding: Array(768).fill(0).map((_, i) => i % 10 / 10), // 768次元のテスト用ベクトル
   ```

### データポイントの形式

現在のデータポイント形式：
```typescript
{
  id: `${record.pageId}-${record.chunkIndex}`,
  embedding: record.embedding.map(Number),
  restricts: [
    {
      namespace: "content_type",
      allow: ["confluence_page"]
    }
  ],
  crowding_tag: record.pageId,
  metadata: {
    title: record.title,
    url: record.url,
    content: record.content
  }
}
```

この形式は最新のVertex AI Vector Search APIドキュメントに基づいています。

## 結論

1. **次元数の一致**: インデックスの次元数（768）と生成している埋め込みベクトルの次元数（768）は一致しています。

2. **データポイント形式**: データポイントの形式は最新のAPIドキュメントに基づいて正しく構成されています。

3. **インデックス設定**: インデックスの設定（アルゴリズム、距離測定タイプなど）は適切に構成されています。

## 考察

インデックスの設定と生成しているベクトルの次元数は一致しているため、次元数の不一致が原因でエラーが発生している可能性は低いと考えられます。

依然として400エラーが発生している原因として、以下の可能性が考えられます：

1. **データ形式の微妙な違い**:
   - `embedding`フィールドの形式が異なる可能性（配列ではなくオブジェクト形式が必要など）
   - 数値の精度や型の問題（JavaScriptの数値型とAPIが期待する型の不一致）

2. **APIの制約**:
   - メタデータのサイズ制限
   - 一度にアップロードできるデータポイント数の制限
   - 特定のフィールドに対する文字数制限

3. **認証や権限の問題**:
   - 必要な権限が不足している可能性（既に確認済みですが）
   - アクセストークンの有効期限や範囲の問題

## 次のステップ

1. **埋め込みベクトル形式の変更**:
   ```typescript
   // 現在の形式
   embedding: record.embedding.map(Number)
   
   // 試すべき代替形式
   embedding: { values: record.embedding.map(Number) }
   ```

2. **メタデータの簡略化**:
   - メタデータを完全に省略したバージョンでテスト
   - より短いコンテンツでテスト

3. **APIドキュメントの再確認**:
   - 最新のVertex AI Vector Search APIドキュメントを参照して、リクエスト形式を再検証
   - 特に`upsertDatapoints`エンドポイントの正確な仕様を確認
