# Vertex AI Vector Search API リファレンス

## データポイントのアップロード形式

公式ドキュメントによると、Vector Search APIへのデータアップロードには以下の2つの形式があります。

### 形式1: 最新の公式ドキュメント（2024年）

```json
{
  "id": "42",
  "embedding": [0.5, 1.0],
  "restricts": [
    {
      "namespace": "class",
      "allow": ["cat", "pet"]
    },
    {
      "namespace": "category",
      "allow": ["feline"]
    }
  ],
  "crowding_tag": "basic"
}
```

### 形式2: 以前の公式ドキュメント

```json
{
  "datapoint_id": "unique_id_1",
  "feature_vector": [0.1, 0.2, 0.3, ...],
  "restricts": [
    {
      "namespace": "category",
      "allow_list": ["category1"]
    }
  ],
  "crowding_tag": "tag1"
}
```

## リクエスト形式

### エンドポイント
```
https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/indexes/{index}:upsertDatapoints
```

### リクエストボディ
```json
{
  "datapoints": [
    {
      // 形式1または形式2のデータポイント
    }
  ]
}
```

## フィールドの説明

| 形式1のフィールド | 形式2のフィールド | 説明 |
|-----------------|-----------------|------|
| `id` | `datapoint_id` | データポイントの一意の識別子 |
| `embedding` | `feature_vector` | ベクトルデータの配列 |
| `embedding.dimension` | なし | ベクトルの次元数（オプション） |
| `restricts[].namespace` | `restricts[].namespace` | 制約のカテゴリ名 |
| `restricts[].allow` | `restricts[].allow_list` | 許可する値のリスト |
| `crowding_tag` | `crowding_tag` | クラウディング制御のタグ |
| `string_metadata` | なし | 文字列型のメタデータ |
| `textual_metadata` | なし | テキスト型のメタデータ |
| `numeric_restricts` | なし | 数値型の制約 |

## 修正案

最新の公式ドキュメントに基づき、以下の形式でデータポイントを構成することを推奨します：

```json
{
  "datapoints": [
    {
      "id": "${record.pageId}-${record.chunkIndex}",
      "embedding": record.embedding.map(Number),
      "restricts": [
        {
          "namespace": "content_type",
          "allow": ["confluence_page"]
        }
      ],
      "crowding_tag": record.pageId,
      "metadata": {
        "title": record.title,
        "url": record.url,
        "content": record.content
      }
    }
  ]
}
```

## 注意点

1. フィールド名は最新の公式ドキュメントに合わせる（`id`と`embedding`を使用）
2. `metadata`フィールドの扱いが明確でないため、まずは基本的なフィールドのみでテスト
3. バッチサイズを小さく（10件程度）して処理を安定化
4. レート制限を考慮して、バッチ間に待機時間を設ける
