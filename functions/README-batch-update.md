# Vector Search バッチ更新方式の実装

このドキュメントでは、Vector Searchのバッチ更新方式の実装と、テスト実行方法について説明します。

## 前提条件

1. Google Cloud Platformのプロジェクトが作成されていること
2. Vector Searchのインデックスが作成されていること
3. 必要な権限を持つサービスアカウントが作成されていること

## セットアップ手順

### 1. サービスアカウントキーの作成

1. GCPコンソールにログイン: https://console.cloud.google.com/
2. 左側のメニューから「IAMと管理」→「サービスアカウント」を選択
3. 使用するサービスアカウントを選択（または新規作成）
4. 「キー」タブを選択し、「鍵を追加」→「新しい鍵を作成」をクリック
5. キーのタイプとして「JSON」を選択し、「作成」をクリック
6. ダウンロードされたJSONファイルを安全な場所に保存

### 2. 環境変数の設定

PowerShellで以下のコマンドを実行して環境変数を設定します：

```powershell
# setup-auth.ps1スクリプトを実行
.\setup-auth.ps1 "C:\path\to\your\service-account-key.json"
```

※ `setup-auth.ps1`スクリプト内の以下の値を実際の値に変更してください：
- `your-project-id`: GCPプロジェクトID
- `your-index-id`: Vector SearchインデックスID

### 3. テスト実行

環境変数を設定した後、以下のコマンドでテストを実行します：

```powershell
node lib/test-batch-update.js
```

## 実装の詳細

バッチ更新方式では、以下の流れでVector Searchのインデックスを更新します：

1. データをJSONL形式に変換
2. Google Cloud Storage (GCS) にアップロード
3. Vertex AI IndexService APIを使用してインデックスを更新

この方法は、大量のデータを一度に更新する場合に効率的です。

## トラブルシューティング

### 認証エラー

以下のエラーが発生した場合：

```
Error: Unable to detect a Project Id in the current environment.
```

サービスアカウントキーのパスが正しく設定されているか確認してください。

### インデックス更新エラー

インデックス更新時にエラーが発生した場合、以下を確認してください：

1. インデックスIDが正しいか
2. サービスアカウントに必要な権限があるか
3. JSONL形式のデータが正しいか

## デプロイ

テストが成功したら、以下のコマンドでCloud Functionsにデプロイします：

```powershell
firebase deploy --only functions
```
