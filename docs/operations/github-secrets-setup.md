# GitHub Secrets 設定ガイド

**最終更新日**: 2025-10-10

## 📋 概要

GitHub Actionsで自動同期を実行するために必要なシークレットの設定方法です。

## 🔐 必要なシークレット

| シークレット名 | 説明 | 取得方法 |
|--------------|------|---------|
| `CONFLUENCE_API_TOKEN` | Confluence API トークン | Confluence設定画面から生成 |
| `GEMINI_API_KEY` | Gemini API キー | Google AI Studioから取得 |
| `GCP_SA_KEY` | Google Cloud Service Account JSON | Google Cloud Consoleから生成 |

## 🚀 設定手順

### 1. Confluence API トークンの生成

1. Atlassian アカウントにログイン
2. [API トークン管理ページ](https://id.atlassian.com/manage-profile/security/api-tokens)にアクセス
3. 「Create API token」をクリック
4. トークン名を入力（例: `GitHub Actions Sync`）
5. 生成されたトークンをコピー

### 2. Gemini API キーの取得

1. [Google AI Studio](https://aistudio.google.com/app/apikey)にアクセス
2. 「Create API Key」をクリック
3. プロジェクトを選択
4. 生成されたキーをコピー

### 3. Service Account の作成と設定

#### 3-1. Service Account の作成

```bash
# Service Account を作成
gcloud iam service-accounts create github-actions \
  --display-name "GitHub Actions Service Account" \
  --project confluence-copilot-ppjye
```

#### 3-2. 必要な権限を付与

```bash
# Cloud Storage の読み書き権限
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member "serviceAccount:github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --role "roles/storage.objectAdmin"

# Firestore の読み書き権限
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member "serviceAccount:github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --role "roles/datastore.user"

# Secret Manager の読み取り権限
gcloud projects add-iam-policy-binding confluence-copilot-ppjye \
  --member "serviceAccount:github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --role "roles/secretmanager.secretAccessor"
```

#### 3-3. Service Account キーの生成

```bash
# JSON キーファイルを生成
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com

# キーの内容を表示（コピー用）
cat github-actions-key.json
```

**⚠️ 重要**: 
- このJSONファイルは機密情報です。安全に保管してください
- GitHubに設定後、ローカルファイルは削除してください

### 4. GitHub Secrets の設定

#### 4-1. GitHubリポジトリにアクセス

1. リポジトリページを開く
2. **Settings** → **Secrets and variables** → **Actions** に移動

#### 4-2. シークレットの追加

**CONFLUENCE_API_TOKEN:**
```
1. "New repository secret" をクリック
2. Name: CONFLUENCE_API_TOKEN
3. Secret: [Confluenceで生成したトークン]
4. "Add secret" をクリック
```

**GEMINI_API_KEY:**
```
1. "New repository secret" をクリック
2. Name: GEMINI_API_KEY
3. Secret: [Google AI Studioで取得したキー]
4. "Add secret" をクリック
```

**GCP_SA_KEY:**
```
1. "New repository secret" をクリック
2. Name: GCP_SA_KEY
3. Secret: [Service Account JSON キーの全内容]
4. "Add secret" をクリック
```

## ✅ 動作確認

### 手動でワークフローを実行

1. GitHub リポジトリの **Actions** タブに移動
2. **Scheduled Confluence Sync** ワークフローを選択
3. **Run workflow** をクリック
4. Sync type を選択（`differential` または `full`）
5. **Run workflow** を実行

### ログの確認

```
1. 実行中のワークフローをクリック
2. 各ステップの詳細ログを確認
3. エラーがある場合は、エラーメッセージを確認
```

## 🔒 セキュリティのベストプラクティス

### 1. Service Account の権限を最小限に

```bash
# 不要な権限は削除
gcloud projects remove-iam-policy-binding confluence-copilot-ppjye \
  --member "serviceAccount:github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --role "roles/editor"  # 例: 広範な権限は削除
```

### 2. キーのローテーション

定期的に（3〜6ヶ月ごと）Service Account キーをローテーションします：

```bash
# 新しいキーを生成
gcloud iam service-accounts keys create new-github-actions-key.json \
  --iam-account github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com

# 古いキーを無効化
gcloud iam service-accounts keys disable [OLD_KEY_ID] \
  --iam-account github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com

# 確認後、古いキーを削除
gcloud iam service-accounts keys delete [OLD_KEY_ID] \
  --iam-account github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com
```

### 3. キーのリスト確認

```bash
# Service Account のキー一覧
gcloud iam service-accounts keys list \
  --iam-account github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com

# 出力例:
# KEY_ID                                    CREATED_AT            EXPIRES_AT
# 123abc...                                 2025-01-15T12:00:00Z  9999-12-31T23:59:59Z
```

### 4. アクセスログの監視

```bash
# Service Account の使用状況を確認
gcloud logging read \
  "protoPayload.authenticationInfo.principalEmail:github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com" \
  --limit 50 \
  --format json
```

## 🚨 トラブルシューティング

### エラー: 認証失敗

**原因**: Service Account キーが正しくない、または期限切れ

**解決方法**:
```bash
# 新しいキーを生成
gcloud iam service-accounts keys create new-key.json \
  --iam-account github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com

# GitHubのシークレットを更新
```

### エラー: 権限不足

**原因**: Service Account に必要な権限がない

**解決方法**:
```bash
# 必要な権限を確認
gcloud projects get-iam-policy confluence-copilot-ppjye \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@confluence-copilot-ppjye.iam.gserviceaccount.com"

# 必要な権限を追加（上記の「必要な権限を付与」セクションを参照）
```

### エラー: Confluence API トークン無効

**原因**: トークンが期限切れまたは無効化された

**解決方法**:
1. Confluence で新しいトークンを生成
2. GitHub Secrets を更新

## 📚 関連ドキュメント

- [Confluence データの自動同期](./automated-data-sync.md)
- [GitHub Actions ドキュメント](https://docs.github.com/en/actions)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)

## 📋 チェックリスト

設定完了後、以下を確認してください：

- [ ] Confluence API トークンが有効
- [ ] Gemini API キーが有効
- [ ] Service Account が作成済み
- [ ] 必要な権限がすべて付与済み
- [ ] Service Account JSON キーが生成済み
- [ ] GitHub Secrets がすべて設定済み
- [ ] 手動でワークフローを実行して成功を確認
- [ ] ローカルのキーファイルを削除

