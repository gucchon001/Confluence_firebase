# Vertex AI Vector Search 実装ガイド

最終更新: 2025-09-11

## 1. 実装サマリーと次のステップ

### 1.1. 現在の実装状況

- **インデックスとエンドポイント**:
  - `DOT_PRODUCT_DISTANCE` + `UNIT_L2_NORM` の正しい設定で本番用インデックス (`confluence-embeddings-v2`) とエンドポイントを作成・デプロイ済みです。
  - 同期の問題を避けるため、`minReplicaCount: 1` で設定済みです。
- **データ登録と検索機能**:
  - データ同期スクリプト (`batch-sync-confluence.ts`) は、L2正規化、正しいJSON形式 (`.json`, `id`/`embedding` フィールド) でのファイル生成に対応済みです。
  - 検索クライアントは、REST API (`v1beta1`, `snake_case` パラメータ) を使用するように修正済みで、テストデータでの検索は成功しています。
- **設定管理**:
  - 新しいインデックス/エンドポイント情報は `.env` ファイルで一元管理されています。

### 1.2. 次のステップ

1.  **本番データの移行**:
    - `npm run sync:confluence:batch` を実行して、Confluenceの全データを新しいインデックスに同期します。
    - Firestoreの `syncLogs` コレクションで同期状況を監視します。
    - Vector SearchコンソールまたはAPIで `vectorsCount` が増加し、データが正しく登録されていることを確認します。
2.  **アプリケーションの切り替えと検証**:
    - データ同期完了後、アプリケーションが新しいエンドポイントを参照していることを確認し、本番環境での検索品質を検証します。
3.  **パフォーマンスチューニング**:
    - 必要に応じて、検索レイテンシの測定やインデックスのレプリカ数調整を検討します。

### 1.3. データ配置・更新運用（現行）

- 変換: JSONL → 配列JSON（`vector-batch-<ts>/data.json`）
- インポート: `metadata.contentsDeltaUri = gs://.../vector-batch-<ts>/`（フォルダ指定でバッチルートを渡す）
- 検証: 公開エンドポイントの `findNeighbors` でスポット検証（自己一致の確認）

## 2. 概要と目的

このドキュメントは、「Confluence仕様書要約チャットボット」のRAG（Retrieval Augmented Generation）機能で利用する **Vertex AI Vector Search** の実装、設定、運用についてまとめたものです。

過去に発生した接続問題やデータ形式の不整合を解決し、現在の安定稼働している実装を正確に文書化することを目的とします。

---

## 2. 根本原因と解決策（サマリー）

過去の調査で特定された問題と、その解決策は以下の通りです。

| 問題カテゴリ | 具体的な問題内容 | 解決策 |
| :--- | :--- | :--- |
| **1. インデックス設定の矛盾** | `distanceMeasureType: DOT_PRODUCT_DISTANCE` と `featureNormType: NONE` の組み合わせが使用されていた。 | **`featureNormType: UNIT_L2_NORM` を指定**した新しいインデックスを作成。`DOT_PRODUCT_DISTANCE` を使用する場合、ベクトルのL2正規化は必須。 |
| **2. データ形式の不整合** | - **ファイル拡張子**: 非推奨の `.jsonl` を使用していた。<br>- **フィールド名**: 更新時に `datapointId`/`featureVector` を使用していた。 | - **ファイル拡張子を `.json` に統一**。<br>- **インデックス更新時は `id` と `embedding`** のフィールド名を使用するよう修正。 |
| **3. API仕様の不一致** | - **APIバージョン**: 安定版の `v1` を使用していた。<br>- **リクエスト形式**: `camelCase` のパラメータ名を使用していた。 | - **`v1beta1` バージョンのAPIエンドポイントを使用**。<br>- **検索（findNeighbors）リクエストのパラメータを `snake_case`** (`deployed_index_id`, `feature_vector`など)に修正。 |
| **4. GCSのファイル配置** | バッチごとに日付フォルダを作成し、その中にファイルを配置していた。 | **GCSバケットのルートディレクトリに直接ファイルを配置**するよう修正。Vector Searchの仕様ではサブディレクトリは許可されない。 |

---

## 3. 本番環境システム構成

### 3.1. 新しいインデックス/エンドポイント情報

| 項目 | 値 |
| :--- | :--- |
| インデックスID | `8470329717130526720` |
| インデックス表示名 | `confluence-embeddings-v2` |
| エンドポイントID | `1242272217526435840` |
| エンドポイント表示名 | `confluence-embeddings-endpoint-v2` |
| デプロイID | `confluence_embeddings_v2_deployed` |
| 公開エンドポイントドメイン | `1010669901.asia-northeast1-122015916118.vdb.vertexai.goog` |

### 3.2. インデックスの重要パラメータ

| パラメータ | 設定値 | 理由 |
| :--- | :--- | :--- |
| `dimensions` | `768` | `text-embedding-004` モデルの出力次元数 |
| `distanceMeasureType` | `DOT_PRODUCT_DISTANCE` | コサイン類似度計算のため |
| `featureNormType` | `UNIT_L2_NORM` | `DOT_PRODUCT_DISTANCE` を使用するための必須設定 |
| `indexUpdateMethod` | `BATCH_UPDATE` | GCSからの大規模データ更新のため |

---

## 4. データ同期・インデックス更新プロセス

データ同期は `src/scripts/batch-sync-confluence.ts` スクリプトによって実行されます。

### 4.1. データ生成とフォーマット

1.  **Confluenceからデータ取得**: 全件、または差分データを取得します。
2.  **チャンク化**: ページコンテンツを意味のある塊に分割します。
3.  **ベクトル化**: 各チャンクを `text-embedding-004` を使って768次元のベクトルに変換し、**L2正規化**を適用します。
4.  **JSONファイル生成**: 以下の形式で `.json` ファイルを生成します。各行が1つのJSONオブジェクトです。

    ```json
    {"id": "ページID-チャンク番号", "embedding": [0.1, 0.2, ...], "restricts": [{"namespace": "space_key", "allow_list": ["SPACEKEY"]}], "crowding_tag": "ページID"}
    ```

### 4.2. GCSへのアップロード要件

- **ファイル配置**: 生成された `.json` ファイルは、GCSバケットの **ルートディレクトリに直接** 配置されます。
- **サブディレクトリ**: `delete` を除くサブディレクトリは使用しません。
- **ファイル拡張子**: `.json` を使用します。

### 4.3. インデックス更新の実行

スクリプトは以下の2段階でインデックスを更新します。

1.  **バッチごとの更新**: 100ページを処理するごとに、生成された `.json` ファイルをGCSにアップロードし、そのファイル単体でインデックスを更新します。
2.  **最終更新**: 全てのバッチ処理が完了した後、**GCSバケットのルート (`gs://BUCKET_NAME/`)** を `contentsDeltaUri` に指定して、再度インデックス更新API (PATCH) を呼び出します。これにより、バケット内の全てのデータが確実にインデックスに反映されます。

---

## 5. 検索（クエリ）プロセス

### 5.1. APIエンドポイント

- **バージョン**: `v1beta1`
- **URL**: `https://{PUBLIC_ENDPOINT_DOMAIN}/v1beta1/projects/{PROJECT_ID}/locations/{REGION}/indexEndpoints/{ENDPOINT_ID}:findNeighbors`

### 5.2. リクエスト形式

- クエリとして投げるベクトルも同様に **L2正規化** が必要です。
- リクエストボディのパラメータは **`snake_case`** です。

```json
{
  "deployed_index_id": "confluence_embeddings_v2_deployed",
  "queries": [
    {
      "datapoint": {
        "datapoint_id": "query-1",
        "feature_vector": [...] // 768次元のL2正規化済みベクトル
      },
      "neighbor_count": 10,
      "restricts": [{
        "namespace": "space_key",
        "allow_list": ["ALLOWED_SPACE_KEY"]
      }]
    }
  ]
}
```

---

## 6. 同期スクリプトの実行方法

`package.json` に定義された以下のスクリプトで同期処理を実行します。

| スクリプト | コマンド | 説明 |
| :--- | :--- | :--- |
| **通常同期** | `npm run sync:confluence:batch` | 全データを対象に同期。削除ページも処理。 |
| **差分同期** | `npm run sync:confluence:differential` | 前回の同期以降に変更があったページのみを対象。 |
| **削除処理スキップ** | `npm run sync:confluence:no-delete` | 全データを対象にするが、削除ページの処理は行わない。 |
| **差分＋削除スキップ** | `npm run sync:confluence:diff-no-delete` | 差分同期を行い、かつ削除ページの処理は行わない。 |

---

## 8. 環境変数

本システムで使用する環境変数の一覧です。`.env` または `.env.local` ファイルに設定します。

```

### 5.3. 付録: readIndexDatapoints の位置づけ

- 目的: 特定 `datapointId` のベクトルを直接取得して監査に用いる
- 現状: 環境によっては v1 REST/SDK 直叩きが 404/未実装となるケースあり
- 方針: 日常の検証は `findNeighbors` を既定とし、`readIndexDatapoints` は将来の改善項目として安定経路（REST v1 / SDK v1）を再検証の上で導入
- 注意点チェックリスト:
  - エンドポイントとリージョンがインデックスと一致
  - 認可スコープに `cloud-platform` を含む
  - SDK のバージョン互換性を確認
# Google Cloud設定
VERTEX_AI_PROJECT_ID=confluence-copilot-ppjye
VERTEX_AI_NUMERIC_PROJECT_ID=122015916118
VERTEX_AI_LOCATION=asia-northeast1
VERTEX_AI_EMBEDDING_MODEL=text-embedding-004

# Vector Search設定
VERTEX_AI_STORAGE_BUCKET=confluence-copilot-ppjye-vector-search
VERTEX_AI_INDEX_ID=8470329717130526720
VERTEX_AI_ENDPOINT_ID=1242272217526435840
VERTEX_AI_DEPLOYED_INDEX_ID=confluence_embeddings_v2_deployed
VERTEX_AI_PUBLIC_ENDPOINT_DOMAIN=1010669901.asia-northeast1-122015916118.vdb.vertexai.goog

# Confluence API設定
CONFLUENCE_BASE_URL=https://<your-domain>.atlassian.net
CONFLUENCE_USER_EMAIL=<your-email>
CONFLUENCE_API_TOKEN=<your-api-token>
CONFLUENCE_SPACE_KEY=<your-space-key>
```

---

## 9. トラブルシューティング

| 事象 | 原因 | 解決策 |
| :--- | :--- | :--- |
| **`vectorsCount` が増えない** | - GCSのファイルパスが間違っている（サブディレクトリなど）。<br>- ファイル拡張子が非対応（`.jsonl` など）。<br>- JSONの形式が違う（`datapointId` など）。<br>- **GCSバケット名が違う**。 | - ファイルをGCSバケットのルートに配置する。<br>- 拡張子を `.json` にする。<br>- `id`, `embedding` フィールドを使用する。<br>- 環境変数の `VERTEX_AI_STORAGE_BUCKET` を確認する。 |
| **検索結果が0件** | - `vectorsCount` が増えていない。<br>- インデックス設定の矛盾 (`DOT_PRODUCT` + `NONE`)。<br>- クエリベクトルが正規化されていない。 | - 上記`vectorsCount`の問題を解決。<br>- インデックスを `UNIT_L2_NORM` で再作成。<br>- 検索前にクエリベクトルをL2正規化する。 |
| **APIエラー `501 UNIMPLEMENTED`** | リージョンエンドポイント (`asia-northeast1-aiplatform.googleapis.com`) の `findNeighbors` を使用している。 | **公開エンドポイント (`...vdb.vertexai.goog`)** を使用する。 |
| **APIエラー `404 Not Found`** | - APIのURLパスが間違っている（`v1`と`v1beta1`など）。<br>- 公開エンドポイントのドメイン名が古い、または間違っている。 | - APIバージョンが `v1beta1` であることを確認する。<br>- `gcloud ai index-endpoints describe` コマンドで最新の `publicEndpointDomainName` を確認し、環境変数を更新する。 |