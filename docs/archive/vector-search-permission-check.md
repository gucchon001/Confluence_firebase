# Vector Search APIの権限確認ガイド

Vector Search APIの400エラーが発生している原因として、サービスアカウントの権限不足が考えられます。以下の手順で権限を確認し、必要に応じて追加してください。

## 1. Google Cloud Consoleでの確認

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセスする
2. プロジェクト「confluence-copilot-ppjye」を選択する
3. 左側のメニューから「IAMと管理」→「IAM」を選択する
4. 使用しているサービスアカウントを探す（通常は「[PROJECT_ID]@appspot.gserviceaccount.com」または「firebase-adminsdk」で始まるもの）
5. そのサービスアカウントに割り当てられているロールを確認する

## 2. 必要なロール

Vector Search APIを使用するためには、以下のロールが必要です：

- **Vertex AI ユーザー** (`roles/aiplatform.user`)
- **Vertex AI 管理者** (`roles/aiplatform.admin`) - インデックスの作成や更新に必要
- **ストレージ管理者** (`roles/storage.admin`) - データのアップロードに必要
- **Service Usage 管理者** (`roles/serviceusage.serviceUsageAdmin`) - APIの有効化に必要

## 3. ロールの追加方法

1. IAMページで該当するサービスアカウントの右側にある鉛筆アイコン（編集）をクリックする
2. 「別のロールを追加」をクリックする
3. ロール選択ドロップダウンから必要なロールを選択する
4. 「保存」をクリックする

## 4. APIの有効化確認

1. 左側のメニューから「APIとサービス」→「ダッシュボード」を選択する
2. 以下のAPIが有効になっていることを確認する：
   - Vertex AI API
   - Cloud Storage API
   - Compute Engine API

## 5. Firebase Functionsのサービスアカウント確認

Firebase Functionsは独自のサービスアカウントを使用しています。以下の手順で確認してください：

1. Firebase Consoleにアクセスする
2. プロジェクト設定を開く
3. 「サービスアカウント」タブを選択する
4. 「Firebase Admin SDK」のサービスアカウントを確認する

## 6. 権限エラーのデバッグ

400エラー（Bad Request）は権限の問題だけでなく、リクエスト形式の問題も考えられます。以下の点も確認してください：

1. サービスアカウントキーが正しく設定されているか
2. 環境変数が正しく設定されているか
3. リクエストのペイロード形式が正しいか

## 7. 詳細なエラーログの取得

より詳細なエラーログを取得するには、以下の手順を試してください：

1. Google Cloud Consoleで「Logging」を開く
2. 以下のフィルターを適用する：
   ```
   resource.type="cloud_function"
   resource.labels.function_name="syncConfluenceData"
   severity>=ERROR
   ```
3. エラーログの詳細を確認する

## 参考リンク

- [Vertex AI の Identity and Access Management（IAM）](https://cloud.google.com/vertex-ai/docs/general/access-control)
- [サービスアカウントの作成と管理](https://cloud.google.com/iam/docs/creating-managing-service-accounts)
- [Cloud Functions のサービスアカウント](https://cloud.google.com/functions/docs/securing/function-identity)
