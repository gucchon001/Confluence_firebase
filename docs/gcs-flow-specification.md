... 199 lines not shown ...

## 5. 設定値

### 5.1 環境変数

| 環境変数 | デフォルト値 | 説明 |
|---------|------------|-----|
| `VERTEX_AI_PROJECT_ID` | `confluence-copilot-ppjye` | GCPプロジェクト名 |
| `VERTEX_AI_NUMERIC_PROJECT_ID` | `122015916118` | GCPプロジェクトID（数値形式） |
| `VERTEX_AI_LOCATION` | `asia-northeast1` | GCPリージョン |
| `VERTEX_AI_INDEX_ID` | `confluence-vector-index` | Vector Search インデックスID |
| `VERTEX_AI_ENDPOINT_ID` | `confluence-vector-endpoint` | Vector Search エンドポイントID |
| `VERTEX_AI_DEPLOYED_INDEX_ID` | `confluence-deployed-index` | Vector Search デプロイ済みインデックスID |
| `VERTEX_AI_STORAGE_BUCKET` | `${numericProjectId}-vector-search` | GCSバケット名 |

### 5.2 バケット設定

- **バケット名**: `122015916118-vector-search` または環境変数で指定
- **リージョン**: `asia-northeast1`（または環境変数 `VERTEX_AI_LOCATION` の値）
- **ストレージクラス**: `STANDARD`
- **ファイル命名規則**: `vector-search-data-{timestamp}.json`

### 5.3 設定方法

1. **環境変数による設定**
   ```powershell
   # PowerShell
   $env:VERTEX_AI_PROJECT_ID = "confluence-copilot-ppjye"
   $env:VERTEX_AI_NUMERIC_PROJECT_ID = "122015916118"
   $env:VERTEX_AI_LOCATION = "asia-northeast1"
   $env:VERTEX_AI_INDEX_ID = "confluence-vector-index"
   $env:VERTEX_AI_ENDPOINT_ID = "confluence-vector-endpoint"
   $env:VERTEX_AI_DEPLOYED_INDEX_ID = "confluence-deployed-index"
   $env:VERTEX_AI_STORAGE_BUCKET = "122015916118-vector-search"
   ```

2. **Firebase構成による設定**
   ```bash
   # Firebase CLI
   firebase functions:config:set vertexai.project_id="confluence-copilot-ppjye"
   firebase functions:config:set vertexai.numeric_project_id="122015916118"
   firebase functions:config:set vertexai.storage_bucket="122015916118-vector-search"
   ```

## 6. 実行フロー

1. **Cloud Functionsのトリガー**
   - HTTPリクエスト（`manualSyncConfluenceData`）
   - スケジュールされたジョブ（`syncConfluenceData`、毎日午前2時に実行）

... 83 lines not shown ...