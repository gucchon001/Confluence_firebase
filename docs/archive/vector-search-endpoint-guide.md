# Vector Search エンドポイントデプロイガイド

## 問題概要

現在、Vector Search APIの呼び出し時に結果が0件となっています。これはVector Searchのインデックスが作成されているものの、**エンドポイントにデプロイされていない**可能性が高いです。

## エンドポイントデプロイ手順

### 1. Google Cloud Consoleにアクセス

1. [Google Cloud Console](https://console.cloud.google.com/) にログインします
2. プロジェクト `confluence-copilot-ppjye` を選択します

### 2. Vertex AI Vector Search（旧Matching Engine）にアクセス

1. 左側のナビゲーションメニューから「Vertex AI」を選択します
2. Vertex AIのダッシュボードから「Vector Search」を選択します

### 3. インデックスの確認

1. 「Indexes」タブを選択します
2. インデックス `confluence-embeddings` (ID: `7360896096425476096`) が表示されていることを確認します
3. ステータスが「READY」になっていることを確認します

### 4. インデックスエンドポイントの作成

1. 「Index endpoints」タブを選択します
2. 「CREATE INDEX ENDPOINT」ボタンをクリックします
3. 以下の情報を入力します：
   - Region: `asia-northeast1`
   - Name: `confluence-embeddings-endpoint`
   - Network: デフォルト（または既存のVPCを選択）
4. 「CREATE」ボタンをクリックします

### 5. インデックスのデプロイ

1. 作成したエンドポイントが表示されたら、そのエンドポイントをクリックします
2. 「DEPLOY INDEX」ボタンをクリックします
3. 以下の情報を入力します：
   - Index: `confluence-embeddings` (ID: `7360896096425476096`)を選択
   - Deployed index ID: `confluence_embeddings_endp` (自動生成されたIDでも可)
   - Machine type: `e2-standard-2`（推奨）または必要に応じて調整
   - Min replica count: `1`
   - Max replica count: `1`（必要に応じて調整）
4. 「DEPLOY」ボタンをクリックします

### 6. デプロイ状況の確認

1. デプロイが完了するまで数分待ちます（ステータスが「READY」になるまで）
2. デプロイされたインデックスの情報を確認します：
   - Endpoint ID（例: `1435927001503367168`）
   - Deployed Index ID（例: `confluence_embeddings_endp_1757347487752`）

### 7. 環境変数の更新

1. `.env.local` ファイルに以下の環境変数を追加/更新します：
   ```
   VERTEX_AI_ENDPOINT_ID=取得したEndpoint ID
   VERTEX_AI_DEPLOYED_INDEX_ID=取得したDeployed Index ID
   ```

2. Cloud Functionsの環境変数も更新します：
   ```bash
   firebase functions:config:set vertexai.endpoint_id="取得したEndpoint ID" vertexai.deployed_index_id="取得したDeployed Index ID"
   ```

3. 更新した環境変数でCloud Functionsを再デプロイします：
   ```bash
   firebase deploy --only functions
   ```

## トラブルシューティング

### 検索結果が0件の場合

1. **エンドポイントのステータス確認**: エンドポイントとデプロイされたインデックスのステータスが「READY」になっていることを確認します

2. **環境変数の確認**: `VERTEX_AI_ENDPOINT_ID` と `VERTEX_AI_DEPLOYED_INDEX_ID` が正しく設定されていることを確認します

3. **検索パラメータの調整**: 
   - `distanceThreshold` を大きくする（例: 0.8 → 0.95）
   - `neighborCount` を増やす（例: 5 → 10）

4. **ログの確認**: Cloud Functionsのログで詳細なエラーメッセージを確認します

### APIエラーが発生する場合

1. **認証情報の確認**: サービスアカウントに適切な権限が付与されていることを確認します
   - `roles/aiplatform.user`
   - `roles/vectorsearch.admin`

2. **ネットワーク設定の確認**: VPCの設定やファイアウォールルールを確認します

3. **リクエストペイロードの確認**: リクエストの形式が正しいことを確認します
